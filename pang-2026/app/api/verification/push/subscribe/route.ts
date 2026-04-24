/**
 * PANG — /api/verification/push/subscribe route.
 *
 * The endpoint that persists a collector's push subscription after
 * they opted in from the ask-gallery surface. The subscription is
 * tied to (`requestId`, `workId`); when the gallery answers the
 * request, the dispatch worker (iteration #7) reads the subscription
 * back out by `requestId`, sends the Declarative Web Push payload,
 * and deletes the record. We never keep a long-lived subscription
 * list per collector.
 *
 * Iteration #4 uses a filesystem-backed store under
 * `.pang/push-subs/<requestId>.json`, parallel to the verification
 * request outbox. The shape is deliberately trivial: a single JSON
 * file per requestId, idempotent on re-POST (same storedAt returned).
 *
 * Constraints:
 *   - `withOtelSpan("pang.api.verification.push.subscribe")` wraps the
 *     handler (A10).
 *   - Body size bounded at 4 kB — the subscription envelope is
 *     ~500 bytes; anything larger is adversarial.
 *   - Zod `.strict()` at the boundary; a schema miss returns 400.
 *   - Idempotency on `requestId` — a retry after network hiccup lands
 *     the same file. The original `storedAt` is returned.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withOtelSpan } from "@/lib/otel/span";
import {
  PushSubscribePayloadSchema,
  type PushSubscribeAck,
  type PushSubscribePayload,
} from "@/push/schema";
import { requireSession, UnauthenticatedError } from "@/auth/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

const PUSH_SUBS_DIR = path.resolve(process.cwd(), ".pang", "push-subs");

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan(
    "pang.api.verification.push.subscribe",
    async (span) => {
      span.setAttribute("http.method", "POST");
      span.setAttribute(
        "http.route",
        "/api/verification/push/subscribe",
      );

      // Auth gate (iter #9). Subscriptions are per-collector; a
      // missing session means the browser forgot the cookie or the
      // collector signed out — either way this is 401, no body.
      try {
        const session = await requireSession();
        span.setAttribute("pang.auth.user_id", session.userId);
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

      const parsed = PushSubscribePayloadSchema.safeParse(raw);
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
      const body: PushSubscribePayload = parsed.data;
      span.setAttribute("pang.verification.request_id", body.requestId);
      span.setAttribute("pang.verification.work_id", body.workId);

      try {
        await fs.mkdir(PUSH_SUBS_DIR, { recursive: true });
      } catch (err) {
        span.setAttribute("pang.error.kind", "mkdir");
        span.recordException(err);
        return NextResponse.json({ error: "internal" }, { status: 500 });
      }

      const targetPath = path.join(
        PUSH_SUBS_DIR,
        `${body.requestId}.json`,
      );

      // Idempotency: if a subscription for this requestId already
      // exists, echo the original `storedAt`. A retry under a flaky
      // network never creates a duplicate subscription.
      let dedupHit = false;
      let storedAt: string;
      try {
        const existing = await fs.readFile(targetPath, "utf8");
        const parsedExisting = JSON.parse(existing) as {
          storedAt?: unknown;
        };
        if (typeof parsedExisting.storedAt === "string") {
          storedAt = parsedExisting.storedAt;
          dedupHit = true;
        } else {
          storedAt = new Date().toISOString();
        }
      } catch (err) {
        if (
          err !== null &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code?: string }).code === "ENOENT"
        ) {
          storedAt = new Date().toISOString();
        } else {
          span.setAttribute("pang.error.kind", "read");
          span.recordException(err);
          return NextResponse.json(
            { error: "internal" },
            { status: 500 },
          );
        }
      }

      span.setAttribute("pang.verification.dedup_hit", dedupHit);

      if (!dedupHit) {
        const record = { subscription: body, storedAt };
        try {
          const tmpPath = `${targetPath}.tmp`;
          await fs.writeFile(tmpPath, JSON.stringify(record, null, 2), {
            encoding: "utf8",
          });
          await fs.rename(tmpPath, targetPath);
        } catch (err) {
          span.setAttribute("pang.error.kind", "write");
          span.recordException(err);
          return NextResponse.json(
            { error: "internal" },
            { status: 500 },
          );
        }
      }

      const ack: PushSubscribeAck = {
        requestId: body.requestId,
        status: "stored",
        storedAt,
      };
      return NextResponse.json(ack, { status: 200 });
    },
  );
}
