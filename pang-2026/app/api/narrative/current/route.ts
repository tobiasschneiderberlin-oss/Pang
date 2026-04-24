/**
 * PANG — /api/narrative/current (iter #14).
 *
 * GET — returns the *current* calendar month's paragraph marker if one
 * exists and is a `kind: "paragraph"` entry; 204 No Content if the
 * month is unset, and 204 also if the month's marker is `kind:
 * "skipped"` (silence is the right register when there is nothing to
 * observe). The Room overlay polls this on arrival.
 *
 * POST — the *tick*. Called by the dev cron (`scripts/narrative-tick.ts`)
 * and — later — by a Vercel cron. Runs the full pipeline:
 *
 *   1. Validate the request body (Zod).
 *   2. Short-circuit on `hasCurrentMonth` → respond `kind: "cached"`.
 *   3. Assemble the input (CaMeL boundary; primitive 70). A skip here
 *      commits a `kind: "skipped"` marker with the assembler's reason,
 *      then responds.
 *   4. Compare the new `collectionHash` against `getPriorMonthHash`. If
 *      equal, commit a `kind: "skipped"` marker with reason
 *      `"unchanged-collection"`. The collector sees the same reading
 *      as last month by default — no reason to chatter.
 *   5. Call `runNarrative`. `null` → commit `agent-failure` skip.
 *   6. Success → commit the paragraph marker. Primitive 51: the marker
 *      commits before any side effect the collector can observe; the
 *      marker file *is* the side effect.
 *
 * Auth gate (P10 pattern): GET and POST both require an authenticated
 * session. The route does not accept a `collectorId` different from
 * the session's `userId` — that check is intentional scope containment
 * (iter #14 is one collector, one month; cross-collector admin flows
 * don't exist yet).
 *
 * No `JSON.parse` on an agent payload (A1). No raw-untrusted payload
 * leaks into the agent — the assembler brands the assembled input
 * `'P'` and `runNarrative`'s `assertCapability` enforces.
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import { requireSession, UnauthenticatedError } from "@/auth/server/session";
import {
  NarrativeTickRequestSchema,
  type NarrativeCurrentResponse,
  type NarrativeTickRequest,
  type NarrativeTickResponse,
  type NarrativeMarker,
  type NarrativeSkipReason,
} from "@/narrative/schema";
import {
  assembleNarrativeInput,
  monthOf,
  type NarrativeCollectorState,
} from "@/narrative/input";
import {
  getCurrentMonth,
  getPriorMonthHash,
  hasCurrentMonth,
  putCurrentMonth,
} from "@/narrative/store";
import { runNarrative } from "@/ai/agents/narrative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024; // collector state can be wide but is bounded.

// ---------- GET ---------------------------------------------------

export async function GET(): Promise<Response> {
  return withOtelSpan("pang.api.narrative.current.get", async (span) => {
    span.setAttribute("http.method", "GET");
    span.setAttribute("http.route", "/api/narrative/current");

    let userId: string;
    try {
      const session = await requireSession();
      userId = session.userId;
      span.setAttribute("pang.auth.user_id", userId);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        span.setAttribute("pang.auth.fail_reason", err.reason);
        return new Response(null, { status: 401 });
      }
      throw err;
    }

    const now = new Date();
    span.setAttribute("pang.narrative.month", monthOf(now));

    const marker = await getCurrentMonth(userId, now);
    if (marker === null) {
      span.setAttribute("pang.narrative.state", "absent");
      return new Response(null, { status: 204 });
    }
    if (marker.kind === "skipped") {
      span.setAttribute("pang.narrative.state", "skipped");
      span.setAttribute("pang.narrative.skip_reason", marker.reason);
      // Silence on the wire — the overlay shows nothing.
      return new Response(null, { status: 204 });
    }

    // kind === "paragraph" — return the wire shape.
    const body: NarrativeCurrentResponse = {
      paragraph: marker.paragraph,
      month: marker.month,
      decidedAt: marker.decidedAt,
      collectionHash: marker.collectionHash,
    };
    span.setAttribute("pang.narrative.state", "paragraph");
    span.setAttribute("pang.narrative.paragraph_length", marker.paragraph.length);
    return NextResponse.json(body, { status: 200 });
  });
}

// ---------- POST --------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.narrative.current.post", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/narrative/current");

    let userId: string;
    try {
      const session = await requireSession();
      userId = session.userId;
      span.setAttribute("pang.auth.user_id", userId);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        span.setAttribute("pang.auth.fail_reason", err.reason);
        return new Response(null, { status: 401 });
      }
      throw err;
    }

    // ---- Body + validation ----------------------------------------
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      span.setAttribute("pang.error.kind", "bad_body");
      return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    if (bodyText.length > MAX_BODY_BYTES) {
      span.setAttribute("pang.error.kind", "oversize");
      return NextResponse.json({ error: "oversize" }, { status: 413 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      span.setAttribute("pang.error.kind", "bad_json");
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    const parsed = NarrativeTickRequestSchema.safeParse(raw);
    if (!parsed.success) {
      span.setAttribute("pang.error.kind", "schema");
      return NextResponse.json(
        { error: "schema", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body: NarrativeTickRequest = parsed.data;

    // Scope containment: POST is for the authenticated collector only.
    if (body.collectorId !== userId) {
      span.setAttribute("pang.error.kind", "collector_mismatch");
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const now = new Date();
    const month = monthOf(now);
    span.setAttribute("pang.narrative.month", month);
    span.setAttribute(
      "pang.narrative.verified_work_count",
      body.verifiedWorks.length,
    );
    span.setAttribute(
      "pang.narrative.provenance_entry_count",
      body.provenanceEntries.length,
    );

    // ---- 1. Same-month marker short-circuit ------------------------
    if (await hasCurrentMonth(userId, now)) {
      const existing = await getCurrentMonth(userId, now);
      const cached: NarrativeTickResponse =
        existing?.kind === "skipped"
          ? {
              kind: "skipped",
              month,
              reason: existing.reason,
              decidedAt: existing.decidedAt,
            }
          : {
              kind: "cached",
              month,
              decidedAt: existing?.decidedAt ?? new Date().toISOString(),
            };
      span.setAttribute("pang.narrative.tick_outcome", cached.kind);
      if (cached.kind === "skipped") {
        span.setAttribute("pang.narrative.skip_reason", cached.reason);
      }
      return NextResponse.json(cached, { status: 200 });
    }

    // ---- 2. Assemble the input ------------------------------------
    const state: NarrativeCollectorState = {
      collectorId: body.collectorId,
      verifiedWorks: body.verifiedWorks,
      provenanceEntries: body.provenanceEntries,
      bioMujiParagraphs: body.bioMujiParagraphs,
    };
    const assembled = assembleNarrativeInput(state, now);

    if (assembled.kind === "skip") {
      const skip = await commitSkip(userId, month, now, assembled.reason, null);
      span.setAttribute("pang.narrative.tick_outcome", "skipped");
      span.setAttribute("pang.narrative.skip_reason", assembled.reason);
      return NextResponse.json(skip, { status: 200 });
    }

    const input = assembled.input;
    span.setAttribute("pang.narrative.collection_hash", input.collectionHash);

    // ---- 3. Unchanged-collection short-circuit --------------------
    const priorHash = await getPriorMonthHash(userId, now);
    if (priorHash !== null && priorHash === input.collectionHash) {
      const skip = await commitSkip(
        userId,
        month,
        now,
        "unchanged-collection",
        input.collectionHash,
      );
      span.setAttribute("pang.narrative.tick_outcome", "skipped");
      span.setAttribute("pang.narrative.skip_reason", "unchanged-collection");
      return NextResponse.json(skip, { status: 200 });
    }

    // ---- 4. Run the agent ----------------------------------------
    let output: Awaited<ReturnType<typeof runNarrative>>;
    try {
      output = await runNarrative(input);
    } catch (err) {
      // Capability violation, etc — surface as 502 so the client
      // backs off. Not a 500 (the server itself is healthy).
      span.setAttribute("pang.error.kind", "agent_exception");
      span.recordException(err);
      return NextResponse.json({ error: "agent_error" }, { status: 502 });
    }

    if (output === null) {
      const skip = await commitSkip(
        userId,
        month,
        now,
        "agent-failure",
        input.collectionHash,
      );
      span.setAttribute("pang.narrative.tick_outcome", "skipped");
      span.setAttribute("pang.narrative.skip_reason", "agent-failure");
      return NextResponse.json(skip, { status: 200 });
    }

    // ---- 5. Commit the paragraph marker ---------------------------
    const decidedAt = new Date().toISOString();
    const marker: NarrativeMarker = {
      kind: "paragraph",
      collectorId: userId,
      month,
      collectionHash: input.collectionHash,
      paragraph: output.paragraph,
      decidedAt,
    };
    await putCurrentMonth(userId, marker, now);
    span.setAttribute("pang.narrative.tick_outcome", "generated");
    span.setAttribute("pang.narrative.paragraph_length", output.paragraph.length);

    const response: NarrativeTickResponse = {
      kind: "generated",
      month,
      decidedAt,
      collectionHash: input.collectionHash,
      paragraphLength: output.paragraph.length,
    };
    return NextResponse.json(response, { status: 200 });
  });
}

// ---------- Helpers ----------------------------------------------

/**
 * Commit a skipped marker + return the wire response shape. Primitive
 * 51: the skip marker is the idempotency boundary, identical to the
 * paragraph marker. The route never retries a month — next month's
 * tick is a fresh attempt.
 */
async function commitSkip(
  collectorId: string,
  month: string,
  now: Date,
  reason: NarrativeSkipReason,
  collectionHash: string | null,
): Promise<NarrativeTickResponse> {
  const decidedAt = new Date().toISOString();
  // When the assembler skipped on empty collection, there is no hash
  // because the assembler never computed one (no verified works).
  // Use a stable sentinel so the marker schema's min(8) holds.
  const hash = collectionHash ?? "skip-no-hash-0000";
  const marker: NarrativeMarker = {
    kind: "skipped",
    collectorId,
    month,
    collectionHash: hash,
    reason,
    decidedAt,
  };
  await putCurrentMonth(collectorId, marker, now);
  return { kind: "skipped", month, reason, decidedAt };
}
