/**
 * PANG — RAF perf budget.
 *
 * Meters frame time in a ring buffer; when the sampled p95 exceeds
 * the target (a *sustained* drop below the framerate floor), signals
 * a DPR step-down. One-way for the session — once the renderer has
 * degraded, it stays degraded until the next page load. Oscillation
 * (up / down / up) is worse than a permanent slightly-softer image;
 * the collector reads a changing image as a bug, a softer image as a
 * style.
 *
 * Why p95 and not mean: a single janky frame during tab-switch or GC
 * would otherwise trip the degrade. p95 surfaces sustained pressure
 * without reacting to a one-frame hitch.
 *
 * Why a budget at all: the room renders at `min(window.devicePixelRatio, 2)`
 * on mount. On tier-B devices (WebGL2, no WebGPU) that can push ~8M
 * fragments per frame on a Retina laptop — cheap when the wall holds
 * a single work, expensive once it holds twenty. The budget lets the
 * renderer back off to a DPR the device can sustain, instead of
 * dropping frames at full resolution.
 *
 * Pure module, no DOM access — the caller (`TheRoomCanvas`) owns the
 * `renderer.resize(w, h, dpr * scale)` call on scale change. Testable
 * under Node's test runner without a browser shim.
 */

/**
 * The RAF budget surface. A thin value object: `sample` on every
 * frame, read `scale` when deciding the DPR to resize the renderer
 * with, subscribe via `onScaleChange` to react on the frame the
 * decision lands.
 */
export interface FrameBudget {
  /** Record one frame's elapsed time in milliseconds. */
  sample(frameMs: number): void;
  /**
   * Scale factor applied to the renderer's DPR. Starts at 1. Only
   * decreases. Multiplied against the native devicePixelRatio at
   * resize time.
   */
  readonly scale: number;
  /**
   * Subscribe to scale changes. Fires synchronously from `sample`
   * when a degrade is committed. Returns an unsubscribe thunk.
   */
  onScaleChange(listener: (scale: number) => void): () => void;
  /** Reset everything. Primarily for tests. */
  reset(): void;
  /**
   * Inspect the current p95 estimate in ms. Returns `null` when the
   * ring buffer hasn't filled yet. Exposed for the Tweaks menu / dev
   * overlays; not read by production code.
   */
  currentP95Ms(): number | null;
}

export interface FrameBudgetOptions {
  /**
   * p95 threshold above which we degrade (ms). Default 22 — a hair
   * above 50fps. Chosen so a steady 60fps with occasional jitter
   * stays under the threshold; a sustained 45–50fps trips it.
   */
  readonly targetP95Ms?: number;
  /** Ring buffer size in frames. Default 60 (~1s at 60fps). */
  readonly windowFrames?: number;
  /** DPR scale step. Default 0.25 → 1 → 0.75 → 0.5. */
  readonly step?: number;
  /** Minimum scale floor. Default 0.5 (half-DPR). */
  readonly minScale?: number;
  /**
   * Minimum frames between degrade decisions. Default 120 (~2s).
   * Prevents a single sustained spike from walking the scale down
   * in a single second; each degrade gets evaluated on fresh data.
   */
  readonly cooldownFrames?: number;
}

/** Create a new budget. Fresh ring buffer, `scale: 1`, no listeners. */
export function createFrameBudget(
  opts: FrameBudgetOptions = {},
): FrameBudget {
  const target = opts.targetP95Ms ?? 22;
  const n = opts.windowFrames ?? 60;
  const step = opts.step ?? 0.25;
  const floor = opts.minScale ?? 0.5;
  const cooldown = opts.cooldownFrames ?? 120;

  // Backing buffer. `Float32Array` over `number[]` because frame
  // sampling happens every RAF tick and we want zero GC pressure
  // from grow-on-push semantics.
  const buf = new Float32Array(n);
  let idx = 0;
  let filled = 0;
  let scale = 1;
  // Start the cooldown *elapsed* so the first full window can
  // trigger immediately. Without this a pathologically-slow startup
  // would buffer two full windows before the first degrade.
  let framesSinceDegrade = cooldown;
  const listeners = new Set<(s: number) => void>();

  function currentP95Ms(): number | null {
    if (filled < n) return null;
    // Small n: sort + index is cleaner than a selection algorithm
    // and ~60 comparisons amortised across 2s of samples is nothing.
    const sorted = Array.from(buf).sort((a, b) => a - b);
    // `Math.floor(0.95 * n)` lands on the 57th element for n=60,
    // which is the 95th-percentile slot (5% = 3 samples above).
    const i = Math.floor(0.95 * n);
    // `Float32Array` indexing is defined at runtime but TS requires
    // the assertion because the return type is `number | undefined`
    // under `noUncheckedIndexedAccess`.
    return sorted[i] ?? null;
  }

  function sample(ms: number): void {
    // Clamp catastrophic inputs. A dt of 500ms (tab backgrounded,
    // then foregrounded) would poison the buffer for a full second
    // after return. Clamp at 100ms (=10fps) so one bad frame caps
    // its own influence on the p95.
    const clamped = ms < 0 ? 0 : ms > 100 ? 100 : ms;
    buf[idx] = clamped;
    idx = (idx + 1) % n;
    if (filled < n) filled += 1;
    framesSinceDegrade += 1;

    // Fast exits before the sort.
    if (scale <= floor) return;
    if (filled < n) return;
    if (framesSinceDegrade < cooldown) return;

    const p95 = currentP95Ms();
    if (p95 === null) return;
    if (p95 <= target) return;

    const next = Math.max(floor, scale - step);
    if (next === scale) return;

    scale = next;
    framesSinceDegrade = 0;
    for (const cb of listeners) cb(scale);
  }

  function onScaleChange(listener: (s: number) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function reset(): void {
    buf.fill(0);
    idx = 0;
    filled = 0;
    scale = 1;
    framesSinceDegrade = cooldown;
  }

  // Expose `scale` through a getter so callers see the latest value
  // without the budget having to re-emit on every read.
  return {
    sample,
    get scale(): number {
      return scale;
    },
    onScaleChange,
    reset,
    currentP95Ms,
  };
}
