/**
 * PANG — auth configuration (iter #9).
 *
 * Single source of truth for the passkey relying-party shape and the
 * secret material. Reads from `process.env`; dev defaults are set
 * here so the repo boots cold without an `.env.local`. Production
 * reads the real values from Vercel env.
 *
 * Security rules:
 *   - `PANG_AUTH_INVITE_SECRET` and `PANG_AUTH_SESSION_SECRET` must
 *     differ — a compromised invite secret cannot forge a session
 *     cookie, and vice versa.
 *   - Both secrets are ≥ 32 bytes of entropy. In dev we use fixed
 *     test values so the Playwright virtual-authenticator walk is
 *     deterministic; those test values MUST NOT appear in prod.
 *   - The origin is read from the request in the route handlers,
 *     NOT from this module — a misconfigured env var shouldn't let
 *     a forged origin slip through.
 */

/**
 * Relying Party id (rpID) — must be a registrable domain suffix of
 * the origin. In dev we hard-code `localhost`. In prod we read
 * `PANG_AUTH_RP_ID`.
 */
export function getRpId(): string {
  const env = process.env["PANG_AUTH_RP_ID"];
  if (env && env.length > 0) return env;
  return "localhost";
}

/**
 * Relying Party display name — visible in the system passkey sheet.
 */
export function getRpName(): string {
  return process.env["PANG_AUTH_RP_NAME"] ?? "PANG";
}

/**
 * Allowed origins for WebAuthn. The server accepts an assertion only
 * if the client-data origin matches one of these. In dev: localhost
 * with the default Next.js port + the dev-device HTTPS port. In
 * prod: a single origin from env.
 */
export function getAllowedOrigins(): readonly string[] {
  const env = process.env["PANG_AUTH_ORIGINS"];
  if (env && env.length > 0) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:3000",
  ];
}

/**
 * Invite JWT HMAC secret. Rotated per deployment in prod. In dev a
 * fixed test key is used so Playwright can mint invites deterministic
 * ally.
 *
 * The test key is obviously a test key; never trust this module's
 * default in production.
 */
export function getInviteSecret(): Uint8Array {
  const env = process.env["PANG_AUTH_INVITE_SECRET"];
  const raw = env && env.length >= 32
    ? env
    : "dev-invite-secret-do-not-use-in-prod-32chars-min-dev-only";
  return new TextEncoder().encode(raw);
}

/**
 * Session cookie name. Centralised so every reader (the
 * `requireSession` helper, the logout route, the E2E seam) uses one
 * string constant.
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

/** Invite JWT TTL (from sign). 14 days — galleries can send the link and it works next week. */
export const INVITE_TTL_SECONDS = 14 * 24 * 60 * 60;

/**
 * Whether we're running under the E2E build. When true the
 * `__PANG.authSeed` seam is wired and the WebAuthn ceremony can be
 * bypassed via a direct session-creation call. Statically stripped in
 * production bundles.
 */
export function isE2EBuild(): boolean {
  return process.env["NEXT_PUBLIC_PANG_E2E"] === "1";
}
