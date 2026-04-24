/**
 * PANG — /api/verification/mint-dev (iter #10, dev-only).
 *
 * Mints a signed link for a verification confirm or decline so the
 * Playwright specs (and local dev flows) can exercise the real
 * `/api/verification/confirm` + `/api/verification/decline` routes
 * end-to-end without standing up a dispatch flow each time.
 *
 * Gated identically to `/api/auth/invite/mint-dev`: env flag +
 * bearer header. In production the gallery's dashboard mints the
 * signed links via `dispatch/route.ts`; this surface is strictly a
 * test harness and vanishes when `NEXT_PUBLIC_PANG_E2E` is off.
 */

import { NextResponse } from "next/server";
import { signSignedLink } from "@/auth/server/signed-link";
import { isE2EBuild } from "@/auth/config";
import { newRequestId } from "@/verification/schema";

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

  const raw = body as {
    audience?: unknown;
    galleryId?: unknown;
    workId?: unknown;
    verificationRequestId?: unknown;
  };

  const audience =
    raw.audience === "gallery-decline" ? "gallery-decline" : "gallery-confirm";
  const galleryId =
    typeof raw.galleryId === "string" && raw.galleryId.length > 0
      ? raw.galleryId
      : "dev-gallery";
  const workId =
    typeof raw.workId === "string" && raw.workId.length > 0
      ? raw.workId
      : "w-e2e";
  const verificationRequestId =
    typeof raw.verificationRequestId === "string" &&
    raw.verificationRequestId.length > 0
      ? raw.verificationRequestId
      : newRequestId();

  const { jwt } = await signSignedLink({
    audience,
    galleryId,
    verificationRequestId,
    workId,
  });

  return NextResponse.json({
    token: jwt,
    audience,
    galleryId,
    workId,
    verificationRequestId,
  });
}
