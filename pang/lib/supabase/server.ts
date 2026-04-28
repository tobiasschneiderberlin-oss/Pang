/**
 * PANG — Supabase server client.
 *
 * Use from Server Components, Server Actions, and Route Handlers.
 * Reads cookies via `next/headers` so the auth context flows from the
 * incoming request → Supabase. Respects RLS — never use this client
 * for admin operations that need to bypass policies. (For those, use
 * the future `lib/supabase/admin.ts` with the service-role key.)
 *
 * Adapted from the Supabase quickstart, with our `lib/env.ts`
 * conventions: env vars come from `serverEnv` / `publicEnv` (validated
 * at module load), not raw `process.env`.
 *
 * Note on the cookie setter: Server Components can read cookies but
 * not write them. The `try/catch` swallows that case — sessions are
 * still kept fresh by the Next root middleware (`pang/middleware.ts`)
 * which calls `lib/supabase/middleware.ts` on every request that
 * matches the matcher.
 */

import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";
import { publicEnv } from "../env";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function createClient(cookieStore: CookieStore) {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required to create a Supabase server client",
    );
  }
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to create a Supabase server client",
    );
  }

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot mutate cookies — swallowed
            // because the root middleware refreshes the session on
            // every request anyway.
          }
        },
      },
    },
  );
}
