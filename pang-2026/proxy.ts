/**
 * PANG — edge proxy.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`;
 * the runtime + API are otherwise identical. One job: emit a
 * strict, nonce-based Content-Security-Policy on every HTML
 * navigation, and forward the nonce into the app via the `x-nonce`
 * request header so Next.js's own script tags pick it up
 * automatically (Next.js 16 + React 19.1 convention).
 *
 * Why the proxy, not `headers()` in next.config.ts:
 *   - Per-request nonces require per-request header construction.
 *     next.config.ts `headers()` is static.
 *   - Next.js 16's framework scripts (HMR in dev, streaming bootstrap
 *     in prod) are emitted by the framework itself. When the
 *     `x-nonce` request header is set by the proxy, Next.js writes
 *     `<script nonce="...">` on its own tags. No dev branch, no
 *     `'unsafe-inline'`, no CSP3 `strict-dynamic` override footgun.
 *
 * Gates:
 *   - P6 — strict CSP (no `'unsafe-inline'` / `'unsafe-eval'` on
 *     script-src; `'strict-dynamic'` present; `frame-ancestors 'none'`).
 *
 * See `PANG_Architecture_2026.md` § 8 and `PANG_Gates.md` § P6.
 */

import { NextResponse, type NextRequest } from "next/server";

export const config = {
  // Skip static assets and the service worker; everything else
  // (HTML navigations, RSC payloads, API routes on app/api/**)
  // goes through the nonce flow.
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|workbox-.*\\.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

const SUPABASE_HOST = process.env["NEXT_PUBLIC_SUPABASE_HOST"] ?? "";

/**
 * Build the CSP string for a given nonce. Kept as a pure function so
 * tests (and the P6 gate) can read it without an edge runtime.
 *
 * Directive shape (DS Chapter 08 · P6):
 *   - `script-src 'self' 'nonce-…' 'strict-dynamic'` — framework
 *     scripts carry the nonce; user-authored scripts that need to
 *     run must also carry it (a nonce + strict-dynamic drops the
 *     need for SHA-256 hashes on framework chunks).
 *   - `style-src 'self' 'nonce-…' https://fonts.googleapis.com` —
 *     Google Fonts stylesheet is the one external sheet; any
 *     in-HTML inline styles Next emits carry the same nonce.
 *   - `font-src 'self' https://fonts.gstatic.com` — woff2 origin.
 *   - `connect-src 'self' api.anthropic.com files.anthropic.com
 *     https://<project>.supabase.co wss://<project>.supabase.co`.
 *   - `frame-ancestors 'none'` — hard no on embedding.
 */
export function buildCsp(nonce: string): string {
  const connect = [
    "'self'",
    "https://api.anthropic.com",
    "https://files.anthropic.com",
    SUPABASE_HOST ? `https://${SUPABASE_HOST}` : "",
    SUPABASE_HOST ? `wss://${SUPABASE_HOST}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  // 128-bit random nonce, base64-encoded. Edge runtime ships a
  // Web Crypto `crypto.randomUUID()`; its output is already
  // unpredictable and high-entropy.
  const nonce = btoa(crypto.randomUUID() + crypto.randomUUID());

  const csp = buildCsp(nonce);

  // Forward the nonce into the app so Next.js's framework scripts
  // pick it up (`<script nonce="…">`), and `headers()` reads in the
  // root layout can stamp it onto any custom inline scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
