/**
 * PANG — test helper for seeding a valid auth session.
 *
 * Route-handler unit tests that POST to a gated endpoint need both a
 * session record in the filesystem store *and* a cookie pointing at
 * that record on the mocked `next/headers` jar. Without this seam
 * every test would repeat the same 6-line boilerplate.
 *
 * Call order matters — the `next/headers` mock must be installed
 * first (so `installNextHeadersMock()` runs, then the route is
 * dynamically imported), and only then is `seedSession()` safe to
 * invoke inside `before` / `beforeEach`.
 */

import { newSessionToken, newUserId } from "@/auth/ids";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/auth/config";
import type { TestCookieJar } from "./next-headers-mock";
import type { SessionMethod, SessionRecord, UserRecord } from "@/auth/schema";
import { writeSession, writeUser } from "@/auth/server/store";

export interface SeededSession {
  readonly user: UserRecord;
  readonly session: SessionRecord;
}

/**
 * Write a fresh user + session pair and set the session cookie on
 * the mocked jar. Returns the records so tests can assert on ids.
 */
export async function seedSession(
  jar: TestCookieJar,
  opts: {
    readonly method?: SessionMethod;
    readonly galleryId?: string;
    readonly ttlMs?: number;
  } = {},
): Promise<SeededSession> {
  const now = new Date();
  const ttlMs = opts.ttlMs ?? SESSION_MAX_AGE_SECONDS * 1000;
  const user: UserRecord = {
    userId: newUserId(),
    // 22-char base64url — the user-handle shape.
    userHandle: "a".repeat(22),
    galleryId: opts.galleryId ?? "droste",
    createdAt: now.toISOString(),
  };
  await writeUser(user);
  const session: SessionRecord = {
    sessionToken: newSessionToken(),
    userId: user.userId,
    method: opts.method ?? "passkey",
    createdAt: now.toISOString(),
    rotatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    credentialId: null,
  };
  await writeSession(session);
  jar.set(SESSION_COOKIE_NAME, session.sessionToken);
  return { user, session };
}

/** Clear the cookie jar — caller still needs to reset the stores. */
export function clearSession(jar: TestCookieJar): void {
  jar.clear();
}
