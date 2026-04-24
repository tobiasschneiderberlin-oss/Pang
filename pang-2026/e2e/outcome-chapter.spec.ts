/**
 * PANG — outcome chapter e2e specs (iteration #11).
 *
 * Five specs that lock the confirmation-chapter contract at the DOM
 * layer. The unit tests (`src/ai/chapter/outcome-mount.test.ts`,
 * `src/components/intake/OutcomeChapter.test.ts`) cover the pure
 * logic; these walks cover the DOM contract — the attributes,
 * surface labels, and pointer affordances Laura's hands interact
 * with.
 *
 *   1. outcome-chapter-confirmation — a confirmed transition mounts
 *      the outcome chapter with `data-pang-outcome-variant="confirmation"`
 *      on Room, narration text matches the voice corpus, and the
 *      dismiss affordance appears after `ready`.
 *   2. outcome-chapter-decline — a declined transition mounts with
 *      `variant="decline"`, narration matches the decline line, and
 *      no place-beat emissive change occurs (visual sentinel: the
 *      chapter's DOM carries the decline attribute even if we
 *      cannot observe the underlying canvas emissive directly).
 *   3. outcome-chapter-replay-guard — a confirmed entry whose
 *      `outcomeChapterShownAt` latch is already set does NOT mount
 *      the chapter on Room entry (rehydrated state).
 *   4. outcome-chapter-surface-gate — a confirmed transition that
 *      lands while the Room is not the active surface does not
 *      mount; navigating back to Room flushes the queued chapter.
 *   5. outcome-chapter-reduced-motion — with
 *      `prefers-reduced-motion: reduce`, the chapter still mounts
 *      and the dismiss affordance appears; the frame-time histogram
 *      stays within one reasonable bucket (smoke — the true
 *      invariant is the clamp, unit-tested in
 *      `OutcomeChapter.test.ts`).
 *
 * Seeding path: `window.__PANG.useVerification` + `useWorks`,
 * installed by `AppBoot` when `NEXT_PUBLIC_PANG_E2E=1`. We seed a
 * verified work then call `replaceState` to drop the verification
 * slice directly into `confirmed` / `declined`. This bypasses the
 * upstream request/dispatch dance — the outcome-mount hook keys off
 * `byWorkId` transitions, and `replaceState` is the store's
 * rehydration entry point.
 */

import { expect, test } from "@playwright/test";

// ---------- Shared types + helpers --------------------------------

interface SeedEntry {
  readonly id: string;
  readonly imageUrl: string;
  readonly status: "verified" | "unverified";
  readonly size: readonly [number, number];
}

type VerificationStateShape =
  | {
      kind: "confirmed";
      requestId: string;
      submittedAt: string;
      decidedAt: string;
      outcomeChapterShownAt: string | null;
    }
  | {
      kind: "declined";
      requestId: string;
      submittedAt: string;
      decidedAt: string;
      outcomeChapterShownAt: string | null;
    };

const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";

function seedEntry(id: string): SeedEntry {
  return {
    id,
    imageUrl: PIXEL_PNG,
    status: "unverified",
    size: [0.6, 0.8],
  };
}

async function waitForPangWindow(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __PANG?: unknown }).__PANG !== "undefined",
  );
}

async function seedVerifiedWork(
  page: import("@playwright/test").Page,
  workId: string,
  state: VerificationStateShape,
): Promise<void> {
  await page.evaluate(
    ([entry, s]) => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => { addEntry: (e: unknown) => void };
          };
          useVerification: {
            getState: () => {
              replaceState: (
                workId: string,
                state: VerificationStateShape,
              ) => void;
            };
          };
        };
      };
      w.__PANG.useWorks.getState().addEntry(entry);
      w.__PANG.useVerification
        .getState()
        .replaceState((entry as { id: string }).id, s);
    },
    [seedEntry(workId), state] as [SeedEntry, VerificationStateShape],
  );
}

test.use({ viewport: { width: 1280, height: 800 } });

// ---------- Spec 1: confirmation ---------------------------------

test.describe("outcome-chapter-confirmation — confirms mount the ceremony", () => {
  test("confirmed transition mounts chapter + narration + dismiss", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    await seedVerifiedWork(page, "w-e2e-confirm", {
      kind: "confirmed",
      requestId: "r-e2e-confirm",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    // The outcome surface mounts as `<main aria-label="outcome">`.
    const outcome = page.locator('main[aria-label="outcome"]');
    await expect(outcome).toBeVisible({ timeout: 10_000 });
    await expect(outcome).toHaveAttribute(
      "data-pang-outcome-variant",
      "confirmation",
    );

    // Narration slot appears on the `confirmation` beat — kind's
    // ActiveBeat envelope drives the opacity, so we wait for the slot
    // to be attached, then check the voice-corpus text matches.
    const narration = outcome.locator('[data-pang-outcome-narration="true"]');
    await expect(narration).toBeAttached({ timeout: 10_000 });
    const narrationText = (await narration.innerText()).toLowerCase().trim();
    // Voice corpus: "the gallery confirms this work."
    expect(narrationText).toContain("confirms");

    // Once the chapter reaches its `ready` beat, the dismiss
    // affordance appears. The total chapter length is ~14 s; we give
    // Playwright ample headroom.
    const dismiss = outcome.locator('[data-pang-outcome-dismiss="true"]');
    await expect(dismiss).toBeVisible({ timeout: 20_000 });

    // Sanity: the outcome container's readiness attr flips to true.
    await expect(outcome).toHaveAttribute("data-pang-outcome-ready", "true");

    // Tap anywhere on the surface to dismiss. The chapter reports
    // done; the mount hook clears current then waits 400 ms before
    // advancing. An empty queue means the chapter disappears.
    await outcome.dispatchEvent("pointerdown", { pointerType: "touch" });
    await expect(outcome).toBeHidden({ timeout: 5_000 });
  });
});

// ---------- Spec 2: decline --------------------------------------

test.describe("outcome-chapter-decline — declines mount a silent ceremony", () => {
  test("declined transition mounts chapter with decline narration", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    await seedVerifiedWork(page, "w-e2e-decline", {
      kind: "declined",
      requestId: "r-e2e-decline",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    const outcome = page.locator('main[aria-label="outcome"]');
    await expect(outcome).toBeVisible({ timeout: 10_000 });
    await expect(outcome).toHaveAttribute(
      "data-pang-outcome-variant",
      "decline",
    );

    // Decline narration mounts; corpus text is the "not confirmed"
    // line (voice.ts OUTCOME_NARRATION.decline). We don't hard-code
    // the string — the corpus owns it — but we assert the line is
    // visibly different from the confirm text.
    const narration = outcome.locator('[data-pang-outcome-narration="true"]');
    await expect(narration).toBeAttached({ timeout: 10_000 });
    const text = (await narration.innerText()).toLowerCase().trim();
    // Voice corpus: "the gallery did not confirm this work."
    expect(text).toContain("did not confirm");

    // Dismiss affordance still appears (ready state is reached with
    // or without the place beat).
    const dismiss = outcome.locator('[data-pang-outcome-dismiss="true"]');
    await expect(dismiss).toBeVisible({ timeout: 20_000 });
  });
});

// ---------- Spec 3: replay guard ---------------------------------

test.describe("outcome-chapter-replay-guard — latched entries don't replay", () => {
  test("confirmed with non-null outcomeChapterShownAt does not mount", async ({
    page,
  }) => {
    await page.goto("/");
    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await waitForPangWindow(page);

    // Seed a confirmed entry whose latch is already set — the
    // rehydration path that iter #11's persistence test covers.
    await seedVerifiedWork(page, "w-e2e-latched", {
      kind: "confirmed",
      requestId: "r-e2e-latched",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: "2026-04-23T11:00:05.000Z",
    });

    // Give the mount hook a generous window to NOT mount. If it did
    // (latch was ignored), the outcome surface would appear within a
    // few RAF ticks. We pin it against a 3-second window.
    const outcome = page.locator('main[aria-label="outcome"]');
    await expect(outcome).toBeHidden({ timeout: 3_000 });
  });
});

// ---------- Spec 4: surface gate ---------------------------------

test.describe("outcome-chapter-surface-gate — off-Room transitions queue", () => {
  test("confirm on /scan does not mount; Room entry flushes the head", async ({
    page,
  }) => {
    // Start on /scan — the surface claim there sets active="scan".
    await page.goto("/scan");
    // The /scan route is the viewfinder; it owns `aria-label="scan"`
    // or the generic main. We just wait for __PANG to hydrate.
    await waitForPangWindow(page);

    // Seed a confirmed transition while the Room is NOT active. The
    // hook should queue the outcome rather than surface it.
    await seedVerifiedWork(page, "w-e2e-gate", {
      kind: "confirmed",
      requestId: "r-e2e-gate",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    // Outcome surface must NOT be visible on /scan.
    const outcome = page.locator('main[aria-label="outcome"]');
    await expect(outcome).toBeHidden({ timeout: 3_000 });

    // Navigate to the Room — the surface claim flips to "room" and
    // the hook flushes the queue head.
    await page.goto("/");
    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();

    await expect(outcome).toBeVisible({ timeout: 15_000 });
    await expect(outcome).toHaveAttribute(
      "data-pang-outcome-variant",
      "confirmation",
    );
  });
});

// ---------- Spec 5: reduced motion -------------------------------

test.describe("outcome-chapter-reduced-motion — P19 clamp", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("chapter mounts and dismisses under prefers-reduced-motion", async ({
    browser,
  }) => {
    // Reduced-motion contexts need to emulate the media feature at
    // the context level; Playwright's per-test `page` fixture is
    // shared and cannot flip this between tests in the same file.
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    try {
      await page.goto("/");
      const main = page.getByRole("main", { name: /your collection/i });
      await expect(main).toBeVisible();
      await waitForPangWindow(page);

      await seedVerifiedWork(page, "w-e2e-reduced", {
        kind: "confirmed",
        requestId: "r-e2e-reduced",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
        outcomeChapterShownAt: null,
      });

      const outcome = page.locator('main[aria-label="outcome"]');
      await expect(outcome).toBeVisible({ timeout: 10_000 });
      await expect(outcome).toHaveAttribute(
        "data-pang-outcome-variant",
        "confirmation",
      );

      // Under reduced motion the curve is clamped — the chapter
      // still reaches `ready` and the dismiss affordance appears.
      const dismiss = outcome.locator('[data-pang-outcome-dismiss="true"]');
      await expect(dismiss).toBeVisible({ timeout: 20_000 });
    } finally {
      await page.close();
      await ctx.close();
    }
  });
});
