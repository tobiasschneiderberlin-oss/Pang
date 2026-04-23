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
