/**
 * PANG — audio + haptics telemetry (iter #15).
 *
 * Module-local counters + OTel spans for the audio graph and the
 * haptic dispatcher. Both are deliberately silent systems: when they
 * break, they break in silence, which is the worst kind to debug.
 * This module is the observable half of iter #15's failure-mode
 * declaration (fifth brief declaration, CLAUDE.md § 9).
 *
 * Counters are exported for test assertion — unit tests import the
 * getter to check that the expected suppressions fired. The emit
 * call pipes through `console.debug` in dev (the same shape the OTel
 * collector consumes) so a missing site regression is visible in
 * logs as well as counters.
 *
 * Span shape mirrors the P22 contract — single-line JSON payload,
 * `pang.*` attributes for PANG-local signals, `span` + `durationMs`
 * envelope. The iter #5 collector consumes the shape unchanged.
 */

// ---------- Span types -----------------------------------------------

export type AudioState = "running" | "suspended" | "closed";
export type AudioReason = "opt-in" | "visibility" | "unmount" | "blocked";

export type HapticSuppressionReason =
  | "off"
  | "unsupported"
  | "reduced-motion";

// ---------- Module-local counters ------------------------------------

interface AudioCounters {
  blocked: number;
}
interface HapticCounters {
  unsupported: number;
  suppressedByReason: Record<HapticSuppressionReason, number>;
  attempted: number;
}

const audioCounters: AudioCounters = {
  blocked: 0,
};

const hapticCounters: HapticCounters = {
  unsupported: 0,
  suppressedByReason: {
    off: 0,
    unsupported: 0,
    "reduced-motion": 0,
  },
  attempted: 0,
};

/**
 * Test assertion helpers. Production code never reads these — the
 * emitter is the single channel the OTel collector ingests. Tests
 * read them to assert the right counter moved.
 */
export function getAudioCounters(): Readonly<AudioCounters> {
  return audioCounters;
}
export function getHapticCounters(): Readonly<HapticCounters> {
  return {
    unsupported: hapticCounters.unsupported,
    suppressedByReason: { ...hapticCounters.suppressedByReason },
    attempted: hapticCounters.attempted,
  };
}

/** Reset counters — test hook. Never called in production. */
export function resetAudioTelemetry(): void {
  audioCounters.blocked = 0;
  hapticCounters.unsupported = 0;
  hapticCounters.suppressedByReason = {
    off: 0,
    unsupported: 0,
    "reduced-motion": 0,
  };
  hapticCounters.attempted = 0;
}

// ---------- Emitters -------------------------------------------------

/**
 * Fire the `pang.audio.state` span on every AudioContext state
 * transition. `state` is the new state; `reason` is why the
 * transition was requested.
 */
export function emitAudioStateSpan(
  state: AudioState,
  reason: AudioReason,
): void {
  if (reason === "blocked") audioCounters.blocked++;
  console.debug(
    JSON.stringify({
      span: "pang.audio.state",
      durationMs: 0,
      status: "ok",
      attrs: {
        "pang.audio.state": state,
        "pang.audio.reason": reason,
      },
    }),
  );
}

/**
 * Dev-only span — logs the graph's connection chain and the final
 * master-gain value. Dead-code-eliminated in production bundles (the
 * env check is compile-time substituted by Next).
 */
export function emitAudioGraphDebugSpan(snapshot: {
  readonly chain: readonly string[];
  readonly masterGain: number;
  readonly panner?: { x: number; y: number; z: number };
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.debug(
    JSON.stringify({
      span: "pang.audio.graph_debug",
      durationMs: 0,
      status: "ok",
      attrs: {
        "pang.audio.chain": snapshot.chain.join(" → "),
        "pang.audio.master_gain": snapshot.masterGain,
        ...(snapshot.panner
          ? {
              "pang.audio.panner_x": snapshot.panner.x,
              "pang.audio.panner_y": snapshot.panner.y,
              "pang.audio.panner_z": snapshot.panner.z,
            }
          : {}),
      },
    }),
  );
}

/**
 * Haptic counter increments. The emitter is a single call site per
 * reason — keeps the "did we call it?" audit surface narrow.
 */
export function incrementHapticAttempted(): void {
  hapticCounters.attempted++;
  console.debug(
    JSON.stringify({
      span: "pang.haptics.attempted",
      durationMs: 0,
      status: "ok",
      attrs: { "pang.haptics.total": hapticCounters.attempted },
    }),
  );
}

export function incrementHapticSuppressed(
  reason: HapticSuppressionReason,
): void {
  hapticCounters.suppressedByReason[reason]++;
  console.debug(
    JSON.stringify({
      span: "pang.haptics.suppressed",
      durationMs: 0,
      status: "ok",
      attrs: {
        "pang.haptics.reason": reason,
        "pang.haptics.total":
          hapticCounters.suppressedByReason[reason],
      },
    }),
  );
}

/**
 * Fired once per session the first time a trigger observes
 * `navigator.vibrate` is unavailable. iOS Safari is the canonical
 * hit — this lets a dashboard separate "never called" from "called
 * but device doesn't support it."
 */
export function incrementHapticUnsupported(): void {
  hapticCounters.unsupported++;
  console.debug(
    JSON.stringify({
      span: "pang.haptics.unsupported",
      durationMs: 0,
      status: "ok",
      attrs: { "pang.haptics.total": hapticCounters.unsupported },
    }),
  );
}
