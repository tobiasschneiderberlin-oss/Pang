/**
 * PANG — preferences persistence (OPFS).
 *
 * The preferences store is in-memory; without this module a refresh
 * resets every opt-in. Iter #15 needs this load-bearing: Laura flips
 * audio on, closes PANG, opens it two days later — the preference
 * survives. Silence-default still wins on a *cold install* (there is
 * no stored file), but once she's made a choice it sticks.
 *
 * One file:
 *
 *   /prefs/index.json — JSON of `Preferences`, validated with
 *                       `PreferencesSchema.safeParse` on hydration.
 *                       Missing / malformed / older-shape files fall
 *                       back to `DEFAULT_PREFERENCES` silently so
 *                       schema drift never strands a collector.
 *
 * Writes go through a 120 ms debounce (preferences can flip on rapid
 * drag of a future slider; we don't want a write per keyframe). The
 * subscription keys on the full preferences object so the debounce
 * coalesces across knobs.
 *
 * Doctrine link: P5 (OPFS, not localStorage) + iter #15 brief §
 * *Settings surface scope* ("OPFS persistence through the existing
 * preferences hydration path — no new storage adapter"). The adapter
 * already existed for works + verification; this is the same pattern,
 * one file instead of many.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  DEFAULT_PREFERENCES,
  PreferencesSchema,
  usePreferences,
  type Preferences,
} from "@design/preferences";

const PREFS_PATH = "prefs/index.json";

/**
 * Read the persisted preferences. On any shape drift (older schema,
 * malformed JSON, bad enum values), return `DEFAULT_PREFERENCES` so
 * the app boots honestly with the silence default intact. The caller
 * decides whether to apply via `usePreferences.getState().hydrate()`.
 */
export async function hydratePreferences(): Promise<Preferences> {
  if (typeof navigator === "undefined") return DEFAULT_PREFERENCES;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const file = await opfsRead(PREFS_PATH);
    if (!file) return DEFAULT_PREFERENCES;
    const text = await file.text();
    const raw = JSON.parse(text);
    const parsed = PreferencesSchema.safeParse(raw);
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    // Silence-default wins on any failure mode.
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Write the preferences snapshot. Best-effort — a thrown OPFS error
 * never blocks the user action; the next successful write gets a
 * fresh shot.
 */
async function writePreferences(p: Preferences): Promise<void> {
  try {
    await opfsWrite(PREFS_PATH, JSON.stringify(p));
  } catch {
    // Non-fatal.
  }
}

/**
 * Module-level reference to the most recently installed flush helper.
 * E2E exposes this through `__PANG.flushPreferencesPersistence` so
 * specs can deterministically wait for the next pending write to
 * land in OPFS without guessing at debounce + I/O latency. Iter #16
 * codified the pattern after fixed `waitForTimeout` and
 * `waitForFunction(file-content poll)` both proved unreliable on
 * chromium-mobile cold-cache CI.
 *
 * Null when no subscription is installed (server-side, OPFS-less
 * navigators, between unsubscribe and re-install). Callers must
 * handle null gracefully.
 */
let activeFlush: (() => Promise<void>) | null = null;

/**
 * Wait for any pending preferences write to complete. Resolves
 * immediately if no write is pending. E2E-safe: the production app
 * does not call this; the helper exists so tests don't have to
 * race the 120 ms debounce.
 */
export async function flushPreferencesPersistence(): Promise<void> {
  if (activeFlush) await activeFlush();
}

/**
 * Subscribe to the preferences store and write every change through
 * a 120 ms debounce. Returns an unsubscribe function the caller keeps
 * alive for the session and drops on unmount.
 *
 * Idempotent: re-installing clears the pending debounce timer, so the
 * next write is the latest snapshot, not a stale mid-drag value.
 *
 * Side-effect: replaces `activeFlush` with a closure that, when
 * called, completes any debounced write *now* and returns the write
 * Promise. Re-installing replaces the previous flush handle; the
 * unsubscribe nulls it.
 */
export function installPreferencesPersistence(): () => void {
  if (typeof navigator === "undefined") return () => {};
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return () => {};
  }

  let pending: ReturnType<typeof setTimeout> | null = null;
  let pendingSnapshot: Preferences | null = null;

  const scheduleWrite = (p: Preferences): void => {
    if (pending !== null) clearTimeout(pending);
    pendingSnapshot = p;
    pending = setTimeout(() => {
      pending = null;
      const snap = pendingSnapshot;
      pendingSnapshot = null;
      if (snap) void writePreferences(snap);
    }, 120);
  };

  // Prime OPFS with the current snapshot on install — covers the
  // case where a hydration-before-install race left a pending write.
  scheduleWrite(projectPersistable(usePreferences.getState() as Preferences));

  const unsubscribe = usePreferences.subscribe(
    (state) => projectPersistable(state as Preferences),
    (next) => scheduleWrite(next),
    // `equalityFn` → shallow compare so an unrelated setter that
    // returns the same object identity doesn't re-fire. Zustand's
    // default is Object.is on the selector output, which is enough
    // because we return a fresh object each time selecting.
  );

  activeFlush = async (): Promise<void> => {
    if (pending !== null && pendingSnapshot !== null) {
      clearTimeout(pending);
      pending = null;
      const snap = pendingSnapshot;
      pendingSnapshot = null;
      await writePreferences(snap);
    }
  };

  return () => {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    pendingSnapshot = null;
    activeFlush = null;
    unsubscribe();
  };
}

/**
 * Pick only the schema-shaped fields from the store (the store also
 * carries the setters). Pure; testable.
 */
export function projectPersistable(state: Preferences): Preferences {
  return {
    timeWarmth: state.timeWarmth,
    warmthMultiplier: state.warmthMultiplier,
    wallGap: state.wallGap,
    density: state.density,
    motion: state.motion,
    confidenceVisibility: state.confidenceVisibility,
    serifWeight: state.serifWeight,
    labelCase: state.labelCase,
    radii: state.radii,
    appearance: state.appearance,
    displayName: state.displayName,
    audioSpatial: state.audioSpatial,
    haptics: state.haptics,
    viewMode: state.viewMode,
  };
}
