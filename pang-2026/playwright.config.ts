/**
 * PANG — Playwright config.
 *
 * Tier 2 of the testing discipline upgrade (2026-04-23). The job:
 * catch visual + interaction regressions before they reach the
 * gallery link. No more "I changed the arrival chapter and the Room
 * regressed silently."
 *
 * Two modes:
 *
 *   1. Local (default): `npm run test:e2e` — spins up `next dev`
 *      and drives Chromium against localhost. Used in CI.
 *   2. Preview: `PANG_E2E_BASE_URL=https://<preview>.vercel.app
 *      npm run test:e2e` — skips the local server, hits the URL
 *      directly. Used ad-hoc after a Vercel preview deploy.
 *
 * Camera: specs that need the viewfinder pass the Chromium fake
 * media stream flags (`--use-fake-device-for-media-stream`) and a
 * canned JPEG so getUserMedia returns something the CV workers can
 * chew on without real hardware.
 */

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PANG_E2E_BASE_URL"] ?? "http://localhost:3000";

// Only spin up a local dev server when the base URL points at
// localhost. Against a preview URL, we skip the webServer clause.
const useLocalServer = baseURL.startsWith("http://localhost");

// Iter #9: the e2e-seam route requires a shared secret so specs can
// mint synthetic sessions against gated routes. Fixed dev fallback
// keeps local + CI deterministic; prod bundles with
// NEXT_PUBLIC_PANG_E2E unset bypass the seam regardless.
// `PANG_AUTH_INVITE_SECRET` is also set here so `signInvite` in the
// `/api/auth/invite/mint-dev` route produces deterministic JWTs for
// `passkey.spec.ts`. The folder names are `e2e-seam` + `mint-dev` (not
// `__e2e` / `__dev`) because Next.js app router treats `_`-prefixed
// folders as private and silently 404s them — see the route docstrings.
const DEV_E2E_TOKEN =
  process.env["PANG_AUTH_E2E_TOKEN"] ?? "pang-e2e-dev-token-0123456789abcdef";
const DEV_INVITE_SECRET =
  process.env["PANG_AUTH_INVITE_SECRET"] ??
  "pang-dev-invite-secret-do-not-use-in-prod-48chars";
// Plumb the values back into the test-runner environment so
// `e2e/support/auth.ts` can read them without the spec author
// having to set them manually on each CI job.
process.env["PANG_AUTH_E2E_TOKEN"] = DEV_E2E_TOKEN;
process.env["NEXT_PUBLIC_PANG_AUTH_E2E_TOKEN"] = DEV_E2E_TOKEN;

export default defineConfig({
  testDir: "./e2e",
  // Mobile-ish viewport by default — PANG is a PWA and the primary
  // shape is phone. Desktop regressions show up in the visual diff
  // on a separate project if we add one later.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  // CI pins workers to 2 for predictability; local leaves it to
  // Playwright's default (half the cores).
  ...(process.env["CI"] ? { workers: 2 } : {}),
  reporter: process.env["CI"]
    ? ([["github"], ["html", { open: "never" }]] as const)
    : ([["list"], ["html", { open: "never" }]] as const),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        // Fake media stream so viewfinder-touching specs don't need
        // real hardware. The canned video is a 1 s MJPEG loop.
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
        permissions: ["camera"],
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        // Camera flags mirror the mobile project. `scan.spec.ts` runs
        // on both projects; without the fake device, the viewfinder's
        // `getUserMedia` rejects on desktop and the test misreads the
        // camera failure as an upload failure. Headless Chrome respects
        // these flags identically regardless of desktop-vs-mobile
        // emulation, so the cost is zero for specs that never touch
        // `navigator.mediaDevices`.
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
        permissions: ["camera"],
      },
    },
  ],
  ...(useLocalServer
    ? {
        webServer: {
          // CI: pre-built by the workflow; run `next start` for parity
          // with Vercel prod behaviour. Local dev: `next dev` for HMR.
          command: process.env["CI"] ? "npm run start" : "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
          // next dev logs a lot; swallow unless the command fails.
          stdout: "ignore",
          stderr: "pipe",
          env: {
            // Expose `window.__PANG.useWorks` so specs can seed store
            // state without driving the scanner UI. Scoped to the e2e
            // webServer; prod bundles with NEXT_PUBLIC_PANG_E2E unset
            // ship no seed hook.
            NEXT_PUBLIC_PANG_E2E: "1",
            // Iter #9 auth seam credentials. `PANG_AUTH_E2E_TOKEN`
            // gates `/api/auth/e2e-seam` + `/api/auth/invite/mint-dev`.
            // `PANG_AUTH_INVITE_SECRET` is the HS256 key invite JWTs
            // are signed with — `mint-dev` reads it on sign, and
            // `/api/auth/invite/bind` verifies with the same key.
            PANG_AUTH_E2E_TOKEN: DEV_E2E_TOKEN,
            PANG_AUTH_INVITE_SECRET: DEV_INVITE_SECRET,
            ...(process.env["NEXT_PUBLIC_SUPABASE_HOST"]
              ? {
                  NEXT_PUBLIC_SUPABASE_HOST:
                    process.env["NEXT_PUBLIC_SUPABASE_HOST"],
                }
              : {}),
          },
        },
      }
    : {}),
});
