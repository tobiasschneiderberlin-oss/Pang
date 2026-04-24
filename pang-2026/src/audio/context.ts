/**
 * PANG — AudioContext factory (iter #15, primitive 71).
 *
 * "acoustic-body-as-opt-in" — the AudioContext is never constructed
 * until (a) the collector has flipped `audioSpatial` to `"on"` AND
 * (b) a user gesture has been recorded this session. Cold install is
 * silent because the context doesn't exist; accidental-autoplay is
 * impossible because the gesture is a precondition to construction,
 * not to a downstream resume.
 *
 * Discipline: `new AudioContext(...)` lives in this file only. A
 * repo-wide grep (see `scripts/check-gates.ts` A24 / repo-level
 * review) catches any other module constructing its own. The factory
 * is the only door.
 *
 * Lifecycle:
 *
 *   1. Page loads → audioSpatial is `"off"` → getAudioContext() returns
 *      null. The graph module does nothing.
 *   2. User flips the toggle on (SettingsOverlay) → a user gesture is
 *      recorded as part of the pointer/keyup handler → the next
 *      getAudioContext() call constructs a fresh context and starts
 *      the room bed.
 *   3. `visibilitychange → hidden` → suspend the context (ambient
 *      audio never plays in the background; PANG is within-session).
 *      Resume requires a fresh gesture (browser policy), which the
 *      first tap anywhere in the document satisfies.
 *   4. User flips the toggle off → the graph's master-gain ramps to
 *      0 over 300 ms (the graph module owns the ramp) and then this
 *      factory closes the context + nulls it out. A fresh "on" flip
 *      reconstructs.
 *   5. Unmount (SPA route change away from the Room) → same as toggle
 *      off; no zombie contexts leak across mounts.
 *
 * Every state transition fires `pang.audio.state` with a reason. A
 * construction attempt that the browser refused (autoplay policy,
 * device muted at the OS level) surfaces as
 * `{ state: "suspended", reason: "blocked" }` and increments the
 * `pang.audio.blocked_total` counter.
 */

import { usePreferences } from "@design/preferences";
import { emitAudioStateSpan, type AudioReason } from "./telemetry";

// ---------- Module-local state ---------------------------------------

let ctx: AudioContext | null = null;
let gestureRecorded = false;

// Visibility + preference unsub handles; installed lazily on first
// construction so SSR never touches `document`.
let unsubPreference: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;

/**
 * Record that a user gesture occurred this session. The browser
 * autoplay policy requires a gesture on the handling stack for
 * `new AudioContext()` to start in `running` state. SettingsOverlay
 * calls this inside the toggle's onPointerUp/click handler before
 * calling `getAudioContext()`.
 *
 * Idempotent — once set, stays true for the session. The call is
 * cheap and callable from any event handler; we do NOT call it
 * automatically from a generic document listener because the point
 * is to tie the context's birth to an *explicit* opt-in gesture.
 */
export function recordUserGesture(): void {
  gestureRecorded = true;
}

/**
 * For tests only. Production code flips this via the preferences
 * toggle + recordUserGesture call pair; tests use this to simulate a
 * cold boot.
 */
export function resetAudioContextFactory(): void {
  ctx = null;
  gestureRecorded = false;
  if (unsubPreference) {
    unsubPreference();
    unsubPreference = null;
  }
  if (visibilityHandler && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

/**
 * Peek at the current context without attempting to construct. Graph
 * module uses this for teardown. Production code calls the imperative
 * `getAudioContext()` to acquire + construct.
 */
export function peekAudioContext(): AudioContext | null {
  return ctx;
}

/**
 * Acquire the AudioContext, constructing lazily on first call. Returns
 * `null` if the preference is off, if no gesture has been recorded,
 * or if the browser/platform does not support Web Audio.
 *
 * Idempotent: repeat calls after the first return the same context
 * instance. The graph module constructs its nodes against the
 * returned context; a null return means "don't build anything."
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const pref = usePreferences.getState().audioSpatial;
  if (pref !== "on") return null;
  if (!gestureRecorded) return null;

  if (ctx !== null) return ctx;

  const AudioCtor = resolveAudioContextCtor();
  if (!AudioCtor) return null;

  try {
    ctx = new AudioCtor();
  } catch {
    // Construction itself threw — platform refusal before we ever
    // touched state. Count as blocked and return null; the caller
    // holds silence intact.
    emitAudioStateSpan("closed", "blocked");
    ctx = null;
    return null;
  }

  // A newly-constructed context should be `running` when the calling
  // code paired the construction with a user gesture. If the platform
  // returned `suspended`, treat that as blocked so the telemetry
  // matches the Laura-facing reality (she tapped on; nothing
  // happened).
  if (ctx.state === "suspended") {
    emitAudioStateSpan("suspended", "blocked");
  } else {
    emitAudioStateSpan("running", "opt-in");
  }

  // Install visibility suspension. Not installed up-front because SSR
  // has no `document`.
  if (typeof document !== "undefined" && !visibilityHandler) {
    visibilityHandler = (): void => {
      const current = ctx;
      if (!current) return;
      if (document.hidden && current.state === "running") {
        void current.suspend().then(() => {
          emitAudioStateSpan("suspended", "visibility");
        });
      }
      // Resume-on-visible is NOT automatic: browser policy requires a
      // fresh gesture for `resume()`. The first tap in the document
      // flows through the SettingsOverlay opener or the Room canvas
      // tap path; both call recordUserGesture + prompt a resume.
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  // Install preference-flip subscription. A flip to `"off"` closes the
  // context; the graph module's own teardown (called from the
  // overlay's handler) handles the gain ramp-down before this fires.
  if (!unsubPreference) {
    unsubPreference = usePreferences.subscribe(
      (s) => s.audioSpatial,
      (next) => {
        if (next !== "off") return;
        if (!ctx) return;
        const old = ctx;
        ctx = null;
        void old.close().then(() => {
          emitAudioStateSpan("closed", "opt-in");
        });
      },
    );
  }

  return ctx;
}

/**
 * Close the context explicitly — used on Room unmount. Idempotent;
 * safe to call even if no context was ever constructed.
 */
export function closeAudioContext(reason: AudioReason = "unmount"): void {
  if (!ctx) return;
  const old = ctx;
  ctx = null;
  void old.close().then(() => {
    emitAudioStateSpan("closed", reason);
  });
}

/**
 * Resolve the AudioContext constructor with the Safari prefix
 * fallback. Returns null on platforms where Web Audio is missing
 * (older embedded views, some server-rendered harnesses).
 */
function resolveAudioContextCtor(): typeof AudioContext | null {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}
