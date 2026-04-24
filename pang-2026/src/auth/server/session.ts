/**
 * PANG — session helpers (iter #9).
 *
 * The single source of truth on the server for session lifecycle.
 * Every non-public API route calls `requireSession(request)` at the
 * top. The filesystem-backed store is the dev stand-in; Supabase
 * replaces it without the call-site changing.
 *
 * Security rules:
 *   - Session tokens are 32-byte CSPRNG, hex-encoded. Opaque bearer
 *     — not a JWT — because server-side state is a hard requirement
 *     for real revocation.
 *   - Cookies are HttpOnly + Secure + SameSite=Strict + Path=/.
 *   - On every successful assert the session token rotates. An
 *     attacker with a stolen cookie is invalidated the moment the
 *     collector authenticates again.
 *   - The lookup path is constant-shape: sanitise → file stat → file
 *     read. No scan, no enumeration. A forged token with correct
 *     shape but unknown value is indistinguishable from a revoked
 *     session.
 */

import { cookies } from "next/headers";
import { withOtelSpan, type Span } from "@/lib/otel/span";
import {
  BIND_COOKIE_NAME,
  BIND_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../config";
import { newBindSessionToken, newSessionToken } from "../ids";
import {
  BindSessionRecordSchema,
  SessionMethodSchema,
  SessionRecordSchema,
  UserIdSchema,
  type BindSessionRecord,
  type SessionMethod,
  type SessionRecord,
} from "../schema";
import {
  deleteBindSession,
  deleteSession,
  readBindSession,
  readSession,
  writeBindSession,
  writeSession,
} from "./store";

// ---------- Errors -------------------------------------------------

export class UnauthenticatedError extends Error {
  constructor(readonly reason: string = "no-session") {
    super(reason);
    this.name = "UnauthenticatedError";
  }
}

// ---------- Cookie I/O --------------------------------------------

interface CookieOptions {
  readonly name: string;
  readonly value: string;
  readonly maxAgeSeconds: number;
}

async function setCookieOnServer(opts: CookieOptions): Promise<void> {
  const store = await cookies();
  store.set({
    name: opts.name,
    value: opts.value,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: opts.maxAgeSeconds,
  });
}

async function clearCookieOnServer(name: string): Promise<void> {
  const store = await cookies();
  store.set({
    name,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 0,
  });
}

async function readCookieOnServer(name: string): Promise<string | null> {
  const store = await cookies();
  const value = store.get(name)?.value;
  return value ?? null;
}

// ---------- Create / rotate / revoke ------------------------------

export interface CreateSessionInput {
  readonly userId: string;
  readonly method: SessionMethod;
  readonly credentialId: string | null;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<SessionRecord> {
  return withOtelSpan("auth.session.created", async (span) => {
    const userId = UserIdSchema.parse(input.userId);
    const method = SessionMethodSchema.parse(input.method);
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
    const record: SessionRecord = SessionRecordSchema.parse({
      sessionToken: newSessionToken(),
      userId,
      method,
      createdAt: now.toISOString(),
      rotatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      credentialId: input.credentialId,
    });
    await writeSession(record);
    await setCookieOnServer({
      name: SESSION_COOKIE_NAME,
      value: record.sessionToken,
      maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    });
    span.setAttribute("pang.auth.user_id", userId);
    span.setAttribute("pang.auth.method", method);
    return record;
  });
}

export async function rotateSession(
  current: SessionRecord,
): Promise<SessionRecord> {
  return withOtelSpan("auth.session.rotated", async (span) => {
    // Write the new record before deleting the old one so a crash
    // between the two leaves a valid session in place.
    const now = new Date();
    const expires = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
    const next: SessionRecord = SessionRecordSchema.parse({
      ...current,
      sessionToken: newSessionToken(),
      rotatedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    });
    await writeSession(next);
    await deleteSession(current.sessionToken);
    await setCookieOnServer({
      name: SESSION_COOKIE_NAME,
      value: next.sessionToken,
      maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    });
    span.setAttribute("pang.auth.user_id", next.userId);
    return next;
  });
}

export async function revokeSession(sessionToken: string): Promise<void> {
  await withOtelSpan("auth.session.revoked", async () => {
    await deleteSession(sessionToken);
    await clearCookieOnServer(SESSION_COOKIE_NAME);
  });
}

// ---------- Read / require ----------------------------------------

/**
 * Read the current session off the request's cookie jar. Returns
 * `null` if there's no session or if the cookie points at a record
 * that doesn't exist or is expired.
 *
 * Constant-shape lookup: the cookie value passes through a strict
 * regex (enforced in `readSession`); the store read is a stat + read
 * on a known path; a missing file returns null without iteration.
 */
export async function readCurrentSession(): Promise<SessionRecord | null> {
  return withOtelSpan("auth.session.check", async (span) => {
    const token = await readCookieOnServer(SESSION_COOKIE_NAME);
    if (token === null) {
      span.setAttribute("pang.auth.cache_status", "miss");
      span.setAttribute("pang.auth.miss_reason", "no-cookie");
      return null;
    }
    const record = await readSession(token);
    if (record === null) {
      span.setAttribute("pang.auth.cache_status", "miss");
      span.setAttribute("pang.auth.miss_reason", "unknown-token");
      return null;
    }
    if (Date.parse(record.expiresAt) < Date.now()) {
      span.setAttribute("pang.auth.cache_status", "miss");
      span.setAttribute("pang.auth.miss_reason", "expired");
      // Best-effort clean up. A crash here is recoverable.
      await deleteSession(token);
      return null;
    }
    span.setAttribute("pang.auth.cache_status", "hit");
    span.setAttribute("pang.auth.user_id", record.userId);
    span.setAttribute("pang.auth.method", record.method);
    return record;
  });
}

/**
 * Require a valid session for the request. Throws
 * `UnauthenticatedError` if missing — callers should convert to a
 * 401 response with an empty body (no enumeration crumb). Used at
 * the top of every non-public API route.
 */
export async function requireSession(): Promise<SessionRecord> {
  const record = await readCurrentSession();
  if (record === null) throw new UnauthenticatedError("no-session");
  return record;
}

/**
 * Wrap a route handler in the auth gate. Any uncaught
 * `UnauthenticatedError` is caught here and turned into a 401.
 *
 * `handler` receives the session record; the caller doesn't need to
 * re-read it.
 */
export async function withRequireSession<T extends Response>(
  handler: (session: SessionRecord, span: Span) => Promise<T>,
  spanName: string,
): Promise<Response> {
  return withOtelSpan(spanName, async (span) => {
    let session: SessionRecord;
    try {
      session = await requireSession();
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        span.setAttribute("pang.auth.cache_status", "miss");
        span.setAttribute("pang.auth.miss_reason", err.reason);
        // 401, empty body. No "who are you" crumb.
        return new Response(null, { status: 401 });
      }
      throw err;
    }
    span.setAttribute("pang.auth.user_id", session.userId);
    return handler(session, span);
  });
}

// ---------- Bind session ------------------------------------------

export interface CreateBindSessionInput {
  readonly userId: string;
  readonly userHandle: string;
  readonly galleryId: string;
  readonly inviteJti: string;
}

export async function createBindSession(
  input: CreateBindSessionInput,
): Promise<BindSessionRecord> {
  const now = new Date();
  const expires = new Date(now.getTime() + BIND_MAX_AGE_SECONDS * 1000);
  const record: BindSessionRecord = BindSessionRecordSchema.parse({
    bindSessionToken: newBindSessionToken(),
    inviteJti: input.inviteJti,
    userId: UserIdSchema.parse(input.userId),
    userHandle: input.userHandle,
    galleryId: input.galleryId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  await writeBindSession(record);
  await setCookieOnServer({
    name: BIND_COOKIE_NAME,
    value: record.bindSessionToken,
    maxAgeSeconds: BIND_MAX_AGE_SECONDS,
  });
  return record;
}

export async function readCurrentBindSession(): Promise<BindSessionRecord | null> {
  const token = await readCookieOnServer(BIND_COOKIE_NAME);
  if (token === null) return null;
  const record = await readBindSession(token);
  if (record === null) return null;
  if (Date.parse(record.expiresAt) < Date.now()) {
    await deleteBindSession(token);
    return null;
  }
  return record;
}

export async function consumeBindSession(bindSessionToken: string): Promise<void> {
  await deleteBindSession(bindSessionToken);
  await clearCookieOnServer(BIND_COOKIE_NAME);
}
