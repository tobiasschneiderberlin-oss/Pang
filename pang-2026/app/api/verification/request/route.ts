/**
 * PANG — /api/verification/request route.
 *
 * The endpoint the collector's outbox drains to. Receives a
 * `VerificationRequest` (validated by the same Zod schema the client
 * serialises against) and lands the record in a server-side durable
 * store. Iteration #4 uses a filesystem-backed store under
 * `.pang/server-outbox/<requestId>.json` — a single-process dev
 * stand-in. A KV / queue binding is scheduled for iteration #7 when
 * real gallery dispatch lights up; the route's interface is the
 * contract both sides honour.
 *
 * Iteration #4 design notes:
 *
 *   - Idempotency on `requestId`. The ULID is generated client-side
 *     before the outbox write; retries land the same id, so the
 *     server's dedup key is the file name. A re-POST of an already-
 *     seen id returns the *original* `receivedAt` stamp — the client's
 *     retry logic then flips `"requesting" → "requested"` exactly
 *     once, and `verification.request.ack` fires with the original
 *     latency.
 *
 *   - `galleryFreeText` re-runs through `runBannedVocabularyCheck()`.
 *     The client already sanitises, but the server is the last line
 *     of defence against a compromised client; a voice violation at
 *     the boundary returns 422, not 500, so the outbox records
 *     `"voice/violation"` as a terminal failure (the retry loop won't
 *     loop on a 422).
 *
 *   - No write to a KV. The file-system backing is intentional for
 *     iteration #4: the tests want a deterministic on-disk artefact to
 *     compare against, and the Vercel edge can switch to the KV
 *     binding later without touching this module's callers.
 *
 *   - `withOtelSpan("pang.api.verification.request")` wraps the whole
 *     handler. Attributes set on the span: `pang.verification.
 *     request_id`, `pang.verification.work_id`, `pang.verification.
 *     latency_ms`, `pang.verification.dedup_hit`. These roll into the
 *     collector iteration #5 provides without re-plumbing.
 *
 *   - The OTel instant `verification.request.ack` fires on the server
 *     side too (the event is client- *or* server-emitted by design),
 *     so the beacon-style log tail shows both halves of the
 *     round-trip.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withOtelSpan } from "@/lib/otel/span";
import {
  VerificationRequestSchema,
  type VerificationRequest,
  type VerificationAck,
} from "@/verification/schema";
import {
  runBannedVocabularyCheck,
  VoiceViolation,
} from "@/ai/camel/sanitize";
import { requestAckEvent } from "@/verification/otel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A single-digit kB request body is generous: a typical payload is
// under 2 kB. Anything beyond this is a malformed or adversarial
// client and is rejected without parse work.
const MAX_BODY_BYTES = 8 * 1024;

// Server-side durable store root. Co-located under `.pang/` so the
// dev workspace owns it; the directory is gitignored via `.pang/`
// already being a developer convention surface.
const SERVER_OUTBOX_DIR = path.resolve(process.cwd(), ".pang", "server-outbox");

// ---------- Handler ----------------------------------------------

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.verification.request", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/verification/request");
    const startedAt = performance.now();

    // Body size gate — read as text to measure before parsing.
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      span.setAttribute("pang.error.kind", "bad_body");
      return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    if (bodyText.length > MAX_BODY_BYTES) {
      span.setAttribute("pang.error.kind", "oversize");
      span.setAttribute("pang.body.bytes", bodyText.length);
      return NextResponse.json({ error: "oversize" }, { status: 413 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      span.setAttribute("pang.error.kind", "bad_json");
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    const parsed = VerificationRequestSchema.safeParse(raw);
    if (!parsed.success) {
      span.setAttribute("pang.error.kind", "schema");
      span.setAttribute(
        "pang.schema.error",
        JSON.stringify(parsed.error.flatten()).slice(0, 512),
      );
      return NextResponse.json(
        { error: "schema", detail: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body: VerificationRequest = parsed.data;
    span.setAttribute("pang.verification.request_id", body.requestId);
    span.setAttribute("pang.verification.work_id", body.workId);

    // Defence-in-depth voice check. The client sanitises before
    // serialisation; re-running the ban list here protects against a
    // compromised client path. Only string fields with user content
    // are scanned (ban list is case-insensitive inside the helper).
    try {
      runBannedVocabularyCheck({
        galleryNameHint: body.galleryNameHint,
        galleryFreeText: body.galleryFreeText,
      });
    } catch (err) {
      if (err instanceof VoiceViolation) {
        span.setAttribute("pang.error.kind", "voice_violation");
        span.setAttribute("pang.voice.term", err.term);
        span.setAttribute("pang.voice.path", err.path);
        return NextResponse.json(
          { error: "voice_violation" },
          { status: 422 },
        );
      }
      throw err;
    }

    // Durable store: one file per requestId. The ULID is safe as a
    // filename (lowercase base36 + single dash) — no path traversal
    // surface, because the regex in `RequestIdSchema` forbids `/`.
    try {
      await fs.mkdir(SERVER_OUTBOX_DIR, { recursive: true });
    } catch (err) {
      span.setAttribute("pang.error.kind", "outbox_mkdir");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    const targetPath = path.join(
      SERVER_OUTBOX_DIR,
      `${body.requestId}.json`,
    );

    // Idempotency — if the file is already present, return its
    // original ack (same receivedAt). The dedup keeps the client's
    // `"requesting" → "requested"` flip monotonic across retries.
    let dedupHit = false;
    let receivedAt: string;
    try {
      const existing = await fs.readFile(targetPath, "utf8");
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
      // ENOENT is the expected happy path — no existing record.
      if (
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        receivedAt = new Date().toISOString();
      } else {
        span.setAttribute("pang.error.kind", "outbox_read");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
    }

    span.setAttribute("pang.verification.dedup_hit", dedupHit);

    if (!dedupHit) {
      // First write wins. JSON is the record format; the file carries
      // the request + the server's receivedAt so a downstream worker
      // (iteration #7) can pick it up cold.
      const record = {
        request: body,
        receivedAt,
      };
      try {
        // Atomic-ish: write to a temp path, then rename. A partial
        // write cannot leave a half-file under the canonical name.
        const tmpPath = `${targetPath}.tmp`;
        await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), {
          encoding: "utf8",
        });
        await fs.rename(tmpPath, targetPath);
      } catch (err) {
        span.setAttribute("pang.error.kind", "outbox_write");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    span.setAttribute("pang.verification.latency_ms", latencyMs);
    requestAckEvent(body.requestId, body.workId, latencyMs);

    const ack: VerificationAck = {
      requestId: body.requestId,
      status: "received",
      receivedAt,
    };
    return NextResponse.json(ack, { status: 200 });
  });
}
