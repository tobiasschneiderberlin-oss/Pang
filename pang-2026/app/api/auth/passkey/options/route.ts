/**
 * PANG — /api/auth/passkey/options (iter #9).
 *
 * Issues PublicKeyCredentialCreationOptions (enroll) or
 * PublicKeyCredentialRequestOptions (assert). The challenge is
 * stored server-side (one-use, TTL 90s); the request carries the
 * purpose.
 *
 * Enroll: requires a live bind cookie from `/api/auth/invite/bind`.
 * Assert: no cookie required — conditional UI works cookie-less.
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import { readCurrentBindSession } from "@/auth/server/session";
import {
  mintAssertOptions,
  mintEnrollOptions,
} from "@/auth/webauthn/options";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withOtelSpan("auth.passkey.options", async (span) => {
    span.setAttribute("http.method", "GET");
    span.setAttribute("http.route", "/api/auth/passkey/options");

    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.passkey.options", ip);
    if (!limit.allowed) {
      return new Response(null, { status: 429 });
    }

    const url = new URL(request.url);
    const purpose = url.searchParams.get("purpose");
    if (purpose !== "enroll" && purpose !== "assert") {
      return NextResponse.json({ error: "bad_purpose" }, { status: 400 });
    }
    span.setAttribute("pang.auth.purpose", purpose);

    // Force no-store on every reply — challenges are one-use, never
    // served from a cache.
    const headers = { "Cache-Control": "no-store" };

    if (purpose === "enroll") {
      const bind = await readCurrentBindSession();
      if (bind === null) {
        span.setAttribute("pang.auth.fail_reason", "no-bind");
        return new Response(null, { status: 401, headers });
      }
      const { options } = await mintEnrollOptions({
        userId: bind.userId,
        userHandle: bind.userHandle,
        bindSessionToken: bind.bindSessionToken,
      });
      return NextResponse.json(options, { headers });
    }

    // Assert: conditional UI; no allow-list (discoverable only).
    const { options } = await mintAssertOptions({
      allowCredentialIds: [],
    });
    return NextResponse.json(options, { headers });
  });
}
