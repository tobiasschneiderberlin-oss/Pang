/**
 * PANG — Supabase session-refresh middleware client.
 *
 * Called by the Next root middleware (`pang/middleware.ts`) on every
 * request the matcher allows. Reads + writes the auth cookies on the
 * NextResponse that's returned, so the Supabase session token rolls
 * over before it expires while the user is browsing.
 *
 * IMPORTANT (per Supabase docs): you must always call
 * `supabase.auth.getUser()` before passing the response back. The
 * cookies are only refreshed during the call — without it, the
 * response goes out with stale cookies and the user gets logged out
 * mid-session.
 *
 * Future hookups:
 *   - Once we have an auth flow, the redirect-to-login logic for
 *     `(app)/*` routes lives here (compare `user === null` and 302
 *     to `/auth/login` if the path is auth-gated).
 *   - The redirect logic should NOT touch `/auth/*`, `/onboarding`,
 *     or `/_next/*` — currently excluded via the matcher in
 *     `pang/middleware.ts`.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // No Supabase configured (dev startup before .env.local is filled in
  // or a CI build with placeholder env): skip the refresh and let the
  // request through unchanged.
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Required: triggers Supabase to refresh the session cookies if
  // they're near expiry. The user object itself is intentionally
  // unused here — gating happens elsewhere.
  await supabase.auth.getUser();

  return supabaseResponse;
}
