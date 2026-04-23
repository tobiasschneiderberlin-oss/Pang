/**
 * PANG — /api/enrichment/submit route.
 *
 * The endpoint a gallery / museum / prior-owner drains to when
 * attaching structured provenance to a verified work. Receives a
 * `ProvenanceSubmission` (validated by the same Zod schema the
 * client serialises against) and lands the record in a server-side
 * durable store. Iteration #5 uses a filesystem-backed store under
 * `.pang/enrichment-inbox/<submissionId>.json` — a single-process
 * dev stand-in. The production dispatch path (Anthropic Batch API —
 * A20) is named in the kickoff brief and wires in iteration #7;
 * the route's interface is the contract both paths honour.
 *
 * Failure modes the brief's fifth declaration names:
 *
 *   - "auth"                — missing or wrong X-PANG-Gallery-Token.
 *                             Contributor auth is a header for iter #5;
 *                             OAuth lands in iter #7 alongside the
 *                             batch dispatch.
 *   - "schema"              — Zod rejection. Returns 400.
 *   - "hash-mismatch"       — submission's basedOnWorkHash disagrees
 *                             with the last submission we recorded
 *                             for that workId. Prevents a stale
 *                             submission from overwriting a fresher
 *                             enrichment. Returns 409.
 *   - "duplicate-submission" — same submissionId already on file.
 *                              Returns the original ack (idempotent).
 *                              Not a client error — the retry loop
 *                              relies on this path.
 *   - "oversize" / "bad_json" / "bad_body" — standard hygiene.
 *
 * Every reject path fires `enrichment.submission.rejected` with a
 * named `reason`. The accepted path fires
 * `enrichment.submission.received` followed by (in the dev path)
 * an inline `enrichment.agent.*` run.
 *
 * Security posture:
 *   - Contributor-supplied fields re-run through
 *     `runBannedVocabularyCheck()`. The client sanitises; the server
 *     is the last line of defence against a compromised contributor
 *     path. A voice violation returns 422 so the contributor's
 *     retry loop doesn't loop on it.
 *   - `untrustedNote` fields are *not* scanned here — they are
 *     explicitly labelled untrusted and reach only the Q-LLM. The
 *     scan would be a false-positive surface (an art note can
 *     legitimately mention "iconic" in the artist's own words).
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withOtelSpan } from "@/lib/otel/span";
import {
  ProvenanceSubmissionSchema,
  type EnrichmentAck,
  type ProvenanceSubmission,
} from "@/enrichment/schema";
import {
  runBannedVocabularyCheck,
  VoiceViolation,
} from "@/ai/camel/sanitize";
import {
  submissionReceivedEvent,
  submissionRejectedEvent,
} from "@/enrichment/otel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A submission with 16 records averages ~6 kB; cap generously.
const MAX_BODY_BYTES = 32 * 1024;

// Server-side durable store roots.
const ENRICHMENT_INBOX_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "enrichment-inbox",
);
const ENRICHMENT_WORK_HASH_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "enrichment-work-hash",
);

/**
 * Shared token for contributors to present via X-PANG-Gallery-Token.
 * In production this is minted per contributor through an OAuth
 * exchange and persisted server-side; iteration #5 accepts a single
 * environment-configured token so the dev path and the eval fixtures
 * can exercise the auth edge. Empty env = any header rejected.
 */
const GALLERY_TOKEN = process.env["PANG_GALLERY_TOKEN"] ?? "";

// ---------- Handler ----------------------------------------------

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.enrichment.submit", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/enrichment/submit");

    // ---- Auth ---------------------------------------------------
    const token = request.headers.get("x-pang-gallery-token");
    if (!GALLERY_TOKEN || !token || token !== GALLERY_TOKEN) {
      span.setAttribute("pang.error.kind", "auth");
      submissionRejectedEvent(null, "auth");
      return NextResponse.json({ error: "auth" }, { status: 401 });
    }

    // ---- Body hygiene -------------------------------------------
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      span.setAttribute("pang.error.kind", "bad_body");
      submissionRejectedEvent(null, "schema", "bad_body");
      return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    if (bodyText.length > MAX_BODY_BYTES) {
      span.setAttribute("pang.error.kind", "oversize");
      span.setAttribute("pang.body.bytes", bodyText.length);
      submissionRejectedEvent(null, "schema", "oversize");
      return NextResponse.json({ error: "oversize" }, { status: 413 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      span.setAttribute("pang.error.kind", "bad_json");
      submissionRejectedEvent(null, "schema", "bad_json");
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    // ---- Schema -------------------------------------------------
    const parsed = ProvenanceSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      span.setAttribute("pang.error.kind", "schema");
      span.setAttribute(
        "pang.schema.error",
        JSON.stringify(parsed.error.flatten()).slice(0, 512),
      );
      submissionRejectedEvent(null, "schema");
      return NextResponse.json(
        { error: "schema", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body: ProvenanceSubmission = parsed.data;
    span.setAttribute("pang.enrichment.submission_id", body.submissionId);
    span.setAttribute("pang.enrichment.work_id", body.workId);
    span.setAttribute(
      "pang.enrichment.record_count",
      body.records.length,
    );
    span.setAttribute(
      "pang.enrichment.contributor_role",
      body.contributorRole,
    );

    // ---- Voice defence-in-depth ---------------------------------
    // Only the fields the client explicitly sanitises before
    // serialisation. `untrustedNote` is NOT scanned here — it is the
    // Q-LLM's job, and a contributor's art note can legitimately
    // contain words the evaluative list would flag.
    try {
      runBannedVocabularyCheck({
        location: body.records.map((r) => r.location),
      });
    } catch (err) {
      if (err instanceof VoiceViolation) {
        span.setAttribute("pang.error.kind", "voice_violation");
        span.setAttribute("pang.voice.term", err.term);
        span.setAttribute("pang.voice.path", err.path);
        submissionRejectedEvent(body.submissionId, "schema", "voice");
        return NextResponse.json(
          { error: "voice_violation" },
          { status: 422 },
        );
      }
      throw err;
    }

    // ---- Durable stores ready ----------------------------------
    try {
      await fs.mkdir(ENRICHMENT_INBOX_DIR, { recursive: true });
      await fs.mkdir(ENRICHMENT_WORK_HASH_DIR, { recursive: true });
    } catch (err) {
      span.setAttribute("pang.error.kind", "inbox_mkdir");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    // ---- Hash mismatch check -----------------------------------
    // A previously-recorded hash for this workId must match.
    // Missing file = first submission; first wins. Subsequent
    // submissions with a stale hash 409 so the contributor refreshes
    // their view of the work.
    const workHashPath = path.join(
      ENRICHMENT_WORK_HASH_DIR,
      `${body.workId}.txt`,
    );
    let previousHash: string | null = null;
    try {
      const existing = await fs.readFile(workHashPath, "utf8");
      previousHash = existing.trim();
    } catch (err) {
      if (!isEnoent(err)) {
        span.setAttribute("pang.error.kind", "workhash_read");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
    }
    if (previousHash !== null && previousHash !== body.basedOnWorkHash) {
      span.setAttribute("pang.error.kind", "hash_mismatch");
      span.setAttribute("pang.enrichment.expected_hash", previousHash);
      span.setAttribute(
        "pang.enrichment.submitted_hash",
        body.basedOnWorkHash,
      );
      submissionRejectedEvent(body.submissionId, "hash-mismatch");
      return NextResponse.json(
        { error: "hash_mismatch", expected: previousHash },
        { status: 409 },
      );
    }

    // ---- Idempotency -------------------------------------------
    const inboxPath = path.join(
      ENRICHMENT_INBOX_DIR,
      `${body.submissionId}.json`,
    );
    let dedupHit = false;
    let receivedAt: string;
    try {
      const existing = await fs.readFile(inboxPath, "utf8");
      const existingRecord = JSON.parse(existing) as {
        receivedAt?: unknown;
      };
      if (typeof existingRecord.receivedAt === "string") {
        receivedAt = existingRecord.receivedAt;
        dedupHit = true;
      } else {
        receivedAt = new Date().toISOString();
      }
    } catch (err) {
      if (isEnoent(err)) {
        receivedAt = new Date().toISOString();
      } else {
        span.setAttribute("pang.error.kind", "inbox_read");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
    }
    span.setAttribute("pang.enrichment.dedup_hit", dedupHit);

    if (dedupHit) {
      submissionRejectedEvent(body.submissionId, "duplicate-submission");
      // The client's retry loop expects a 200 on a duplicate — the
      // submissionId is the idempotency key, not a client error.
      const ack: EnrichmentAck = {
        submissionId: body.submissionId,
        status: "received",
        receivedAt,
      };
      return NextResponse.json(ack, { status: 200 });
    }

    // ---- First write wins --------------------------------------
    const record = {
      submission: body,
      receivedAt,
    };
    try {
      const tmpPath = `${inboxPath}.tmp`;
      await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), {
        encoding: "utf8",
      });
      await fs.rename(tmpPath, inboxPath);
      // Record the canonical workHash alongside. The next submission
      // for this workId will hash-mismatch if the intake record
      // changed. The file is cheap; one line of hex.
      await fs.writeFile(workHashPath, body.basedOnWorkHash, "utf8");
    } catch (err) {
      span.setAttribute("pang.error.kind", "inbox_write");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    submissionReceivedEvent(
      body.submissionId,
      body.workId,
      body.contributorRole,
      body.records.length,
    );

    // ---- Dispatch ------------------------------------------------
    // Iteration #5 acknowledges receipt synchronously and hands off
    // to an out-of-band dispatch (Anthropic Batch API — A20). The
    // hand-off itself is deferred to iteration #7 alongside the
    // OAuth contributor auth; today the inbox file is the source of
    // truth the batch worker will read. A local-dev path can stand
    // in a synchronous agent call (gated by env) when testing the
    // end-to-end flow.
    //
    // No agent call is made here by default. The eval harness
    // (evals/enrichment/run.ts) exercises the agent directly against
    // fixtures instead of going through the HTTP edge — iteration #5
    // keeps the endpoint surface narrow.

    const ack: EnrichmentAck = {
      submissionId: body.submissionId,
      status: "received",
      receivedAt,
    };
    return NextResponse.json(ack, { status: 200 });
  });
}

function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  );
}
