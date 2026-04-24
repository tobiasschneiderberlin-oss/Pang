/**
 * PANG — audio + haptics barrel (iter #15).
 *
 * Re-exports the public surface of the `src/audio/` family so
 * consumers import from `@/audio` rather than spelunking into
 * individual files. The internal graph implementation, the context
 * factory, and the telemetry counters are exposed here only where
 * call sites outside the module need them.
 *
 * Primitives codified in this family:
 *
 *   71 — acoustic-body-as-opt-in (context factory is the only door)
 *   72 — haptic-vocabulary-limited (triggerHaptic / HAPTIC_PATTERNS)
 *   73 — silence-default (DEFAULT_PREFERENCES: audioSpatial/haptics = "off")
 *
 * See `PANG_Primitives_2026.md` for enforcement notes.
 */

export {
  getAudioContext,
  peekAudioContext,
  recordUserGesture,
  closeAudioContext,
  resetAudioContextFactory,
} from "./context";

export {
  startRoomBed,
  stopRoomBed,
  setFocusedWork,
  resetGraphForTests,
  peekGraph,
} from "./graph";

export {
  HAPTIC_PATTERNS,
  type HapticKind,
  triggerHaptic,
  hapticsSupported,
  resetHapticsForTests,
} from "./haptics";

export {
  type AudioState,
  type AudioReason,
  type HapticSuppressionReason,
  getAudioCounters,
  getHapticCounters,
  resetAudioTelemetry,
  emitAudioStateSpan,
  emitAudioGraphDebugSpan,
} from "./telemetry";
