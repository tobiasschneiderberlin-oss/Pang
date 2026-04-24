/**
 * PANG — narrative session slice (iter #14).
 *
 * Session-scoped Zustand store for the narrative overlay's dismissal
 * state and the most-recently-arrived paragraph. *Session-scoped* is
 * the key doctrine: the overlay fades in once per "arrival" — when
 * the collector enters the Room — and the dismissal persists for the
 * rest of the session but not across refreshes.
 *
 * Why not OPFS-persist the dismissal: a refresh IS a new arrival. If
 * Laura closes the tab and re-opens, she's walking back in; the quiet
 * overlay fading in is the spine moment. Persisting dismissal across
 * sessions would silence the overlay until the next *month*, which is
 * the wrong register.
 *
 * Shape:
 *
 *   - `current`: the paragraph marker currently eligible to render, or
 *     `null` if none has arrived (GET 204 or not-yet-fetched).
 *   - `dismissedMonth`: the `YYYY-MM` the collector last dismissed, or
 *     `null`. A new month's reading arrives and clears this implicitly
 *     (dismissedMonth !== current.month → eligible to render).
 *
 * The overlay component reads `isVisible` (derived) and calls
 * `dismiss()` on the affordance tap.
 */

import { create } from "zustand";

import type { NarrativeCurrentResponse } from "@/narrative/schema";

export interface NarrativeStore {
  /** The paragraph eligible to render, or `null`. */
  readonly current: NarrativeCurrentResponse | null;
  /** The `YYYY-MM` the collector last dismissed. */
  readonly dismissedMonth: string | null;
  /**
   * Whether the overlay should render right now. Derived:
   * `current !== null && current.month !== dismissedMonth`.
   */
  readonly isVisible: boolean;
  /**
   * Adopt a new paragraph. Called by the arrival hook after GET
   * returns a 200. Recomputes `isVisible` against `dismissedMonth`.
   */
  setCurrent(response: NarrativeCurrentResponse | null): void;
  /** Record a one-tap dismiss for `current.month`. */
  dismiss(): void;
  /** Test-only reset. */
  clear(): void;
}

function computeVisible(
  current: NarrativeCurrentResponse | null,
  dismissedMonth: string | null,
): boolean {
  if (current === null) return false;
  if (dismissedMonth === null) return true;
  return current.month !== dismissedMonth;
}

export const useNarrative = create<NarrativeStore>((set, get) => ({
  current: null,
  dismissedMonth: null,
  isVisible: false,

  setCurrent(response) {
    const dismissedMonth = get().dismissedMonth;
    set({
      current: response,
      isVisible: computeVisible(response, dismissedMonth),
    });
  },

  dismiss() {
    const current = get().current;
    if (current === null) return;
    set({
      dismissedMonth: current.month,
      isVisible: false,
    });
  },

  clear() {
    set({ current: null, dismissedMonth: null, isVisible: false });
  },
}));
