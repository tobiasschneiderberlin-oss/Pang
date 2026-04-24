/**
 * PANG — `next/headers` mock for route-handler unit tests.
 *
 * Route handlers that call `requireSession()` transitively call
 * `cookies()` from `next/headers`, which requires a Next.js request
 * AsyncLocalStorage scope. Inside `node --test`, there is no such
 * scope — the direct `POST(request)` call blows up with
 * `"cookies was called outside a request scope"`.
 *
 * The test-runner is invoked with
 * `--experimental-test-module-mocks`, which makes
 * `node:test`'s `mock.module` available. This helper installs a
 * lightweight in-memory cookie jar as a drop-in replacement so the
 * route handler behaves exactly as if a request scope were present,
 * *and* the test can seed / assert on cookie state.
 *
 * Usage (must happen before the route is imported):
 *
 *   import { installNextHeadersMock } from "@/test/next-headers-mock";
 *   const jar = installNextHeadersMock();
 *   const { POST } = await import("./route");  // dynamic — picks up the mock
 *   jar.set("pang_session", "<hex token>");
 *
 * The mock also intercepts the write path (`store.set`, `store.delete`),
 * so a route that rotates or clears the cookie round-trips through
 * the jar and can be asserted on.
 */

import { mock } from "node:test";

export interface TestCookieJar {
  set(name: string, value: string): void;
  clear(): void;
  get(name: string): string | undefined;
  has(name: string): boolean;
  snapshot(): ReadonlyMap<string, string>;
}

interface CookieSetOpts {
  name: string;
  value: string;
  maxAge?: number;
}

/**
 * Install a mock for `next/headers` and return a handle to the
 * underlying cookie jar. Idempotent — calling twice in one process
 * replaces the jar and reinstalls the mock.
 */
export function installNextHeadersMock(): TestCookieJar {
  const jar = new Map<string, string>();

  mock.module("next/headers", {
    namedExports: {
      cookies: async () => ({
        get: (name: string) => {
          const v = jar.get(name);
          return v === undefined ? undefined : { name, value: v };
        },
        getAll: () =>
          Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
        set: (arg1: string | CookieSetOpts, arg2?: string) => {
          // Support both overloads: `set("name", "value")` and
          // `set({ name, value, maxAge })`.
          if (typeof arg1 === "string") {
            if (arg2 === undefined || arg2 === "") {
              jar.delete(arg1);
            } else {
              jar.set(arg1, arg2);
            }
            return;
          }
          // Object form. `maxAge: 0` is the clear-cookie convention.
          if (arg1.value === "" || arg1.maxAge === 0) {
            jar.delete(arg1.name);
          } else {
            jar.set(arg1.name, arg1.value);
          }
        },
        delete: (name: string) => {
          jar.delete(name);
        },
        has: (name: string) => jar.has(name),
      }),
      // `headers()` is not used by the auth path but we stub it so a
      // future caller doesn't trip the same scope error.
      headers: async () => new Map<string, string>(),
    },
  });

  return {
    set: (n, v) => jar.set(n, v),
    clear: () => jar.clear(),
    get: (n) => jar.get(n),
    has: (n) => jar.has(n),
    snapshot: () => new Map(jar),
  };
}
