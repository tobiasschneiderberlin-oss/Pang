/**
 * PANG — /api/auth/passkey/assert (iter #9).
 *
 * Verifies the authentication response, rotates the session, handles
 * clone detection (counter rollback → 410 + credential revoked).
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import { createSession } from "@/auth/server/session";
import { verifyAssert } from "@/auth/webauthn/verify";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("auth.passkey.assert", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/auth/passkey/assert");

    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.passkey.assert", ip);
    if (!limit.allowed) {
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

    await withOtelSpan("auth.passkey.assert.started", async () => {});

    const result = await verifyAssert({
      response: body as Parameters<typeof verifyAssert>[0]["response"],
    });

    if (!result.ok) {
      span.setAttribute("pang.auth.fail_reason", result.reason);
      await withOtelSpan("auth.passkey.assert.failed", async (fail) => {
        fail.setAttribute("pang.auth.reason", result.reason);
      });
      if (result.reason === "revoked" || result.reason === "clone-detected") {
        return NextResponse.json({ error: result.reason }, { status: 410 });
      }
      if (result.reason === "unknown-credential") {
        return NextResponse.json({ error: result.reason }, { status: 404 });
      }
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    const session = await createSession({
      userId: result.credential.userId,
      method: "passkey",
      credentialId: result.credential.credentialId,
    });

    await withOtelSpan("auth.passkey.assert.succeeded", async (su) => {
      su.setAttribute("pang.auth.user_id", session.userId);
      su.setAttribute("pang.auth.credential_id", result.credential.credentialId);
    });

    return NextResponse.json({
      userId: session.userId,
      method: session.method,
      createdAt: session.createdAt,
      rotatedAt: session.rotatedAt,
      expiresAt: session.expiresAt,
    });
  });
}
