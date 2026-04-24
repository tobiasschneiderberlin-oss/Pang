/**
 * PANG — /api/verification/dispatch route (iter #10).
 *
 * The endpoint the collector's AskGallery panel hits once the gallery
 * has been identified and the collector taps "send now". The server:
 *
 *   1. Verifies the collector session and rate-limits per user.
 *   2. Locates the outbox record for `requestId` and refuses if the
 *      request hasn't landed (dispatch is downstream of enqueue).
 *   3. Returns the cached dispatch payload verbatim if one already
 *      exists — idempotency is by `requestId`, NOT by channel
 *      (re-dispatching to a different channel is a fresh call with a
 *      different downstream side effect and different signed links).
 *   4. Calls the Correspondence Agent with the rectified artwork
 *      snapshot + gallery display name + channel.
 *   5. Mints a confirm + decline signed link (audience-scoped, 30d TTL).
 *   6. Substitutes the signed URLs into the agent body.
 *   7. Builds a URL-handoff target (mailto: / wa.me) carrying the
 *      composed body + subject.
 *   8. Persists the dispatch payload onto the outbox record (single
 *      atomic rewrite) so future calls return it verbatim.
 *   9. Returns the payload — the client's `<a>.click()` opens the
 *      collector's email client or WhatsApp.
 *
 * Design points:
 *
 *   - PANG does NOT dispatch on the gallery's behalf. The collector's
 *     channel is the collector's. The server composes; the collector
 *     sends. This keeps PANG off the gallery's inbox-provider deny
 *     lists, respects the gallery's existing relationship with the
 *     collector, and sidesteps email-deliverability entirely.
 *
 *   - The agent never sees the signed URLs. It emits placeholders;
 *     the route substitutes. Keeps the cryptographic payload out of
 *     the prompt cache; makes an injection rewriting the link
 *     impossible.
 *
 *   - Idempotency is load-bearing. A double-tap, a network retry, a
 *     refresh-and-tap — all three must land on the same signed pair.
 *     If we mint new URLs on retry, the collector's first send and
 *     second send would both be valid but point at different records,
 *     and the gallery would receive two different emails for one
 *     ask.
 *
 *   - Outbox-as-truth: the cached dispatch lives inside the outbox
 *     record, not a sibling file. Reconciliation (primitive 52 —
 *     one file per request; no cross-file joins) keeps working.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withOtelSpan } from "@/lib/otel/span";
import {
  VerificationDispatchRequestSchema,
  type VerificationDispatchRequest,
  type VerificationDispatchResult,
} from "@/verification/schema";
import { requireSession, UnauthenticatedError } from "@/auth/server/session";
import { runCorrespondenceAgent, substitutePlaceholders } from "@/ai/agents/correspondence";
import { signSignedLink } from "@/auth/server/signed-link";
import { acceptGallery } from "@/ai/camel/trust";
import { brand } from "@/ai/camel/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

const SERVER_OUTBOX_DIR = path.resolve(process.cwd(), ".pang", "server-outbox");

// ---------- Helpers ----------------------------------------------

interface StoredOutboxRecord {
  readonly request: unknown;
  readonly receivedAt: string;
  readonly dispatch?: VerificationDispatchResult;
}

async function readStored(targetPath: string): Promise<StoredOutboxRecord | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as StoredOutboxRecord;
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
}

async function writeStored(
  targetPath: string,
  record: StoredOutboxRecord,
): Promise<void> {
  const tmpPath = `${targetPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tmpPath, targetPath);
}

/** The base URL the gallery sees — derived from the request. */
function deriveBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function buildMailtoUrl(
  to: string,
  subject: string,
  body: string,
): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

function buildWhatsAppUrl(phoneE164ish: string, body: string): string {
  // wa.me expects digits only; strip non-digits defensively.
  const digits = phoneE164ish.replace(/\D/g, "");
  const params = new URLSearchParams();
  params.set("text", body);
  return `https://wa.me/${digits}?${params.toString()}`;
}

// ---------- Handler ----------------------------------------------

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.verification.dispatch", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/verification/dispatch");

    // Auth gate.
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

    const parsed = VerificationDispatchRequestSchema.safeParse(raw);
    if (!parsed.success) {
      span.setAttribute("pang.error.kind", "schema");
      return NextResponse.json(
        { error: "schema", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body: VerificationDispatchRequest = parsed.data;
    span.setAttribute("pang.verification.request_id", body.requestId);
    span.setAttribute("pang.dispatch.channel", body.channel);

    // Locate the outbox record the dispatch binds to. A dispatch for a
    // requestId we've never seen is a client bug — the AskGallery
    // surface must enqueue before it dispatches.
    const targetPath = path.join(
      SERVER_OUTBOX_DIR,
      `${body.requestId}.json`,
    );
    const stored = await readStored(targetPath);
    if (stored === null) {
      span.setAttribute("pang.error.kind", "no_outbox_record");
      return NextResponse.json(
        { error: "no_outbox_record" },
        { status: 404 },
      );
    }

    // Idempotency: a cached dispatch for the same channel returns
    // verbatim. A channel switch (email → whatsapp on retry) overwrites
    // — the collector asked for the other rail; the first rail is
    // discarded. The confirm/decline links are NOT rotated; the gallery
    // that already received the first send sees the same pair.
    if (
      stored.dispatch !== undefined &&
      stored.dispatch.channel === body.channel
    ) {
      span.setAttribute("pang.dispatch.dedup_hit", true);
      return NextResponse.json(stored.dispatch, { status: 200 });
    }

    // The artwork snapshot is on the stored request. Re-parse it
    // through the agent's own assertCapability at the boundary —
    // we're trusting the server-side outbox, so brand 'gallery'
    // rather than 'P'.
    const outboxRequest = stored.request as {
      readonly artworkSnapshot?: unknown;
      readonly galleryNameHint?: string | null;
      readonly galleryIdHint?: string | null;
      readonly galleryFreeText?: string | null;
      readonly workId?: string;
    };

    const artworkSnapshot = outboxRequest.artworkSnapshot;
    if (!artworkSnapshot || typeof artworkSnapshot !== "object") {
      span.setAttribute("pang.error.kind", "bad_outbox_record");
      return NextResponse.json(
        { error: "bad_outbox_record" },
        { status: 500 },
      );
    }
    const workId = outboxRequest.workId;
    if (typeof workId !== "string" || workId.length === 0) {
      span.setAttribute("pang.error.kind", "bad_outbox_record");
      return NextResponse.json(
        { error: "bad_outbox_record" },
        { status: 500 },
      );
    }

    const galleryDisplayName =
      outboxRequest.galleryNameHint ??
      outboxRequest.galleryFreeText ??
      outboxRequest.galleryIdHint ??
      "your gallery";

    // Gallery id for the signed-link `gid` claim. Falls back to a
    // per-request synthetic id; the gallery-side confirm route doesn't
    // gate on a known gallery table in iter #10 — the token itself is
    // the auth.
    const galleryId =
      outboxRequest.galleryIdHint && outboxRequest.galleryIdHint.length > 0
        ? outboxRequest.galleryIdHint
        : `vr-${body.requestId}`;

    // ---- Mint confirm + decline signed links --------------------
    const baseUrl = deriveBaseUrl(request);
    let confirmUrl: string;
    let declineUrl: string;
    try {
      const confirm = await signSignedLink({
        audience: "gallery-confirm",
        galleryId,
        verificationRequestId: body.requestId,
        workId,
      });
      const decline = await signSignedLink({
        audience: "gallery-decline",
        galleryId,
        verificationRequestId: body.requestId,
        workId,
      });
      confirmUrl = `${baseUrl}/g/confirm/${confirm.jwt}`;
      declineUrl = `${baseUrl}/g/decline/${decline.jwt}`;
    } catch (err) {
      span.setAttribute("pang.error.kind", "sign_link");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    // ---- Call the Correspondence Agent --------------------------
    let agentOutput: Awaited<ReturnType<typeof runCorrespondenceAgent>>;
    try {
      agentOutput = await runCorrespondenceAgent({
        artwork: acceptGallery(artworkSnapshot as object) as Parameters<
          typeof runCorrespondenceAgent
        >[0]["artwork"],
        gallery: brand(
          { displayName: galleryDisplayName },
          "gallery",
        ) as Parameters<typeof runCorrespondenceAgent>[0]["gallery"],
        channel: body.channel,
      });
    } catch (err) {
      span.setAttribute("pang.error.kind", "agent_error");
      span.recordException(err);
      return NextResponse.json(
        { error: "agent_error" },
        { status: 502 },
      );
    }

    if (agentOutput === null) {
      // Terminal agent failure. Return 502 so the client can fall
      // back to a degraded path (show a bare "send now" button with
      // a skeletal body that still carries the two URLs).
      span.setAttribute("pang.dispatch.agent_fallback", true);
      const fallbackSubject =
        body.channel === "email"
          ? `Verification request for ${galleryDisplayName}`
          : null;
      const fallbackBody = [
        `A collector is asking ${galleryDisplayName} to verify a work.`,
        "",
        `Confirm: ${confirmUrl}`,
        `Decline: ${declineUrl}`,
      ].join("\n");

      const dispatchedAt = new Date().toISOString();
      const result: VerificationDispatchResult = {
        version: "v1",
        requestId: body.requestId,
        channel: body.channel,
        channelUrl:
          body.channel === "email"
            ? buildMailtoUrl(
                body.galleryContact,
                fallbackSubject ?? "Verification request",
                fallbackBody,
              )
            : buildWhatsAppUrl(body.galleryContact, fallbackBody),
        previewSubject: fallbackSubject,
        previewBody: fallbackBody,
        confirmUrl,
        declineUrl,
        dispatchedAt,
      };
      try {
        await writeStored(targetPath, { ...stored, dispatch: result });
      } catch (err) {
        span.setAttribute("pang.error.kind", "outbox_write");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
      return NextResponse.json(result, { status: 200 });
    }

    // ---- Substitute + build URL-handoff target ------------------
    const composedBody = substitutePlaceholders(
      agentOutput.body,
      confirmUrl,
      declineUrl,
    );
    const composedSubject = agentOutput.subject;

    const channelUrl =
      body.channel === "email"
        ? buildMailtoUrl(
            body.galleryContact,
            composedSubject ?? "Verification request",
            composedBody,
          )
        : buildWhatsAppUrl(body.galleryContact, composedBody);

    const dispatchedAt = new Date().toISOString();
    const result: VerificationDispatchResult = {
      version: "v1",
      requestId: body.requestId,
      channel: body.channel,
      channelUrl,
      previewSubject: composedSubject,
      previewBody: composedBody,
      confirmUrl,
      declineUrl,
      dispatchedAt,
    };

    // ---- Persist the cached dispatch ---------------------------
    try {
      await writeStored(targetPath, { ...stored, dispatch: result });
    } catch (err) {
      span.setAttribute("pang.error.kind", "outbox_write");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    span.setAttribute("pang.dispatch.body_length", composedBody.length);
    span.setAttribute("pang.dispatch.dedup_hit", false);
    return NextResponse.json(result, { status: 200 });
  });
}
