/**
 * PANG — /api/auth/invite/bind (iter #9).
 *
 * The gallery's invite link redirects the collector to
 * `/i/<jwt>`; that client page calls this route on mount to trade
 * the JWT for a short-TTL bind cookie. The enrollment ceremony
 * reads the bind cookie on subsequent calls.
 *
 * Rules:
 *   - Tokens are single-use. We write the `.consumed` marker BEFORE
 *     issuing the bind cookie. A crash after the marker write
 *     correctly fails closed on retry ("this invite was used").
 *   - Shape of the reply carries no information beyond the bind
 *     acknowledgement. Replay or bad-jwt both return 409 with no
 *     body — no enumeration crumb.
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import {
  consumeBindSession,
  createBindSession,
  readCurrentBindSession,
} from "@/auth/server/session";
import {
  isInviteConsumed,
  markInviteConsumed,
} from "@/auth/server/store";
import {
  InviteVerifyError,
  verifyInvite,
} from "@/auth/server/invite";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("auth.invite.bind", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/auth/invite/bind");

    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.invite.bind", ip);
    if (!limit.allowed) {
      span.setAttribute("pang.auth.fail_reason", "rate-limited");
      return new Response(null, { status: 429 });
    }

    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    if (bodyText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "oversize" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }
    const jwt =
      body !== null &&
      typeof body === "object" &&
      "token" in body &&
      typeof (body as { token?: unknown }).token === "string"
        ? (body as { token: string }).token
        : null;
    if (jwt === null) {
      return NextResponse.json({ error: "missing_token" }, { status: 400 });
    }

    // Verify signature + expiry.
    let claims;
    try {
      claims = await verifyInvite(jwt);
    } catch (err) {
      if (err instanceof InviteVerifyError) {
        span.setAttribute("pang.auth.fail_reason", err.reason);
        await withOtelSpan("auth.invite.rejected", async (rj) => {
          rj.setAttribute("pang.auth.reason", err.reason);
        });
        return new Response(null, { status: 401 });
      }
      throw err;
    }

    // Single-use check.
    if (await isInviteConsumed(claims.jti)) {
      span.setAttribute("pang.auth.fail_reason", "replay");
      await withOtelSpan("auth.invite.rejected", async (rj) => {
        rj.setAttribute("pang.auth.reason", "replay");
      });
      return new Response(null, { status: 409 });
    }

    // Write the consumed marker BEFORE the bind cookie — replay
    // fails closed even if a crash hits between the two.
    await markInviteConsumed(claims.jti);

    const existingBind = await readCurrentBindSession();
    if (existingBind !== null) {
      // A previous incomplete ceremony — close it.
      await consumeBindSession(existingBind.bindSessionToken);
    }

    await createBindSession({
      userId: claims.uid,
      userHandle: claims.uhandle,
      galleryId: claims.gid,
      inviteJti: claims.jti,
    });

    await withOtelSpan("auth.invite.accepted", async (ac) => {
      ac.setAttribute("pang.auth.gallery_id", claims.gid);
      ac.setAttribute("pang.auth.user_id", claims.uid);
    });

    span.setAttribute("pang.auth.user_id", claims.uid);
    span.setAttribute("pang.auth.gallery_id", claims.gid);
    return NextResponse.json({
      userId: claims.uid,
      userHandle: claims.uhandle,
      galleryId: claims.gid,
    });
  });
}
