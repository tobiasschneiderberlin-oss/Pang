/**
 * PANG — Drizzle client + schema barrel.
 *
 * Server-side only — never import from a Client Component (would leak
 * DATABASE_URL into the browser bundle, and postgres-js is Node-only).
 *
 * RLS-context note: connects via the role in DATABASE_URL (the
 * `postgres` superuser through the Supabase Transaction Pooler), which
 * bypasses RLS. For RLS-respecting reads we'll wire a second client
 * that runs as `authenticated` with the caller's JWT set via
 * `set_config('request.jwt.claims', ...)`. Until that lands, scope
 * every read by hand (e.g. `where(eq(collectors.id, userId))`).
 *
 * ## Connection lifecycle
 *
 * On Vercel: every request opens a fresh client and closes it in a
 * `finally`. Pooling across Lambda invocations is unsafe — when the
 * function freezes, the Supabase pooler reaps idle TCP sockets at
 * ~30s, and on thaw postgres-js sees a "healthy" connection and hangs
 * forever waiting on the dead socket. We tried `idle_timeout` (depends
 * on the JS event loop, which is paused while frozen) and `keep_alive`
 * (kernel TCP keepalive, but defaults take ~12 minutes to declare a
 * socket dead) — both leaked timeouts in production. Per-request
 * connections cost ~150ms cold handshake but are deterministic.
 *
 * Off Vercel (local dev, seed scripts): a singleton is reused. Local
 * Postgres doesn't have the pooler-reap problem.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "../env";
import * as schema from "./schema";

if (!serverEnv.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. The Drizzle client requires it — populate pang/.env.local or your environment.",
  );
}

const isServerless = !!process.env["VERCEL"];

type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema>;

function makeClient() {
  return postgres(serverEnv.DATABASE_URL!, {
    prepare: false,
    max: isServerless ? 1 : 10,
    connect_timeout: 10,
  });
}

let cached: ReturnType<typeof postgres> | null = null;
function devClient() {
  cached ??= makeClient();
  return cached;
}

/**
 * Run a callback against a Drizzle client. On Vercel, opens a fresh
 * postgres-js connection per call and closes it in a `finally` — the
 * only reliable pattern across Lambda freeze/thaw cycles. In dev or
 * scripts, reuses a process-wide singleton.
 *
 * Always `await` the query inside the callback. If the callback
 * returns a non-awaited Drizzle builder, the connection closes before
 * the query runs.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  if (!isServerless) {
    return fn(drizzle(devClient(), { schema }));
  }
  const client = makeClient();
  try {
    return await fn(drizzle(client, { schema }));
  } finally {
    // Best-effort close; if the pooler already reaped the socket we
    // don't want a teardown error to bubble up over the real result.
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

export { schema };
export * from "./schema";
