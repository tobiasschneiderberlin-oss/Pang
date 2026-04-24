/**
 * PANG — /api/auth/session (iter #9).
 *
 * Returns a narrow session reply for the cookie on the request, or
 * 401 with an empty body if there isn't one / it's invalid.
 *
 * Clients use this on cold start to decide between "already in" and
 * "needs to authenticate".
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import { readCurrentSession } from "@/auth/server/session";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";
import type { SessionReply } from "@/auth/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withOtelSpan("auth.session.route", async (span) => {
    span.setAttribute("http.method", "GET");
    span.setAttribute("http.route", "/api/auth/session");

    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.session.check", ip);
    if (!limit.allowed) {
      return new Response(null, { status: 429 });
    }

    const session = await readCurrentSession();
    if (session === null) {
      return new Response(null, { status: 401 });
    }

    const reply: SessionReply = {
      userId: session.userId,
      method: session.method,
      createdAt: session.createdAt,
      rotatedAt: session.rotatedAt,
      expiresAt: session.expiresAt,
    };
    return NextResponse.json(reply, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
