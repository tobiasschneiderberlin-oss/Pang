/**
 * PANG — Drizzle client + schema barrel.
 *
 * Single instance per process. Server-side only — never import this
 * module from a Client Component (would leak DATABASE_URL into the
 * browser bundle, plus the postgres-js driver is Node-only).
 *
 * RLS-context note: this client connects with the role baked into
 * DATABASE_URL (the `postgres` superuser, via the Transaction Pooler).
 * That role bypasses RLS. For RLS-respecting queries we'll wire a
 * second client that runs as `authenticated` with the calling user's
 * JWT set via `set_config('request.jwt.claims', ...)`. Until that
 * lands, every read MUST be scoped by hand (e.g. `where(eq(collectors.id, userId))`).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "../env";
import * as schema from "./schema";

if (!serverEnv.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. The Drizzle client requires it — populate pang/.env.local or your environment.",
  );
}

// Single connection client — postgres-js manages a pool internally.
// Pooler-friendly settings:
//   - prepare: false (Supabase Transaction pooler doesn't support prepared statements)
//   - max: 1 in serverless (each invocation is its own process); 10 in long-running
const client = postgres(serverEnv.DATABASE_URL, {
  prepare: false,
  max: process.env["VERCEL"] ? 1 : 10,
});

export const db = drizzle(client, { schema });

export { schema };
export * from "./schema";
