/**
 * PANG — The Room's acoustic body (iter #15).
 *
 * A single shared low-amplitude filtered-noise source that plays
 * through a PannerNode (HRTF) whose position tracks the focused
 * work's `Work.position`. The Room is *one* acoustic body, not a
 * chorus; per-work drones / colour-to-frequency mapping is a v2
 * concern.
 *
 * Graph topology:
 *
 *   BufferSource (looped brown noise) →
 *     BiquadFilter (low-pass, 400 Hz) →
 *       PannerNode (HRTF, positioned at focused work) →
 *         GainNode (master, ramps 0 → -42 dBFS on turn-on) →
 *           ctx.destination
 *
 * Master gain starts at 0 even when the context is alive — the ramp
 * from 0 to target over ~600 ms IS the "turn on" gesture Laura
 * feels. Turn-off ramps target → 0 over 300 ms before the factory
 * closes the context; there's no abrupt guillotine.
 *
 * Focus emphasis modulates the master gain multiplicatively:
 * ×1.2 when a work is focused, ×0.8 when none. The modulation is a
 * one-shot linear ramp over 200 ms on focus change — it does not
 * run a per-frame RAF.
 *
 * v1 uses `AudioBufferSourceNode` looping a 2-second brown-noise
 * buffer generated once in JS (Paul Kellet algorithm, mono).
 * AudioWorklet earns its keep when we synthesize per-work material;
 * v1 doesn't.
 */

import type { Work } from "@/room/types";
import {
  getAudioContext,
  closeAudioContext,
  peekAudioContext,
} from "./context";
import { emitAudioGraphDebugSpan } from "./telemetry";

// ---------- Tuning constants -----------------------------------------

/** Low-pass cutoff — `Ambient 1: Music for Airports` register. */
const LOWPASS_HZ = 400;
const LOWPASS_Q = 0.7;

/**
 * Master target (linear gain, converted from -42 dBFS). The ambient
 * bed target; well below speech level. Multiplied by the focus
 * factor at runtime.
 */
const MASTER_TARGET_DB = -42;
const MASTER_TARGET_LINEAR = Math.pow(10, MASTER_TARGET_DB / 20);

const RAMP_ON_S = 0.6;
const RAMP_OFF_S = 0.3;
const RAMP_FOCUS_S = 0.2;

const FOCUS_BOOST = 1.2;
const FOCUS_DIM = 0.8;

/** Two-second looped buffer. The longer the loop, the less audible
 *  the seam; two seconds is inaudible for brown noise and keeps the
 *  allocation small (mono, 44.1k × 2s ≈ 88 kB). */
const BUFFER_DURATION_S = 2;

// ---------- Module-local graph state ---------------------------------

interface GraphNodes {
  readonly source: AudioBufferSourceNode;
  readonly filter: BiquadFilterNode;
  readonly panner: PannerNode;
  readonly master: GainNode;
}

let nodes: GraphNodes | null = null;
let focusFactor = FOCUS_DIM; // starts unfocused

// ---------- Public API -----------------------------------------------

/**
 * Start (or re-start) the acoustic room bed. Acquires the context
 * via the guarded factory; if the context is null (preference off,
 * no gesture, no Web Audio support) this call is a no-op.
 *
 * Idempotent — calling twice is safe; the second call refreshes the
 * master ramp but does not reconstruct the graph.
 */
export function startRoomBed(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (!nodes) {
    nodes = buildGraph(ctx);
    nodes.source.start();
  }

  // Ramp master gain 0 → target over RAMP_ON_S.
  rampMasterTo(ctx, MASTER_TARGET_LINEAR * focusFactor, RAMP_ON_S);

  emitAudioGraphDebugSpan({
    chain: ["source", "filter", "panner", "master", "destination"],
    masterGain: nodes.master.gain.value,
    panner: {
      x: nodes.panner.positionX.value,
      y: nodes.panner.positionY.value,
      z: nodes.panner.positionZ.value,
    },
  });
}

/**
 * Fade the room bed out, disconnect + null the graph, and close the
 * context. The master gain ramps target → 0 over RAMP_OFF_S before
 * the context closes, so Laura hears a fade, not a guillotine.
 *
 * Returns a promise that resolves once the ramp completes and the
 * context is closed. Production callers typically don't await (the
 * preference write has already fired, the gain ramp is audible);
 * tests await to assert end-state.
 */
export async function stopRoomBed(): Promise<void> {
  const ctx = peekAudioContext();
  if (!ctx || !nodes) return;

  rampMasterTo(ctx, 0, RAMP_OFF_S);

  // Let the ramp complete before closing the context. `setTimeout`
  // is enough here; the AudioParam schedule runs on the audio
  // thread, and the close happens after the main-thread wakes.
  await new Promise<void>((resolve) =>
    setTimeout(resolve, RAMP_OFF_S * 1000 + 20),
  );

  try {
    nodes.source.stop();
  } catch {
    // Already stopped — fine.
  }
  nodes.source.disconnect();
  nodes.filter.disconnect();
  nodes.panner.disconnect();
  nodes.master.disconnect();
  nodes = null;

  closeAudioContext("opt-in");
}

/**
 * Set the focused work. The panner's position tracks the work's
 * `Work.position` (cartesian metres, room-frame); the master gain's
 * focus factor climbs to 1.2 (focused) or drops to 0.8 (unfocused,
 * pass `null`).
 */
export function setFocusedWork(work: Work | null): void {
  const ctx = peekAudioContext();
  if (!ctx || !nodes) {
    // Persist the intent even if the graph isn't alive — a later
    // `startRoomBed()` will read focusFactor to ramp on.
    focusFactor = work ? FOCUS_BOOST : FOCUS_DIM;
    return;
  }

  if (work) {
    const [x, y, z] = work.position;
    nodes.panner.positionX.linearRampToValueAtTime(
      x,
      ctx.currentTime + RAMP_FOCUS_S,
    );
    nodes.panner.positionY.linearRampToValueAtTime(
      y,
      ctx.currentTime + RAMP_FOCUS_S,
    );
    nodes.panner.positionZ.linearRampToValueAtTime(
      z,
      ctx.currentTime + RAMP_FOCUS_S,
    );
    focusFactor = FOCUS_BOOST;
  } else {
    focusFactor = FOCUS_DIM;
  }

  rampMasterTo(ctx, MASTER_TARGET_LINEAR * focusFactor, RAMP_FOCUS_S);

  emitAudioGraphDebugSpan({
    chain: ["source", "filter", "panner", "master", "destination"],
    masterGain: nodes.master.gain.value,
    panner: work
      ? { x: work.position[0], y: work.position[1], z: work.position[2] }
      : undefined,
  });
}

// ---------- Test hooks -----------------------------------------------

/** For tests only. */
export function resetGraphForTests(): void {
  nodes = null;
  focusFactor = FOCUS_DIM;
}

/** For tests only — peek at the current graph nodes. */
export function peekGraph(): GraphNodes | null {
  return nodes;
}

// ---------- Helpers --------------------------------------------------

function buildGraph(ctx: AudioContext): GraphNodes {
  const source = ctx.createBufferSource();
  source.buffer = generateBrownNoiseBuffer(ctx);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = LOWPASS_HZ;
  filter.Q.value = LOWPASS_Q;

  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 10;
  panner.rolloffFactor = 1;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 0;
  panner.coneOuterGain = 0;
  // Default position: centred at the back wall. `setFocusedWork`
  // overrides once a work takes focus.
  panner.positionX.value = 0;
  panner.positionY.value = 1.5;
  panner.positionZ.value = -2.99;

  const master = ctx.createGain();
  master.gain.value = 0; // starts silent; ramp is the turn-on gesture

  source.connect(filter);
  filter.connect(panner);
  panner.connect(master);
  master.connect(ctx.destination);

  return { source, filter, panner, master };
}

/**
 * Paul Kellet's brown-noise algorithm, running mono over
 * BUFFER_DURATION_S seconds. Produces a low-frequency-weighted
 * noise with a natural tail. Generated once per context; looped by
 * the source node.
 */
function generateBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * BUFFER_DURATION_S);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5; // amplitude normalised; source stays quiet via master gain
  }
  return buffer;
}

function rampMasterTo(
  ctx: AudioContext,
  target: number,
  seconds: number,
): void {
  if (!nodes) return;
  const gain = nodes.master.gain;
  // Cancel any prior schedule so ramps compose cleanly on rapid flips.
  gain.cancelScheduledValues(ctx.currentTime);
  // Set the current value explicitly so the linear ramp has an
  // anchor. Reading `.value` returns the computed current value from
  // the audio thread.
  gain.setValueAtTime(gain.value, ctx.currentTime);
  gain.linearRampToValueAtTime(target, ctx.currentTime + seconds);
}
