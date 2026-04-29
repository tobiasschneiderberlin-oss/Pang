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
// Pooler-friendly settings for Vercel + Supabase transaction pooler:
//
//   - prepare: false        Supabase transaction pooler rejects prepared statements.
//   - max: 1 on Vercel      Each Lambda invocation is its own process.
//   - keep_alive: 30        THE fix for dead-socket-after-thaw. Vercel
//                           freezes the Lambda after a request; the pooler
//                           reaps the TCP socket at ~30s of inactivity;
//                           postgres-js's JS-level idle_timeout never fires
//                           because the event loop is paused while frozen.
//                           Setting `keep_alive` enables kernel-level TCP
//                           keepalive — the kernel sends probes after 30s
//                           idle, gets RST from the dead pooler socket, and
//                           the next query fails fast with ECONNRESET
//                           (postgres-js auto-reconnects on transient errors)
//                           instead of hanging until the function-execution
//                           ceiling. Symptom before this fix: /collection
//                           cold requests timing out at 300s.
//   - connect_timeout: 10   Never block more than 10s on initial handshake.
//   - idle_timeout: 20      Defence-in-depth: when the Lambda IS running,
//                           close idle conns proactively before the pooler does.
const client = postgres(serverEnv.DATABASE_URL, {
  prepare: false,
  max: process.env["VERCEL"] ? 1 : 10,
  keep_alive: 30,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export { schema };
export * from "./schema";
