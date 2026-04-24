/**
 * PANG — Room → DeepZoom flow (iteration #8).
 *
 * Three assertions, all against the production home route (`/`):
 *
 *   1. **Cold path.** Open against a real DZI tile source. Expect
 *      `deep_zoom.open` + at least one `deep_zoom.cache.miss` +
 *      `deep_zoom.tile.load` with `source: "network"`. Escape
 *      dismisses; `activeDeepZoom` returns to `null`; `focusedId`
 *      survives.
 *
 *   2. **Warm path.** Re-open the same work. Expect at least one
 *      `deep_zoom.cache.hit` + `deep_zoom.tile.load` with
 *      `source: "opfs"`. The warm-path SLO lives on the server-side
 *      dashboard (p95 < 200 ms); this test proves the attribution
 *      is correct, not the latency.
 *
 *   3. **Composite resolution.** The `activeDeepZoom` composite
 *      carries `${workId}:${tileSource.url}`, and the production
 *      connector resolves it against the live works store. We seed
 *      an entry + write the composite from the test — the Room
 *      gesture layer is covered by unit tests; this spec validates
 *      the *store → connector → OSD → OPFS* chain end-to-end.
 *
 * Chromium-only — `OPFS` is shipped, but we don't rely on
 * cross-browser parity. The test wipes OPFS between the cold and
 * warm halves so the cold assertion is robust against a leftover
 * cache from a prior run on the same origin.
 */

import { expect, test, type ConsoleMessage } from "@playwright/test";

interface PangEvent {
  event: string;
  attrs: Record<string, unknown>;
}

/** Real DZI pyramid built by `npm run build:deepzoom`. */
const TEST_WORK_ID = "e2e-vermeer-pearl";
const TEST_DZI_URL = "/deep-zoom/vermeer-pearl/manifest.dzi";
const TEST_COMPOSITE = `${TEST_WORK_ID}:${TEST_DZI_URL}`;

test.describe("room → deep-zoom — cache attribution", () => {
  test("cold path misses, warm path hits, focusedId survives escape", async ({
    page,
  }) => {
    const events: PangEvent[] = [];
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
        // Non-PANG debug noise is fine.
      }
    });

    await page.goto("/");

    // Wait for the E2E seam to be installed. `AppBoot` exposes
    // `__PANG.useWorks` behind `NEXT_PUBLIC_PANG_E2E=1`.
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __PANG?: unknown }).__PANG !==
        "undefined",
    );

    // Wipe the OPFS tile cache so the cold assertion is real. OPFS
    // persists across test runs on the same origin; any prior DZI
    // fetches would already be warm.
    await page.evaluate(async () => {
      try {
        const root = await navigator.storage.getDirectory();
        await root
          .removeEntry("deep-zoom-cache", { recursive: true })
          .catch(() => {
            /* never-existed is fine */
          });
      } catch {
        // OPFS unavailable under the sandbox — the test is then a
        // network-only walk, which still exercises the override.
      }
    });

    // Seed a verified entry with a real DZI tile source. The Room
    // gesture layer is covered by unit tests; here we drive
    // `activeDeepZoom` directly through the public seam.
    await page.evaluate(
      ({ id, url }) => {
        const w = window as unknown as {
          __PANG: {
            useWorks: {
              getState: () => {
                addEntry: (entry: {
                  id: string;
                  imageUrl: string;
                  status: "verified" | "unverified";
                  size: readonly [number, number];
                  tileSource: { kind: "dzi"; url: string };
                }) => void;
                setFocusedId: (id: string | null) => void;
              };
            };
          };
        };
        const store = w.__PANG.useWorks.getState();
        store.addEntry({
          id,
          imageUrl: "about:blank",
          status: "verified",
          size: [0.6, 0.8],
          tileSource: { kind: "dzi", url },
        });
        store.setFocusedId(id);
      },
      { id: TEST_WORK_ID, url: TEST_DZI_URL },
    );

    // ---- Cold path ------------------------------------------------
    await page.evaluate((composite) => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              setActiveDeepZoom: (id: string | null) => void;
            };
          };
        };
      };
      w.__PANG.useWorks.getState().setActiveDeepZoom(composite);
    }, TEST_COMPOSITE);

    const dialog = page.locator(
      'div[role="dialog"][aria-label="deep zoom"][data-pang-surface="deep-zoom"]',
    );
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAttribute("data-pang-ready", "true", {
      timeout: 15_000,
    });

    // Give OSD a moment to issue tile requests. DZI opens the top
    // levels first; those are small and fire within a frame or two.
    await page.waitForTimeout(600);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    const afterCold = await page.evaluate(() => {
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
      return { activeDeepZoom: s.activeDeepZoom, focusedId: s.focusedId };
    });
    expect(afterCold.activeDeepZoom).toBeNull();
    expect(afterCold.focusedId).toBe(TEST_WORK_ID);

    // Cold-path telemetry. At least one tile should land as a miss
    // (the DZI manifest + the top-level tile at minimum).
    const coldEvents = [...events];
    const coldOpens = coldEvents.filter((e) => e.event === "deep_zoom.open");
    const coldMisses = coldEvents.filter(
      (e) => e.event === "deep_zoom.cache.miss",
    );
    const coldTileLoads = coldEvents.filter(
      (e) =>
        e.event === "deep_zoom.tile.load" &&
        e.attrs["pang.deep_zoom.tile_source"] === "network",
    );
    expect(coldOpens.length).toBeGreaterThan(0);
    // The miss count depends on how many tiles OSD has requested by
    // the 600 ms wait, but there must be at least one — the top-
    // level tile is always fetched on open.
    expect(
      coldMisses.length,
      `cold path saw ${coldMisses.length} cache misses; expected ≥ 1`,
    ).toBeGreaterThan(0);
    expect(coldTileLoads.length).toBeGreaterThan(0);

    // ---- Warm path ------------------------------------------------
    // Clear the buffer so the warm assertions only look at the
    // second cycle's events.
    events.length = 0;

    await page.evaluate((composite) => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              setActiveDeepZoom: (id: string | null) => void;
            };
          };
        };
      };
      w.__PANG.useWorks.getState().setActiveDeepZoom(composite);
    }, TEST_COMPOSITE);

    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAttribute("data-pang-ready", "true", {
      timeout: 15_000,
    });
    await page.waitForTimeout(600);

    const warmHits = events.filter((e) => e.event === "deep_zoom.cache.hit");
    const warmOpfs = events.filter(
      (e) =>
        e.event === "deep_zoom.tile.load" &&
        e.attrs["pang.deep_zoom.tile_source"] === "opfs",
    );

    // If OPFS is disabled in the sandbox, warm-path hits never fire.
    // Skip those assertions and fall back to proving the open/close
    // cycle still succeeds — the override's failure mode is a
    // silent pass-through, which is the right behaviour.
    const hasOpfs = await page.evaluate(
      () => typeof navigator.storage?.getDirectory === "function",
    );
    if (hasOpfs) {
      expect(
        warmHits.length,
        `warm path saw ${warmHits.length} cache hits; expected ≥ 1`,
      ).toBeGreaterThan(0);
      expect(warmOpfs.length).toBeGreaterThan(0);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});
