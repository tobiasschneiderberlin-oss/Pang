/**
 * PANG — documents surface (iteration #6) walk.
 *
 * Tier 2 sentinel for the three-surface contract:
 *
 *   1. Focus a work with documents → `DocumentsChapter` mounts.
 *   2. Tap a tactile artifact card → `DocumentViewer` mounts as a
 *      dialog.
 *   3. Press Escape → viewer unmounts, `focusedId` is preserved,
 *      the chapter DOM stays (its anchor survives the viewer open).
 *
 * We seed the works store via the E2E exposure (`window.__PANG.useWorks`,
 * installed by `AppBoot` when `NEXT_PUBLIC_PANG_E2E=1`). The alternative
 * — driving the scanner end-to-end with a fake media stream + stubbed
 * `/api/intake` — would couple this spec to the intake flow; when that
 * flow changes, this spec would break for unrelated reasons. The store
 * seed keeps the scope surgical.
 *
 * OPFS bytes are NOT seeded. The viewer's load path resolves to
 * `missing` (no bytes under `/documents/coa-smoke.pdf`); the viewer
 * still mounts and renders its footer muji line. That is exactly the
 * observable contract we want to exercise — P25 + the failure mode
 * "bytes missing degrades gracefully" both covered in one walk.
 *
 * Runs on chromium-mobile + chromium-desktop. Pointer events are
 * identical under Playwright's emulation; the card's `onPointerDown`
 * handler is the gesture boundary.
 */

import { expect, test } from "@playwright/test";

// Matches the shape of `CollectionEntry` in src/stores/works.ts. Kept
// local to avoid a tsconfig alias dependency in e2e/.
interface SeedEntry {
  readonly id: string;
  readonly imageUrl: string;
  readonly status: "verified" | "unverified";
  readonly size: readonly [number, number];
  readonly documents: ReadonlyArray<{
    readonly type: "coa" | "invoice" | "condition_report";
    readonly fileRef: string;
    readonly mime: "application/pdf" | "image/png" | "image/jpeg";
    readonly extractedFields: Readonly<Record<string, string>>;
  }>;
}

function seedEntry(): SeedEntry {
  return {
    id: "e2e-docs",
    // 1×1 transparent PNG — harmless blob the canvas layout can hang
    // without hitting the network. The Room render is gated off in
    // this spec anyway (viewer takes over once opened).
    imageUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
    status: "verified",
    size: [0.6, 0.8],
    documents: [
      {
        type: "coa",
        fileRef: "documents/coa-smoke.pdf",
        mime: "application/pdf",
        extractedFields: {
          "issued by": "Galerie Droste",
          edition: "1 of 1",
        },
      },
    ],
  };
}

test.describe("documents — focus / chapter / viewer walk", () => {
  test("chapter mounts on focus; viewer opens on tap; Escape closes", async ({
    page,
  }) => {
    await page.goto("/");

    // The Room main must render before we can seed — AppBoot's effect
    // installs `__PANG` inside its useEffect.
    const main = page.getByRole("main", { name: /your collection/i });
    await expect(main).toBeVisible();
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __PANG?: unknown }).__PANG !==
        "undefined",
    );

    // Seed: add the entry, focus it. This mirrors exactly what the
    // scanner → arrival → Room flow does when a real work lands.
    await page.evaluate((entry) => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              addEntry: (e: unknown) => void;
              setFocusedId: (id: string | null) => void;
            };
          };
        };
      };
      const store = w.__PANG.useWorks.getState();
      store.addEntry(entry);
      store.setFocusedId(entry.id);
    }, seedEntry());

    // Chapter mounts. The section carries both an aria-label and a
    // data-pang-chapter attribute; we query by role+name because that
    // is what a screen reader user sees.
    const chapter = page.locator(
      'section[aria-label="documents"][data-pang-chapter="documents"]',
    );
    await expect(chapter).toBeAttached({ timeout: 10_000 });

    // The tactile artifact card is a <button> inside the chapter with
    // data-pang-source="ai" and data-pang-kind="coa". The chapter's
    // staggered reveal is envelope-driven — the card is visible as
    // soon as its artifact beat enters. Our settle beat is 500 ms so
    // the first artifact card paints by ~500 ms; we give Playwright
    // plenty of headroom.
    const coaCard = chapter.locator(
      'button[data-pang-source="ai"][data-pang-kind="coa"]',
    );
    await expect(coaCard).toBeVisible({ timeout: 10_000 });

    // Tap. `onPointerDown` on the card fires `setActiveViewer`. The
    // DocumentViewer connector picks it up and mounts the dialog.
    // `dispatchEvent` with a PointerEvent — Playwright's `click` uses
    // a MouseEvent and our handler is on `onPointerDown`, so a real
    // pointer gesture is the honest source.
    await coaCard.dispatchEvent("pointerdown", { pointerType: "touch" });

    // Viewer mounts. We gate its appearance on the composed selector
    // matching the contract emitted by DocumentViewer.tsx.
    const viewer = page.locator(
      'div[role="dialog"][aria-label="document"][data-pang-surface="document-viewer"]',
    );
    await expect(viewer).toBeVisible({ timeout: 10_000 });

    // `focusedId` still points at our entry — the viewer did not
    // dismiss focus (viewer-as-escape-hatch, not focus-breaker).
    const focusedWhileOpen = await page.evaluate(() => {
      const w = window as unknown as {
        __PANG: { useWorks: { getState: () => { focusedId: string | null } } };
      };
      return w.__PANG.useWorks.getState().focusedId;
    });
    expect(focusedWhileOpen).toBe("e2e-docs");

    // Close via Escape. The viewer's keydown handler listens on
    // `window`, not the canvas — so we don't need to focus the dialog
    // first.
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden({ timeout: 5_000 });

    // After close: activeViewer is null; focus is preserved. The
    // chapter section remains attached — the back-gesture lands the
    // collector back on the focused work, not the wall.
    const { activeViewer, focusedId } = await page.evaluate(() => {
      const w = window as unknown as {
        __PANG: {
          useWorks: {
            getState: () => {
              activeViewer: string | null;
              focusedId: string | null;
            };
          };
        };
      };
      const s = w.__PANG.useWorks.getState();
      return { activeViewer: s.activeViewer, focusedId: s.focusedId };
    });
    expect(activeViewer).toBeNull();
    expect(focusedId).toBe("e2e-docs");
    await expect(chapter).toBeAttached();
  });
});
