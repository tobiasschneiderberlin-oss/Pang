/**
 * PANG — /scan smoke test.
 *
 * Tier 2 sentinel for the scanner surface. Covers the *structural*
 * contract without asserting against a real camera frame:
 *
 *   - The viewfinder mounts (canvas + capture button present).
 *   - The capture button's aria-label is what failure corpus /
 *     screen-readers expect.
 *   - The telemetry beacon fires on a forced failure (we stub the
 *     /api/intake response with a 413 and assert the page transitions
 *     to `failed` and beacons the right errorKey).
 *
 * The real Claude Vision round-trip lives in the A22 eval (Tier 3),
 * not here. E2E's job is the app shell, not the model.
 *
 * Runs on chromium-mobile (Pixel 7 emulation + fake media stream
 * via playwright.config.ts launch flags).
 */

import { expect, test } from "@playwright/test";

test.describe("scan — viewfinder surface", () => {
  test("mounts viewfinder with capture button", async ({ page }) => {
    await page.goto("/scan");

    // The viewfinder canvas carries aria-label="viewfinder" (see
    // src/components/scanner/Viewfinder.tsx).
    const viewfinder = page.getByLabel("viewfinder");
    await expect(viewfinder).toBeVisible({ timeout: 15_000 });

    const captureBtn = page.getByRole("button", { name: /capture/i });
    await expect(captureBtn).toBeVisible();
  });

  test("beacons telemetry on upload failure", async ({ page }) => {
    const beacons: Array<Record<string, unknown>> = [];

    // Capture any POST to /api/telemetry — the beacon lands here.
    await page.route("**/api/telemetry", async (route) => {
      const body = route.request().postData();
      if (body) {
        try {
          beacons.push(JSON.parse(body) as Record<string, unknown>);
        } catch {
          // Non-JSON telemetry is a bug; let the assertion fail
          // downstream rather than here.
        }
      }
      await route.fulfill({ status: 204 });
    });

    // Force /api/intake to 413 (Vercel body-limit shape) so the
    // scan page transitions to `failed` with errorKey
    // "upload/rejected".
    await page.route("**/api/intake", async (route) => {
      await route.fulfill({
        status: 413,
        contentType: "application/json",
        body: JSON.stringify({ error: "payload_too_large" }),
      });
    });

    await page.goto("/scan");
    await expect(page.getByLabel("viewfinder")).toBeVisible({
      timeout: 15_000,
    });

    // Trigger capture. The fake media stream may not produce a
    // real JPEG — but the capture path will still attempt the POST,
    // and our 413 stub short-circuits to the failed branch.
    const captureBtn = page.getByRole("button", { name: /capture/i });
    await captureBtn.click();

    // Wait for the failed state screen.
    const failed = page.getByLabel("failed");
    await expect(failed).toBeVisible({ timeout: 20_000 });

    // The reshoot button is the only action on that surface.
    await expect(
      page.getByRole("button", { name: /reshoot/i }),
    ).toBeVisible();

    // At least one beacon should have landed, carrying the
    // upload/rejected key.
    expect(beacons.length, "telemetry beacon fired").toBeGreaterThan(0);
    const last = beacons[beacons.length - 1];
    expect(last?.["errorKey"]).toBe("upload/rejected");
    expect(last?.["uploadStatus"]).toBe(413);
    expect(last?.["stage"]).toBe("uploading");
  });
});
