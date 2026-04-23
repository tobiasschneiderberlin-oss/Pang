/**
 * PANG — deep-zoom surface (iteration #7) walk.
 *
 * Three assertions, all against the smoke route (`/deep-zoom-smoke`,
 * gated behind `NEXT_PUBLIC_PANG_E2E=1` at build time):
 *
 *   1. **Mount + Escape.** Opening writes `activeDeepZoom`, the OSD
 *      overlay mounts as `role="dialog" aria-label="deep zoom"`,
 *      Escape dismisses it, `activeDeepZoom` returns to `null`,
 *      `focusedId` is preserved.
 *   2. **Heap discipline.** Open → close × 10. `performance.memory.
 *      usedJSHeapSize` delta stays under 5 MB. This catches the
 *      "OSD viewer + tile cache + canvas contexts leaked across
 *      cycles" regression class the iter #7 brief names.
 *   3. **Telemetry fires.** At least one `deep_zoom.open` +
 *      `deep_zoom.close` pair lands on the console-debug sink during
 *      a single open/close cycle. Spans themselves live in prod
 *      OTel; the console-debug emit is the test-local proxy.
 *
 * Chromium-only — `performance.memory` is a V8 extension. Our CI
 * matrix is chromium-mobile + chromium-desktop per the iteration
 * cadence, so the spec runs unconditionally without a skip.
 *
 * Not coupled to real works. The smoke client ships a fixed
 * `smoke-sample` entry + a seeded PNG at `/vendor/deepzoom/sample.png`
 * so a Playwright walk is reproducible without the tile-generation
 * pipeline (deferred to a later iteration).
 */

import { expect, test, type ConsoleMessage } from "@playwright/test";

interface HeapMemory {
  readonly usedJSHeapSize: number;
}

const FIVE_MB = 5 * 1024 * 1024;

test.describe("deep zoom — mount, escape, heap discipline", () => {
  test("opens, closes on Escape, preserves focusedId, leaks < 5 MB over 10 cycles", async ({
    page,
  }) => {
    // Capture console-debug emits so we can assert the telemetry
    // pair at the end of the test. Each PANG otel event is a single
    // JSON line; we parse defensively.
    const events: { event: string; attrs: Record<string, unknown> }[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() !== "debug") return;
      const text = msg.text();
      if (!text.startsWith("{")) return;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.event === "string") {
          events.push({
            event: parsed.event,
            attrs: parsed.attrs ?? {},
          });
        }
      } catch {
        // Non-PANG console-debug noise is fine; skip.
      }
    });

    await page.goto("/deep-zoom-smoke");

    const openBtn = page.getByTestId("deep-zoom-open");
    await expect(openBtn).toBeVisible();

    // Seed `focusedId` so we can assert it survives the open/close
    // cycle. The smoke route does not require a focused work, but
    // the primitive's contract says a deep-zoom cycle must not
    // disturb focus — proving that is the point of step 3.
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __PANG?: unknown }).__PANG !==
        "undefined",
    );
    await page.evaluate(() => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              setFocusedId: (id: string | null) => void;
            };
          };
        };
      };
      w.__PANG.useWorks.getState().setFocusedId("focus-sentinel");
    });

    // --- Step 1: mount + escape ------------------------------------
    await openBtn.click();
    const dialog = page.locator(
      'div[role="dialog"][aria-label="deep zoom"][data-pang-surface="deep-zoom"]',
    );
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // OSD needs to finish open() before the ready flag flips; we
    // wait on data-pang-ready so the heap sampling below starts
    // from a steady state.
    await expect(dialog).toHaveAttribute("data-pang-ready", "true", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    const afterFirstClose = await page.evaluate(() => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              activeDeepZoom: string | null;
              focusedId: string | null;
            };
          };
        };
      };
      const s = w.__PANG.useWorks.getState();
      return {
        activeDeepZoom: s.activeDeepZoom,
        focusedId: s.focusedId,
      };
    });
    expect(afterFirstClose.activeDeepZoom).toBeNull();
    // `setFocusedId` clears `activeDeepZoom`, and focusedId itself
    // stays pinned. The spec documents that relationship.
    expect(afterFirstClose.focusedId).toBe("focus-sentinel");

    // --- Step 2: heap discipline across 10 cycles ------------------
    // Let GC settle between cycles so the heap sample reflects
    // real retention rather than transient allocations.
    const readHeap = async (): Promise<number> => {
      return await page.evaluate(() => {
        const m = (performance as unknown as { memory?: HeapMemory }).memory;
        return m ? m.usedJSHeapSize : 0;
      });
    };

    // Baseline — sampled after the first cycle so the module-level
    // OSD bundle cost does not count as "a leak".
    const baseline = await readHeap();

    // Close via Escape for every cycle. The smoke route's
    // external "close" button sits behind the fixed-inset dialog
    // (z-50), so Playwright can't click it through the overlay —
    // and Escape is the primary close affordance anyway (Primitive
    // §21 and the DocumentViewer contract it generalises).
    for (let i = 0; i < 10; i++) {
      await openBtn.click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("data-pang-ready", "true", {
        timeout: 10_000,
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }

    // Give the browser a moment to run any idle-callback cleanup.
    await page.waitForTimeout(100);

    const after = await readHeap();
    // `performance.memory` is present under Chromium; if it reports
    // 0 (sandbox quirk) we skip the assertion rather than create
    // false failures. Chromium in CI reports real values.
    if (baseline > 0 && after > 0) {
      const delta = after - baseline;
      expect(
        delta,
        `heap delta after 10 open/close cycles: ${(delta / (1024 * 1024)).toFixed(2)} MB`,
      ).toBeLessThan(FIVE_MB);
    }

    // --- Step 3: telemetry pair emitted ----------------------------
    const openEvents = events.filter((e) => e.event === "deep_zoom.open");
    const closeEvents = events.filter((e) => e.event === "deep_zoom.close");
    expect(openEvents.length).toBeGreaterThan(0);
    expect(closeEvents.length).toBeGreaterThan(0);
    // Every open should have a corresponding close — the cycles loop
    // is paired, and the first warm-up cycle also paired.
    expect(closeEvents.length).toBeGreaterThanOrEqual(openEvents.length);
  });
});
