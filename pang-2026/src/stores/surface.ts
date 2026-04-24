/**
 * PANG — active-surface slice (iter #11).
 *
 * Names the implicit primitive that was diffuse across the app: which
 * surface is currently on-stage. Every surface-aware decision in the
 * client tree (chapter mount gating, focus sticking, reduced-motion
 * clamp at transitions) derived this from `pang.surface` OTel dimension
 * emissions scattered across components. Iter #11's confirmation
 * chapter needs a reactive, synchronous read — mounting the outcome
 * chapter on a state transition is a Room-active-edge decision, not a
 * Room-active-at-some-point decision, so we need a store the consumer
 * can subscribe to.
 *
 *   SurfaceKind is the closed union of named surfaces. New surfaces
 *   extend the union in one place; the OTel emissions continue to
 *   derive from the store (not the other way round).
 *
 * The setter is imperative: route components call `setActiveSurface`
 * on mount and `clearActiveSurface` on unmount. The chapter mount hook
 * (`useOutcomeChapterMount`) subscribes and reacts to transitions.
 *
 * Idempotency: setting to the current value is a no-op (same reference
 * returns). Clearing when not-owned is a no-op (if a later surface
 * already took the stage, we respect its claim).
 *
 * Not persisted. The surface is a runtime concept; a refresh always
 * restarts at whatever route the URL selects.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * The closed set of named surfaces. Extend here when a new named
 * surface lands. The string values double as the `pang.surface` OTel
 * attribute value — so the shape is load-bearing in telemetry.
 */
export type SurfaceKind =
  /** Home wall — The Room. The primary surface. */
  | "room"
  /** Intake viewfinder + review + arrival chapter. `/scan`. */
  | "scan"
  /** Focused-work plaque + documents chapter. Sub-surface of room. */
  | "focus"
  /** Invite-gated first boot. `/i/[token]`. */
  | "invite"
  /** Gallery-side confirm / decline page. `/g/confirm` + `/g/decline`. */
  | "gallery-confirm"
  /** Deep-zoom overlay. Sub-surface of room. */
  | "deep-zoom"
  /** Documents viewer overlay. Sub-surface of room. */
  | "document-viewer";

export interface SurfaceStore {
  /** Currently-active surface. `null` before any surface has mounted. */
  readonly active: SurfaceKind | null;

  /**
   * Claim the stage. Idempotent — setting to the current value is a
   * no-op. Typically called from a route/surface component's mount
   * effect.
   */
  setActiveSurface(kind: SurfaceKind): void;

  /**
   * Release the stage *if* the current owner is `kind`. A newer
   * surface may have already taken the stage (the caller is unmounting
   * after a transition); clearing only when we still own it keeps the
   * transitions clean.
   */
  clearActiveSurface(kind: SurfaceKind): void;

  /** Reset for testing; not wired to any user action. */
  clear(): void;
}

export const useSurface = create<SurfaceStore>()(
  subscribeWithSelector((set, get) => ({
    active: null,

    setActiveSurface(kind) {
      if (get().active === kind) return;
      set({ active: kind });
    },

    clearActiveSurface(kind) {
      if (get().active !== kind) return;
      set({ active: null });
    },

    clear() {
      set({ active: null });
    },
  })),
);

/**
 * Read the active surface reactively. Returns the current kind, or
 * `null` if no surface has mounted yet (pre-hydration / pre-route).
 *
 * Use this in chapter-mount gating, edge-triggered side effects, and
 * anywhere a component cares about "is the Room currently on stage."
 */
export function useActiveSurface(): SurfaceKind | null {
  return useSurface((s) => s.active);
}
