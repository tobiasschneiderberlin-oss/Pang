/**
 * PANG — home smoke test.
 *
 * Tier 2 sentinel for the home surface. Catches:
 *   - layout regressions (empty-room paper baseline vanished)
 *   - grid view not mounted on cold install (iter #21 default)
 *   - canvas not mounted on toggle to space (iter #21 secondary)
 *   - banned voice vocab leaking into a rendered string (A5)
 *
 * Iter #21: the home defaults to a grid view; the Room canvas is
 * a one-tap toggle. The test below covers BOTH modes — grid first
 * (cold-install assertion), then toggle to space and assert the
 * canvas mounts.
 */

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("home — grid default + space toggle (iter #21)", () => {
  test("cold install renders grid; toggle mounts the Room canvas", async ({
    page,
  }) => {
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();

    // Cold install: grid is the default. The empty grid renders
    // the visible "an empty wall" line plus the chrome row.
    const grid = page.locator('[data-testid="pang-grid"], [data-testid="pang-grid-empty"]');
    await expect(grid.first()).toBeVisible({ timeout: 10_000 });

    // The view-mode toggle is part of the chrome row top-right.
    const toggle = page.locator('[data-testid="pang-room-view-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("data-mode", "grid");

    // Tap the toggle → space mode → WebGPU canvas mounts.
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-mode", "space");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
  });

  test("no banned voice vocabulary in rendered DOM", async ({ page }) => {
    // A5 doctrine. The string audit script (check:strings) lints
    // source. This catches strings that slip in via runtime-only
    // paths (server-rendered content, conditional branches the
    // linter doesn't evaluate). Kept in sync with PANG_Voice.md.
    const banned = ["dive", "unlock", "seamless", "leverage", "journey"];

    await page.goto("/");
    const body = await page.locator("body").innerText();
    const lower = body.toLowerCase();

    for (const word of banned) {
      expect(
        lower,
        `banned vocab "${word}" found in rendered home DOM`,
      ).not.toContain(word);
    }
  });

  test("no title case in visible copy (sentence case or ALL CAPS only)", async ({
    page,
  }) => {
    // PANG voice doctrine. Detects title-case regressions — text
    // like "Scan Your First Work". Loose heuristic: any visible
    // span of 3+ words where every content word starts uppercase
    // is title case. Two-word labels ("Your Collection") pass
    // because aria-label strings live in the accessibility tree
    // and the rule applies to rendered body copy.
    await page.goto("/");

    // Sample just the main element's visible text — chrome labels
    // don't count.
    const text = await page.getByRole("main").innerText();
    const lines = text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const line of lines) {
      const words = line.split(/\s+/);
      if (words.length < 3) continue;
      const content = words.filter(
        (w) => !/^(a|an|and|the|of|in|on|to|for|by|is)$/i.test(w),
      );
      if (content.length < 3) continue;
      const allCapsWords = content.every((w) => /^[A-Z0-9!?.,:;—-]+$/.test(w));
      if (allCapsWords) continue; // ALL CAPS block is allowed
      const titleCased = content.every((w) => /^[A-Z]/.test(w));
      expect(
        titleCased,
        `title-case suspected in: "${line}"`,
      ).toBe(false);
    }
  });
});
