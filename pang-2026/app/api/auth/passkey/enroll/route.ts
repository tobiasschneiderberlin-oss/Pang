/**
 * PANG — /api/auth/passkey/enroll (iter #9).
 *
 * Verifies the registration response, writes the credential, issues
 * the session cookie, closes the bind session. One atomic step from
 * the collector's perspective: biometric → in.
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import {
  consumeBindSession,
  createSession,
  readCurrentBindSession,
} from "@/auth/server/session";
import { verifyEnroll } from "@/auth/webauthn/verify";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("auth.passkey.enroll", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/auth/passkey/enroll");

    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.passkey.enroll", ip);
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

    const bind = await readCurrentBindSession();
    if (bind === null) {
      span.setAttribute("pang.auth.fail_reason", "no-bind");
      await withOtelSpan("auth.passkey.enroll.failed", async (fail) => {
        fail.setAttribute("pang.auth.reason", "no-bind");
      });
      return new Response(null, { status: 401 });
    }

    await withOtelSpan("auth.passkey.enroll.started", async (st) => {
      st.setAttribute("pang.auth.user_id", bind.userId);
      st.setAttribute("pang.auth.gallery_id", bind.galleryId);
    });

    const result = await verifyEnroll({
      // The body IS the RegistrationResponseJSON — SimpleWebAuthn
      // validates shape internally.
      response: body as Parameters<typeof verifyEnroll>[0]["response"],
      userId: bind.userId,
      userHandle: bind.userHandle,
      galleryId: bind.galleryId,
    });

    if (!result.ok) {
      span.setAttribute("pang.auth.fail_reason", result.reason);
      await withOtelSpan("auth.passkey.enroll.failed", async (fail) => {
        fail.setAttribute("pang.auth.reason", result.reason);
        fail.setAttribute("pang.auth.user_id", bind.userId);
      });
      const status = result.reason === "credential-exists" ? 409 : 400;
      return NextResponse.json({ error: result.reason }, { status });
    }

    const session = await createSession({
      userId: bind.userId,
      method: "passkey",
      credentialId: result.credential.credentialId,
    });

    // Close the bind ceremony.
    await consumeBindSession(bind.bindSessionToken);

    await withOtelSpan("auth.passkey.enroll.succeeded", async (su) => {
      su.setAttribute("pang.auth.user_id", bind.userId);
      su.setAttribute("pang.auth.credential_id", result.credential.credentialId);
      su.setAttribute("pang.auth.device_type", result.credential.credentialDeviceType);
      su.setAttribute("pang.auth.backed_up", result.credential.credentialBackedUp);
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
