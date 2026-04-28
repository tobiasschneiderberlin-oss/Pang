/**
 * PANG — Next.js root middleware.
 *
 * Runs on every matched request, refreshing the Supabase auth session
 * cookies before they expire. Without this, server components read a
 * stale session token and the user gets logged out mid-browse.
 *
 * Matcher excludes:
 *   - `/_next/static/*`     Next-internal static assets
 *   - `/_next/image/*`      Next image optimizer
 *   - `/favicon.ico`
 *   - common static media   (svg, png, jpg, gif, webp, ico, woff[2])
 *
 * Static assets don't need auth refresh and skipping them keeps
 * middleware overhead off the cache hot path.
 */

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
