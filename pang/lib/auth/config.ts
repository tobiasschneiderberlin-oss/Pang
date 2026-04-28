/**
 * PANG — auth configuration.
 *
 * Single source of truth for the passkey relying-party shape and the
 * secret material. Reads via the validated `serverEnv` object from
 * `lib/env.ts`; dev defaults are set here so the repo boots cold
 * without an `.env.local`. Production values are enforced by
 * `lib/env.ts`'s prod-only `superRefine`.
 *
 * Security rules:
 *   - `PANG_AUTH_INVITE_SECRET` and `PANG_AUTH_SESSION_SECRET` must
 *     differ — a compromised invite secret cannot forge a session
 *     cookie, and vice versa. Enforced by `lib/env.ts`.
 *   - Both secrets are ≥ 32 bytes of entropy. In dev a fixed test
 *     value is used so Playwright's virtual-authenticator walk is
 *     deterministic; that test value MUST NOT appear in prod.
 *   - The origin is read from the request in route handlers, NOT
 *     from this module — a misconfigured env var shouldn't let a
 *     forged origin slip through.
 */

import { isProduction, serverEnv } from "../env";

/**
 * Relying Party id (rpID) — must be a registrable domain suffix of
 * the origin. In dev: `localhost`. In prod: from env.
 */
export function getRpId(): string {
  return serverEnv.PANG_AUTH_RP_ID ?? "localhost";
}

/**
 * Relying Party display name — visible in the system passkey sheet.
 */
export function getRpName(): string {
  return serverEnv.PANG_AUTH_RP_NAME;
}

/**
 * Allowed origins for WebAuthn. The server accepts an assertion only
 * if the client-data origin matches one of these. Dev: localhost trio.
 * Prod: comma-separated list from env.
 */
export function getAllowedOrigins(): readonly string[] {
  const raw = serverEnv.PANG_AUTH_ORIGINS;
  if (raw && raw.length > 0) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
  ];
}

/**
 * Invite JWT HMAC secret. Rotated per deployment in prod. In dev a
 * fixed test key is used so Playwright can mint invites
 * deterministically. The test key is obviously a test key; never
 * trust this module's default in production.
 */
export function getInviteSecret(): Uint8Array {
  const raw =
    serverEnv.PANG_AUTH_INVITE_SECRET ??
    "dev-invite-secret-do-not-use-in-prod-32chars-min-dev-only";
  return new TextEncoder().encode(raw);
}

/**
 * Session HMAC secret. Same rules as the invite secret; must differ
 * from it (enforced by `lib/env.ts` in production).
 */
export function getSessionSecret(): Uint8Array {
  const raw =
    serverEnv.PANG_AUTH_SESSION_SECRET ??
    "dev-session-secret-do-not-use-in-prod-32chars-min-dev-only";
  return new TextEncoder().encode(raw);
}

/**
 * Session cookie name. Centralised so every reader uses one constant.
 */
export const SESSION_COOKIE_NAME = "pang_session";

/**
 * Bind-session cookie name — short-TTL, scoped to the enrollment
 * ceremony only.
 */
export const BIND_COOKIE_NAME = "pang_bind";

/** Session cookie max-age. 14 days. Rotated on every assert. */
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/** Bind cookie max-age. 10 minutes. */
export const BIND_MAX_AGE_SECONDS = 10 * 60;

/** Challenge TTL. 90 seconds. */
export const CHALLENGE_TTL_SECONDS = 90;

/** Invite JWT TTL (from sign). 14 days. */
export const INVITE_TTL_SECONDS = 14 * 24 * 60 * 60;

/**
 * Whether we're running under the E2E build. When true the
 * `__PANG.authSeed` seam is wired and the WebAuthn ceremony can be
 * bypassed via a direct session-creation call. Statically stripped
 * in production bundles.
 */
export function isE2EBuild(): boolean {
  return !isProduction && process.env["NEXT_PUBLIC_PANG_E2E"] === "1";
}
