/**
 * PANG — telemetry endpoint regression.
 *
 * Asserts /api/telemetry behaves per contract:
 *   - Accepts a valid beacon body → 204.
 *   - Rejects oversize bodies silently → 204 (never surfaces a
 *     second failure to the client).
 *   - Rejects schema-invalid payloads silently → 204.
 *
 * No browser; direct HTTP. Keeps the contract honest against both
 * dev-server and preview-URL runs.
 */

import { expect, test } from "@playwright/test";

test.describe("/api/telemetry contract", () => {
  test("accepts a valid failure beacon and returns 204", async ({
    request,
  }) => {
    const res = await request.post("/api/telemetry", {
      data: {
        errorKey: "upload/offline",
        stage: "uploading",
        site: "e2e/happy-path",
        detail: "fake offline",
      },
    });
    expect(res.status()).toBe(204);
  });

  test("schema-invalid payload returns 204 without error", async ({
    request,
  }) => {
    const res = await request.post("/api/telemetry", {
      data: { not: "a beacon" },
    });
    expect(res.status()).toBe(204);
  });

  test("oversize body returns 204 without error", async ({ request }) => {
    const big = "x".repeat(8 * 1024);
    const res = await request.post("/api/telemetry", {
      data: { errorKey: "upload/offline", stage: "uploading", detail: big },
    });
    expect(res.status()).toBe(204);
  });
});
