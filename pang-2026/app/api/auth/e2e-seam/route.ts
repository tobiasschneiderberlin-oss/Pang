/**
 * PANG — /api/auth/e2e-seam (iter #9, E2E auth-bypass seam).
 *
 * Playwright cannot drive real biometric prompts; the chromium
 * WebAuthn virtual authenticator covers enroll + assert in
 * `passkey.spec.ts`, but the iter #2–#8 specs pre-date auth and need
 * to reach gated surfaces without the ceremony. This seam lets them
 * mint a session in one round-trip.
 *
 * Folder name is `e2e-seam`, not `__e2e` — Next.js app router treats
 * `_`-prefixed folders as private (not routable), so the underscore
 * spelling quietly 404s. The current name keeps the same enforcement
 * surface without the routing collision.
 *
 * Security posture:
 *   - The route is wired only when `NEXT_PUBLIC_PANG_E2E === "1"`.
 *     Production bundles don't set that var, so the route returns
 *     404 at runtime (the build still compiles the module — a static
 *     strip would complicate the dev ergonomics; the 404 is the
 *     enforcement).
 *   - Even when wired, the route refuses unless
 *     `PANG_AUTH_E2E_TOKEN` is set AND the request carries a matching
 *     `x-pang-e2e` header. Local dev + CI share this; prod never
 *     does. A forgotten `PANG_AUTH_E2E_TOKEN` in prod leaves the
 *     seam unreachable.
 *   - The session it creates uses `method: "e2e-seam"` so spans /
 *     analytics can distinguish synthetic sessions from real ones.
 */

import { NextResponse } from "next/server";
import { withOtelSpan } from "@/lib/otel/span";
import { createSession, revokeSession } from "@/auth/server/session";
import { isE2EBuild, SESSION_COOKIE_NAME } from "@/auth/config";
import { cookies } from "next/headers";
import { newUserId } from "@/auth/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorise(request: Request): boolean {
  if (!isE2EBuild()) return false;
  const token = process.env["PANG_AUTH_E2E_TOKEN"];
  if (!token || token.length < 16) return false;
  const header = request.headers.get("x-pang-e2e");
  return header === token;
}

export async function POST(request: Request): Promise<Response> {
  if (!authorise(request)) {
    // 404 not 401 — if the seam is off, the route doesn't exist.
    return new Response(null, { status: 404 });
  }

  return withOtelSpan("auth.e2e.seed", async (span) => {
    let body: unknown;
    try {
      const text = await request.text();
      body = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    const action =
      body !== null &&
      typeof body === "object" &&
      "action" in body &&
      typeof (body as { action?: unknown }).action === "string"
        ? (body as { action: string }).action
        : "seed";

    if (action === "clear") {
      const store = await cookies();
      const token = store.get(SESSION_COOKIE_NAME)?.value;
      if (token) await revokeSession(token);
      return new Response(null, { status: 204 });
    }

    // action === "seed" — create a synthetic session.
    const suppliedUserId =
      body !== null &&
      typeof body === "object" &&
      "userId" in body &&
      typeof (body as { userId?: unknown }).userId === "string"
        ? (body as { userId: string }).userId
        : null;
    const userId = suppliedUserId && /^u_[A-Za-z0-9]{22}$/.test(suppliedUserId)
      ? suppliedUserId
      : newUserId();
    const session = await createSession({
      userId,
      method: "e2e-seam",
      credentialId: null,
    });
    span.setAttribute("pang.auth.user_id", userId);
    return NextResponse.json({
      userId: session.userId,
      method: session.method,
      expiresAt: session.expiresAt,
    });
  });
}
