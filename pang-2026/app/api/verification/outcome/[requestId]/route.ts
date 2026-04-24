/**
 * PANG — /api/verification/outcome/[requestId] route (iter #10).
 *
 * The collector's reconciler polls this endpoint with an exponential
 * backoff after a dispatch lands in the `"dispatched"` store state. If
 * the gallery has confirmed or declined, the endpoint returns the
 * outcome and the reconciler flips the store. If nothing has landed,
 * the endpoint returns 204 No Content — a cheap signal the walker
 * tolerates without a parse.
 *
 * Why a separate GET and not a WebSocket / SSE: PANG's transport is
 * Declarative Web Push on the happy path; the poll is the fallback
 * for devices that refused push permission. Polling with a 204 cheap-
 * miss is a single-roundtrip primitive; SSE would introduce a long-
 * lived connection per collector for what is a weekly-cadence reality.
 *
 * Auth: collector session gate. A missing session returns 401 — the
 * reconciler runs inside the collector's own browser, so the session
 * is always present on the request. A 401 on the reconciler means the
 * collector's cookie evaporated; the client gracefully steps back.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { withOtelSpan } from "@/lib/otel/span";
import {
  VerificationOutcomeSchema,
  type VerificationOutcome,
} from "@/verification/schema";
import { requireSession, UnauthenticatedError } from "@/auth/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_OUTCOMES_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outcomes",
);

// ULID-shape guard — reject anything that doesn't match the regex.
// Defence in depth against a path-traversal attempt; Next.js' routing
// layer also sanitises.
const REQUEST_ID_SHAPE = /^[0-9a-z]+-[0-9a-z]+$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  return withOtelSpan("pang.api.verification.outcome", async (span) => {
    span.setAttribute("http.method", "GET");
    span.setAttribute("http.route", "/api/verification/outcome/[requestId]");

    try {
      const session = await requireSession();
      span.setAttribute("pang.auth.user_id", session.userId);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        return new Response(null, { status: 401 });
      }
      throw err;
    }

    const { requestId } = await context.params;
    if (!REQUEST_ID_SHAPE.test(requestId) || requestId.length > 40) {
      span.setAttribute("pang.error.kind", "bad_request_id");
      return NextResponse.json({ error: "bad_request_id" }, { status: 400 });
    }
    span.setAttribute("pang.verification.request_id", requestId);

    const target = path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(target, "utf8");
    } catch (err) {
      if (
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        span.setAttribute("pang.outcome.present", false);
        return new Response(null, { status: 204 });
      }
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      span.setAttribute("pang.error.kind", "bad_outcome_json");
      return NextResponse.json(
        { error: "bad_outcome_json" },
        { status: 500 },
      );
    }

    const result = VerificationOutcomeSchema.safeParse(parsed);
    if (!result.success) {
      span.setAttribute("pang.error.kind", "schema");
      return NextResponse.json(
        { error: "schema", detail: result.error.flatten() },
        { status: 500 },
      );
    }
    const outcome: VerificationOutcome = result.data;
    span.setAttribute("pang.outcome.present", true);
    span.setAttribute("pang.outcome.verdict", outcome.outcome);
    return NextResponse.json(outcome, { status: 200 });
  });
}
