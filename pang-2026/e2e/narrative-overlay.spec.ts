/**
 * PANG — narrative overlay e2e spec (iteration #14).
 *
 * Four specs lock the overlay's surface contract at the DOM layer:
 *
 *   1. narrative-overlay-arrival — enter the Room, the GET returns a
 *      current-month paragraph, the overlay fades in with the voice
 *      corpus's dismiss affordance.
 *   2. narrative-overlay-dismiss — a single tap on the dismiss
 *      affordance hides the overlay for the rest of the session; a
 *      second surface transition back into Room does NOT resurrect
 *      the same-month paragraph.
 *   3. narrative-overlay-month-rollover — after the collector
 *      dismissed this month, adopting a *new* month's paragraph
 *      (simulated by writing a different `month` into the store)
 *      re-enables the overlay on the same session.
 *   4. narrative-overlay-silence — a 204 / null fetch leaves the
 *      overlay absent; no empty card, no placeholder paragraph.
 *
 * Why seed through `window.__PANG.useNarrative` rather than drive the
 * GET: the route's happy path requires a filesystem marker to exist,
 * which means driving the whole agent pipeline in a dev env. The
 * overlay component and the dismissal slice are what this spec exists
 * to defend; the route + agent path is covered by unit tests
 * (`app/api/narrative/current/route.test.ts`, `src/ai/agents/narrative.test.ts`).
 * Seeding the store directly keeps the e2e focused on what the hands
 * touch.
 *
 * Auth-gated: `requireSession()` runs at layout level for most
 * surfaces, but the page itself renders without a session. The
 * `authSeed(page)` call is kept as a precaution so the narrative
 * connector's hook (which would otherwise see a 401 and silence) is
 * exercised against the same session shape as production.
 */

import { expect, test, type Page } from "@playwright/test";
import { authSeed } from "./support/auth";

test.use({ viewport: { width: 1280, height: 800 } });

// ---------- Shared helpers ---------------------------------------

interface NarrativePayload {
  readonly paragraph: string;
  readonly month: string;
  readonly decidedAt: string;
  readonly collectionHash: string;
}

/**
 * A plausible 128-char observational paragraph. Sentence case, no
 * first-person, no banned or evaluative vocabulary — matches the
 * schema's runtime checks so that a paranoid code path reading the
 * store snapshot (e.g. the overlay's aria-live announcer) never trips
 * a console warning.
 */
const FIXTURE_PARAGRAPH =
  "three landscapes by a single maker share the collection with four etchings; the earliest dates from the year the artist left lisbon.";

function currentMonthFixture(): NarrativePayload {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return {
    paragraph: FIXTURE_PARAGRAPH,
    month: `${y}-${m}`,
    decidedAt: now.toISOString(),
    collectionHash: "hash-fixture-001",
  };
}

function nextMonthFixture(): NarrativePayload {
  const now = new Date();
  // Same year + month+1 is fine because the regex is `\d{4}-\d{2}`;
  // we don't need calendar-correct wrap — any second month string
  // that differs from `currentMonthFixture().month` is enough.
  const nextMonthIndex = ((now.getUTCMonth() + 1) % 12) + 1;
  const nextYear =
    nextMonthIndex === 1 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const m = String(nextMonthIndex).padStart(2, "0");
  return {
    paragraph: FIXTURE_PARAGRAPH,
    month: `${nextYear}-${m}`,
    decidedAt: now.toISOString(),
    collectionHash: "hash-fixture-002",
  };
}

async function waitForPangWindow(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __PANG?: unknown }).__PANG !== "undefined",
  );
}

async function seedNarrative(
  page: Page,
  payload: NarrativePayload,
): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as {
      __PANG: {
        useNarrative: {
          getState: () => {
            setCurrent: (payload: NarrativePayload) => void;
          };
        };
      };
    };
    w.__PANG.useNarrative.getState().setCurrent(p);
  }, payload);
}

async function clearNarrative(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __PANG: {
        useNarrative: {
          getState: () => { clear: () => void };
        };
      };
    };
    w.__PANG.useNarrative.getState().clear();
  });
}

// ---------- Spec 1: arrival --------------------------------------

test.describe("narrative-overlay-arrival — overlay fades in on Room entry", () => {
  test("seeded current-month paragraph appears with dismiss affordance", async ({
    page,
  }) => {
    await authSeed(page);
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    // Seed the store directly — the hook's real GET runs in the
    // background but the test doesn't wait for it. A seeded store is
    // the same input the hook produces on a 200.
    await seedNarrative(page, currentMonthFixture());

    const paragraph = page.locator(
      '[data-testid="pang-narrative-paragraph"]',
    );
    await expect(paragraph).toBeVisible({ timeout: 5_000 });
    await expect(paragraph).toHaveText(FIXTURE_PARAGRAPH);

    // The dialog wrapper carries the voice-corpus aria-label.
    const dialog = page.locator('[data-pang-surface="narrative-overlay"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute(
      "data-pang-source",
      "ai",
    );

    // The dismiss affordance is a button, ALL CAPS, uses the voice
    // corpus's NARRATIVE_DISMISS_LABEL ("dismiss").
    const dismiss = page.locator('[data-testid="pang-narrative-dismiss"]');
    await expect(dismiss).toBeVisible();
    const dismissText = (await dismiss.innerText()).trim().toLowerCase();
    expect(dismissText).toContain("dismiss");
  });
});

// ---------- Spec 2: dismiss --------------------------------------

test.describe("narrative-overlay-dismiss — one tap dismisses for session", () => {
  test("dismiss hides overlay and survives re-entry to Room", async ({
    page,
  }) => {
    await authSeed(page);
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    const payload = currentMonthFixture();
    await seedNarrative(page, payload);

    const paragraph = page.locator(
      '[data-testid="pang-narrative-paragraph"]',
    );
    await expect(paragraph).toBeVisible({ timeout: 5_000 });

    // Single tap on the dismiss affordance.
    const dismiss = page.locator('[data-testid="pang-narrative-dismiss"]');
    await dismiss.click();

    // The overlay's container unmounts (isVisible → false).
    await expect(paragraph).toBeHidden({ timeout: 3_000 });

    // Re-seed the *same-month* paragraph — the store's derived
    // `isVisible` should stay false because `dismissedMonth ===
    // current.month`. This is the "same-session re-entry" behaviour.
    await seedNarrative(page, payload);
    await expect(paragraph).toBeHidden({ timeout: 2_000 });
  });
});

// ---------- Spec 3: month rollover -------------------------------

test.describe("narrative-overlay-month-rollover — new month re-surfaces overlay", () => {
  test("after dismiss, adopting a different month shows overlay again", async ({
    page,
  }) => {
    await authSeed(page);
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    // Adopt the current month, dismiss it.
    await seedNarrative(page, currentMonthFixture());
    const paragraph = page.locator(
      '[data-testid="pang-narrative-paragraph"]',
    );
    await expect(paragraph).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="pang-narrative-dismiss"]').click();
    await expect(paragraph).toBeHidden({ timeout: 3_000 });

    // Adopt a different-month paragraph — simulates the cron tick
    // running overnight into the next calendar month and the hook
    // re-fetching on the next arrival. The overlay re-appears.
    await seedNarrative(page, nextMonthFixture());
    await expect(paragraph).toBeVisible({ timeout: 3_000 });
  });
});

// ---------- Spec 4: silence --------------------------------------

test.describe("narrative-overlay-silence — null payload shows no overlay", () => {
  test("store with no current paragraph leaves the overlay absent", async ({
    page,
  }) => {
    await authSeed(page);
    await page.goto("/");

    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    // Make sure any background GET that might have populated the
    // store is cleared. A fresh install has no marker, but the hook's
    // real fetch could land between navigation and assertion.
    await clearNarrative(page);

    // Small settle window to give any in-flight adoption a chance to
    // write (and then be cleared again). The overlay must stay
    // absent for the full window.
    await page.waitForTimeout(500);
    await clearNarrative(page);

    const paragraph = page.locator(
      '[data-testid="pang-narrative-paragraph"]',
    );
    await expect(paragraph).toBeHidden();

    const dialog = page.locator('[data-pang-surface="narrative-overlay"]');
    await expect(dialog).toBeHidden();
  });
});
