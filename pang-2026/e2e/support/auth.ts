/**
 * PANG — Playwright auth helper (iter #9).
 *
 * Every spec that hits a gated surface (anything behind
 * `requireSession`) needs a valid `pang_session` cookie before the
 * first navigation. The virtual-authenticator ceremony lives in
 * `passkey.spec.ts`; every other spec skips the ceremony by calling
 * `/api/auth/e2e-seam` (the synthetic-session seam) with the token the
 * config module reads from `PANG_AUTH_E2E_TOKEN`.
 *
 * The seam refuses unless:
 *   - `NEXT_PUBLIC_PANG_E2E === "1"` at server start (the webServer
 *     clause in playwright.config.ts sets this).
 *   - `PANG_AUTH_E2E_TOKEN` is set in the test-runner *and* server
 *     environments (see playwright.config.ts env plumbing).
 *
 * Call order: construct the browser context, then `await authSeed(page)`,
 * then `page.goto(...)`. The helper is a no-op on `authClear` if no
 * session exists.
 */

import { expect, type Page } from "@playwright/test";

/** Must match `SESSION_COOKIE_NAME` in `src/auth/config.ts`. */
export const SESSION_COOKIE_NAME = "pang_session";

function e2eToken(): string {
  const tok = process.env["PANG_AUTH_E2E_TOKEN"];
  if (!tok || tok.length < 16) {
    throw new Error(
      "PANG_AUTH_E2E_TOKEN must be set (≥ 16 chars) for Playwright auth helpers",
    );
  }
  return tok;
}

/**
 * Seed a synthetic session on the page. The response carries the
 * userId + expiresAt; most specs discard them, but the passkey flow
 * asserts against them.
 */
export async function authSeed(
  page: Page,
  opts: { readonly userId?: string } = {},
): Promise<{ userId: string; expiresAt: string }> {
  const res = await page.request.post("/api/auth/e2e-seam", {
    headers: { "x-pang-e2e": e2eToken() },
    data: opts.userId ? { action: "seed", userId: opts.userId } : { action: "seed" },
  });
  expect(
    res.ok(),
    `authSeed expected 200 from /api/auth/e2e-seam, got ${res.status()} — ` +
      `PANG_AUTH_E2E_TOKEN set on both server + runner?`,
  ).toBe(true);
  const json = (await res.json()) as {
    userId: string;
    method: string;
    expiresAt: string;
  };
  return { userId: json.userId, expiresAt: json.expiresAt };
}

/**
 * Clear the session cookie. The seam calls `revokeSession`, which
 * both deletes the store row and expires the cookie.
 */
export async function authClear(page: Page): Promise<void> {
  await page.request.post("/api/auth/e2e-seam", {
    headers: { "x-pang-e2e": e2eToken() },
    data: { action: "clear" },
  });
}
