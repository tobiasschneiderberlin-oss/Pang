/**
 * PANG — Supabase browser client.
 *
 * Use from Client Components. Reads from the inlined `process.env`
 * (Next replaces NEXT_PUBLIC_* with literal strings at build time).
 *
 * Why direct process.env reads here, not via `lib/env.ts`:
 * `lib/env.ts` evaluates `serverEnv` at module load via Zod, and that
 * object includes server-only fields whose validation can fail in
 * the client bundle where those vars are stripped. Until `lib/env.ts`
 * is split into `env.server.ts` + `env.public.ts`, client code reads
 * NEXT_PUBLIC_* directly.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required to create a Supabase browser client",
    );
  }
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to create a Supabase browser client",
    );
  }

  return createBrowserClient(url, key);
}
