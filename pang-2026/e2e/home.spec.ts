/**
 * PANG — home smoke test.
 *
 * Tier 2 sentinel for the Room surface. Catches:
 *   - layout regressions (empty-room paper baseline vanished)
 *   - canvas not mounted (renderer init crashed)
 *   - banned voice vocab leaking into a rendered string (A5)
 *
 * Runs on chromium-desktop only — the Room is the same surface
 * everywhere; device-specific behaviours belong in their own spec.
 */

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("home — The Room", () => {
  test("renders the collection canvas", async ({ page }) => {
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();

    // Canvas must exist — the Room is a <canvas> surface by
    // doctrine (no DOM for primary art surfaces).
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
