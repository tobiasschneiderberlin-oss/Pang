/**
 * PANG — /api/auth/invite/mint-dev (iter #9, dev-only invite mint).
 *
 * In production, the gallery's dashboard mints invite JWTs via a
 * server-side helper we don't own yet (spine moment #7 is collector-
 * side; gallery-side mint is out-of-spine per the cannot-do list,
 * which is why no admin surface exists). For dev + E2E we need a way
 * to mint invites deterministically — this route does exactly that.
 *
 * Folder name is `mint-dev`, not `__dev` — Next.js app router treats
 * `_`-prefixed folders as private (not routable), so double-underscore
 * quietly 404s. The `mint-dev` spelling keeps the same enforcement
 * surface (env-gated + token-gated) without the routing collision.
 *
 * Gated identically to `/api/auth/e2e-seam`:
 *   - Only wired when `NEXT_PUBLIC_PANG_E2E === "1"`.
 *   - Requires `x-pang-e2e` header matching `PANG_AUTH_E2E_TOKEN`.
 */

import { NextResponse } from "next/server";
import { signInvite } from "@/auth/server/invite";
import { isE2EBuild } from "@/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorise(request: Request): boolean {
  if (!isE2EBuild()) return false;
  const token = process.env["PANG_AUTH_E2E_TOKEN"];
  if (!token || token.length < 16) return false;
  return request.headers.get("x-pang-e2e") === token;
}

export async function POST(request: Request): Promise<Response> {
  if (!authorise(request)) return new Response(null, { status: 404 });

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const galleryId =
    body !== null &&
    typeof body === "object" &&
    "galleryId" in body &&
    typeof (body as { galleryId?: unknown }).galleryId === "string"
      ? (body as { galleryId: string }).galleryId
      : "dev-gallery";

  const invite = await signInvite({ galleryId });
  return NextResponse.json({
    token: invite.jwt,
    jti: invite.claims.jti,
    userId: invite.claims.uid,
    userHandle: invite.claims.uhandle,
    galleryId: invite.claims.gid,
  });
}
