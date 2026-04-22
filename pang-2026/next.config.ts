import type { NextConfig } from "next";

/**
 * PANG — Next.js 16 config.
 *
 * Security header policy lives in two places, by design:
 *
 *   - `proxy.ts` (Next.js 16's rename of the `middleware` file
 *     convention) emits the per-request CSP with a fresh nonce on
 *     every HTML navigation (the single path for dev + prod).
 *     Next.js's framework scripts read the `x-nonce` request header
 *     and stamp it onto their own `<script nonce="…">` tags, so
 *     there is no inline-script exception and no CSP3
 *     `strict-dynamic` override footgun.
 *
 *   - This file emits the static, non-nonce security headers that
 *     apply uniformly to every response (HSTS, Permissions-Policy,
 *     Referrer-Policy, COOP/CORP, X-Frame-Options, X-CTO) plus a
 *     baseline CSP skeleton for assets the proxy matcher skips
 *     (static chunks, icons, the service worker, the manifest).
 *     The proxy's CSP wins on HTML navigations — the response
 *     header is set last.
 *
 * Any header added here has a matching gate behind it — see
 * `PANG_Gates.md`.
 */

const SUPABASE_HOST = process.env["NEXT_PUBLIC_SUPABASE_HOST"] ?? "";

const ANTHROPIC_HOSTS = [
  "https://api.anthropic.com",
  "https://files.anthropic.com",
].join(" ");

const CONNECT_SRC = [
  "'self'",
  ANTHROPIC_HOSTS,
  SUPABASE_HOST ? `https://${SUPABASE_HOST}` : "",
  SUPABASE_HOST ? `wss://${SUPABASE_HOST}` : "",
]
  .filter(Boolean)
  .join(" ");

// Baseline CSP for static assets. `script-src 'self' 'strict-dynamic'`
// — no `'unsafe-inline'`, no `'unsafe-eval'`, no dev branch. The proxy
// emits a tighter nonce-based CSP on HTML navigations. Gate P6
// asserts this file contains `'strict-dynamic'`, `frame-ancestors 'none'`,
// and never `'unsafe-inline'` on a `script-src` directive.
const BASELINE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'strict-dynamic'",
  `connect-src ${CONNECT_SRC}`,
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' https://fonts.googleapis.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  // React Compiler — enabled once `babel-plugin-react-compiler` is
  // installed. Leaving off for the iteration-#1 scaffold avoids a
  // build-time resolution error; the compiler toggle flips on in a
  // follow-up commit with the dependency added.
  // reactCompiler: true,
  experimental: {
    // View Transitions API — cross-document transitions for Room ↔ Detail
    // and Viewfinder ↔ Arrival (Primitive §6).
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: BASELINE_CSP },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: [
              "camera=(self)",
              "geolocation=()",
              "microphone=()",
              "interest-cohort=()",
              "accelerometer=(self)",
              "publickey-credentials-get=(self)",
              "publickey-credentials-create=(self)",
            ].join(", "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Service worker must be served with no-cache so updates roll out.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // OpenCV.js worker is served from /workers/ but imported in Edge code.
    ];
  },
};

export default nextConfig;
