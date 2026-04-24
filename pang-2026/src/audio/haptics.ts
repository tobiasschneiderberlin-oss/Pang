/**
 * PANG — haptic dispatcher (iter #15, primitive 72).
 *
 * "haptic-vocabulary-limited" — `navigator.vibrate` is called only
 * through `triggerHaptic(kind)` with a finite `HapticKind` union.
 * Four reserved patterns, hand-authored, frozen at module load:
 *
 *   tap     — 10 ms.   Scanner rectangle lock.
 *   focus   — [6, 20, 6].  Room focus change (canvas tap or twin).
 *   capture — [40].  Shutter-close moment in intake.
 *   arrive  — [6, 30, 6, 30, 6].  ArrivalChapter settle beat.
 *
 * Any call outside this set fails the TS `HapticKind` type at build
 * time AND fails a runtime guard below (belt + suspenders — a
 * `triggerHaptic(x as any)` wouldn't type-check but could happen in
 * a fixture). A dev console warning surfaces an out-of-vocabulary
 * kind.
 *
 * Suppression chain (short-circuits in order):
 *
 *   1. preferences.haptics === "off" → no vibrate, count "off"
 *   2. navigator.vibrate missing (iOS Safari) → no vibrate, count
 *      "unsupported" once per session
 *   3. (prefers-reduced-motion: reduce) active AND
 *      data-motion-explicit ≠ "full" → no vibrate, count
 *      "reduced-motion"
 *   4. otherwise → navigator.vibrate(HAPTIC_PATTERNS[kind]),
 *      count "attempted"
 *
 * The dispatcher never throws; a `.vibrate()` throw (some embedded
 * web views) is caught and swallowed — haptics are fire-and-forget.
 */

import { usePreferences } from "@design/preferences";
import {
  incrementHapticAttempted,
  incrementHapticSuppressed,
  incrementHapticUnsupported,
} from "./telemetry";

// ---------- Vocabulary (finite; frozen at module load) ---------------

/**
 * The reserved haptic vocabulary. Frozen so a runtime addition is
 * impossible; the type alias below locks the set at compile time.
 *
 * The patterns are chosen to feel distinct on Laura's hand without
 * ever being "loud." `arrive` is the longest (five beats, ~110 ms)
 * because it's the ceremony haptic; it fires once per chapter.
 */
export const HAPTIC_PATTERNS = Object.freeze({
  tap: [10],
  focus: [6, 20, 6],
  capture: [40],
  arrive: [6, 30, 6, 30, 6],
}) satisfies Readonly<Record<string, readonly number[]>>;

export type HapticKind = keyof typeof HAPTIC_PATTERNS;

// Freeze every inner array so the dispatcher's passed reference
// cannot be mutated downstream.
for (const v of Object.values(HAPTIC_PATTERNS)) {
  Object.freeze(v);
}

// ---------- Capability probe -----------------------------------------

let probedSupported: boolean | null = null;
let unsupportedReportedThisSession = false;

/**
 * Is `navigator.vibrate` present? Probed once per module load; later
 * calls are cheap.
 */
export function hapticsSupported(): boolean {
  if (probedSupported !== null) return probedSupported;
  probedSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function";
  return probedSupported;
}

/**
 * For tests only — reset the session-level "unsupported already
 * reported" latch + re-probe the capability.
 */
export function resetHapticsForTests(): void {
  probedSupported = null;
  unsupportedReportedThisSession = false;
}

// ---------- Dispatch -------------------------------------------------

/**
 * Fire the haptic named by `kind` if all suppression checks pass.
 * Returns `true` if `navigator.vibrate` was invoked, `false` on any
 * suppression reason. Never throws.
 */
export function triggerHaptic(kind: HapticKind): boolean {
  // Runtime vocabulary guard. The TS type already constrains `kind`
  // at compile time, but a fixture or a `(x as any)` escape hatch
  // could slip through. Fall through to a dev warning; return false.
  const pattern = HAPTIC_PATTERNS[kind as HapticKind];
  if (!pattern) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[pang] triggerHaptic: out-of-vocabulary kind ${JSON.stringify(kind)}`,
      );
    }
    return false;
  }

  // 1. Preferences off → suppressed-off.
  if (usePreferences.getState().haptics !== "on") {
    incrementHapticSuppressed("off");
    return false;
  }

  // 2. navigator.vibrate missing → suppressed-unsupported (once per
  //    session at the module's unsupported counter, every call at the
  //    suppressed-unsupported counter).
  if (!hapticsSupported()) {
    if (!unsupportedReportedThisSession) {
      unsupportedReportedThisSession = true;
      incrementHapticUnsupported();
    }
    incrementHapticSuppressed("unsupported");
    return false;
  }

  // 3. (prefers-reduced-motion: reduce) with no explicit motion=full
  //    override → suppressed-reduced-motion. Doctrine: a pulse of
  //    vibration is motion; the collector opted into reduced motion
  //    for a reason.
  if (
    typeof document !== "undefined" &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const motionExplicit =
      document.documentElement.dataset["motionExplicit"];
    if (prefersReduced && motionExplicit !== "full") {
      incrementHapticSuppressed("reduced-motion");
      return false;
    }
  }

  // 4. Fire.
  try {
    const ok = navigator.vibrate(pattern as number[]);
    incrementHapticAttempted();
    // navigator.vibrate returns boolean on some browsers, undefined
    // on others; treat anything non-false as success.
    return ok !== false;
  } catch {
    // Some embedded web views throw on vibrate. Count as attempted
    // (we called it) but return false.
    incrementHapticAttempted();
    return false;
  }
}
