"use client";

/**
 * PANG — the outcome chapter (iter #11).
 *
 * The ceremonial completion of spine moment #8. Iter #10 landed the
 * round-trip (ask → compose → dispatch → gallery confirm → push →
 * reconcile → status flips to verified → emissive lifts). What it
 * didn't land was the *moment* itself: when the collector returns to
 * The Room holding a freshly-confirmed work, the wall should play the
 * 14-second outcome ceremony — not just quietly brighten.
 *
 * Two variants share this renderer:
 *   - confirmation: the work's emissive rises 0→1 over the place beat
 *     (rate-6 curve via `arrivalFactor`); settle + ready hold.
 *   - decline: no emissive change — the work stays dormant — but the
 *     narration + settle + ready beats still play. The collector has
 *     a felt moment, not a silent state flip.
 *
 * Surface is DOM-over-canvas. The Room stays rendered underneath
 * (its own client island, mounted as a sibling by the route); this
 * component paints the wall-caption + dismiss affordance + drives
 * the per-frame arrival factor via the Room's imperative handle.
 * `pointerEvents: none` on everything except the dismiss zone
 * freezes the Room's pinch / pan / focus grammar for the chapter's
 * duration — the ceremony is the ceremony.
 *
 * Load-bearing behaviours:
 *
 *   - Reduced-motion clamp (P19). `prefers-reduced-motion: reduce`
 *     pins the arrival factor to 1.0 on the first paint of the place
 *     beat — the emissive arrives instantly, the narration + settle
 *     + ready still play. No animation, no curve.
 *   - Latch-on-ready. The moment the ready beat first fires, we call
 *     `markOutcomeChapterShown(workId, new Date().toISOString())`.
 *     Idempotent by the store; a StrictMode double-mount cannot
 *     re-latch. A force-quit before ready leaves the latch null and
 *     replays on next Room entry (the correct failure mode per the
 *     brief's fifth declaration).
 *   - Frame-time histogram. Each RAF tick records a delta; on
 *     dismiss we emit `chapter.outcome.frame_time_ms` with p50 /
 *     p95 / p99 / mean / max. A widened p99 tail is the pre-Laura
 *     signal that DOM + WebGPU are contending.
 *   - Span sequence. `chapter.outcome.plan` on mount, beat_enter /
 *     beat_exit on edges, ready once, dismiss on the user's tap,
 *     frame_time_ms on unmount.
 *
 * Composition mirrors `ArrivalChapter.tsx` — same RAF + diff +
 * slot pattern — but the slot set is narrower (narration only) and
 * the stage is the existing Room, not a scratch scene.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  activeBeats,
  ariaLineForActive,
  arrivalFactor,
  chapterOutcomeBeatEnterEvent,
  chapterOutcomeBeatExitEvent,
  chapterOutcomeDismissEvent,
  chapterOutcomeFrameTimeEvent,
  chapterOutcomePlanEvent,
  chapterOutcomeReadyEvent,
  diffActiveBeats,
  findBeatByKind,
  isReady,
  DISMISS_AFFORDANCE,
  type ActiveBeat,
  type Beat,
  type OutcomeChapterPlan,
} from "@/ai/chapter";
import type { TheRoomClientHandle } from "@/room/dom/TheRoomClient";
import { useVerification } from "@/stores/verification";

export interface OutcomeChapterProps {
  /** Immutable plan built by `planConfirmationChapter` / `planDeclineChapter`. */
  readonly plan: OutcomeChapterPlan;
  /** Imperative handle to the Room — drives per-frame arrival factor (confirmation). */
  readonly roomRef: React.RefObject<TheRoomClientHandle | null>;
  /** Fired after dismiss; the mount unmounts this component on the same tick. */
  readonly onDone: () => void;
  /**
   * Test seam: when set, skip the `matchMedia` probe and clamp the
   * reduced-motion branch explicitly. Playwright's reduced-motion
   * project sets this via a query-string flag; unit tests flip it
   * directly.
   */
  readonly forceReducedMotion?: boolean;
}

/**
 * Surface-level a11y label for the outcome chapter. Sentence case, no
 * marketing. Matches the arrival surface's `aria-label` pattern so
 * screen-reader landmarks read consistently across chapters.
 */
const OUTCOME_SURFACE_LABEL = "outcome";

export function OutcomeChapter(props: OutcomeChapterProps): ReactElement {
  const { plan, roomRef, onDone } = props;
  const markOutcomeChapterShown = useVerification(
    (s) => s.markOutcomeChapterShown,
  );

  // Chapter-local clock. RAF advances; React re-renders each frame.
  const [tMs, setTMs] = useState(0);

  // One-time side effect: emit the plan event.
  useEffect(() => {
    chapterOutcomePlanEvent(
      plan.variant,
      plan.workId,
      plan.decidedAt,
      plan.totalMs,
      plan.beats.length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reduced-motion: either the prop seam or the system probe wins.
  // Probed once at mount — changing the setting mid-chapter is not a
  // supported flow (the chapter is 14 s; a setting flip during that
  // window is pathological).
  const reducedMotion = useMemo(() => {
    if (props.forceReducedMotion === true) return true;
    if (props.forceReducedMotion === false) return false;
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RAF loop + frame-time sampling. Samples accrue across the run;
  // dismissed / unmount emits the histogram once.
  const frameSamplesRef = useRef<number[]>([]);
  useEffect(() => {
    const startedAt = performance.now();
    let lastTick = startedAt;
    let rafId = 0;
    const tick = (): void => {
      const now = performance.now();
      frameSamplesRef.current.push(now - lastTick);
      lastTick = now;
      setTMs(now - startedAt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Derive the active set + ready state + place-beat factor each tick.
  const active = useMemo(() => activeBeats(plan, tMs), [plan, tMs]);
  const readyNow = isReady(plan, tMs);
  const placeBeat = useMemo(() => findBeatByKind(plan, "place"), [plan]);

  // Arrival factor — drives the Room's emissive rise on confirmation.
  // Decline has no place beat, so `placeBeat` is null and the factor
  // is a no-op. Reduced-motion pins the factor to 1.0 at the first
  // tick of the beat; the curve is clamped, not removed.
  const arrival = useMemo(
    () => computeOutcomeArrival(placeBeat, tMs, reducedMotion),
    [placeBeat, tMs, reducedMotion],
  );

  // Drive the scene pose each frame. The imperative handle ignores
  // the call when the scene isn't mounted; the pending stash catches
  // pre-mount writes.
  useEffect(() => {
    roomRef.current?.setArrivalFactor(plan.workId, arrival);
  }, [roomRef, plan.workId, arrival]);

  // Beat edge events — diff against the previous tick's id set.
  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const { entered, exited } = diffActiveBeats(prevActiveIdsRef.current, active);
    if (entered.length || exited.length) {
      for (const id of entered) {
        const beat = plan.beats.find((b) => b.id === id);
        if (beat) {
          chapterOutcomeBeatEnterEvent(
            plan.variant,
            plan.workId,
            id,
            beat.kind,
            tMs,
          );
        }
      }
      for (const id of exited) {
        const beat = plan.beats.find((b) => b.id === id);
        if (beat) {
          chapterOutcomeBeatExitEvent(
            plan.variant,
            plan.workId,
            id,
            beat.kind,
            tMs,
          );
        }
      }
    }
    const next = new Set<string>();
    for (const a of active) next.add(a.beat.id);
    prevActiveIdsRef.current = next;
  }, [active, plan, tMs]);

  // Latch on ready — fires exactly once, marks the verification store.
  const readyEmittedRef = useRef(false);
  useEffect(() => {
    if (readyNow && !readyEmittedRef.current) {
      readyEmittedRef.current = true;
      const shownAt = new Date().toISOString();
      markOutcomeChapterShown(plan.workId, shownAt);
      chapterOutcomeReadyEvent(plan.variant, plan.workId, tMs);
    }
  }, [readyNow, tMs, plan.variant, plan.workId, markOutcomeChapterShown]);

  // Frame-time histogram + chapter-done signal. On unmount only.
  const onDismiss = useCallback(
    (via: "pointer" | "keyboard") => {
      if (!readyNow) return;
      chapterOutcomeDismissEvent(plan.variant, plan.workId, tMs, via);
      chapterOutcomeFrameTimeEvent(
        plan.variant,
        plan.workId,
        frameSamplesRef.current,
      );
      onDone();
    },
    [readyNow, tMs, plan.variant, plan.workId, onDone],
  );

  // Keyboard dismiss. Enter + Space on ready only.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!readyNow) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      onDismiss("keyboard");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readyNow, onDismiss]);

  const onPointer = (): void => {
    onDismiss("pointer");
  };

  // Narration slot — the chapter's only visible chrome apart from
  // the dismiss affordance. The beat kind is the variant itself
  // (see planner), so the slot is either `"confirmation"` or
  // `"decline"` text.
  const narrationSlot = pickSlot(active, (a) => {
    if (a.beat.kind === "confirmation" || a.beat.kind === "decline") return a;
    return null;
  });

  const ariaLine = ariaLineForActive(active);

  return (
    <main
      className="absolute inset-0 h-dvh w-full overflow-hidden"
      aria-label={OUTCOME_SURFACE_LABEL}
      onPointerDown={onPointer}
      role={readyNow ? "button" : undefined}
      tabIndex={readyNow ? 0 : -1}
      style={{
        // The chapter freezes Room gestures for its duration: pointer
        // events pass through everywhere except the dismiss affordance
        // zone, which lifts `pointer-events: auto` on `ready`.
        pointerEvents: readyNow ? "auto" : "none",
      }}
      data-pang-outcome-variant={plan.variant}
      data-pang-outcome-ready={readyNow ? "true" : "false"}
    >
      {/* Narration slot — wall-caption zone at the bottom of the
          viewport. Sentence case, AI-ink. The voice-corpus string
          is the acknowledgement; no badge, no tick, no "verified!"
          chrome. */}
      {narrationSlot && narrationSlot.beat.payload?.kind === "text" && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto max-w-2xl px-8 text-center"
          style={{ opacity: narrationSlot.envelope }}
          aria-hidden="true"
          data-pang-outcome-narration="true"
        >
          <p
            className="text-lg text-ink-ai"
            data-pang-source={narrationSlot.beat.payload.source}
          >
            {narrationSlot.beat.payload.text}
          </p>
        </div>
      )}

      {/* Dismiss affordance — sits at the very bottom once the
          chapter has reached `ready`. Voice corpus string; sentence
          case; the only interactive chrome on the surface. */}
      {readyNow && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-xs uppercase tracking-wide text-ink-ai"
          aria-hidden="true"
          data-pang-outcome-dismiss="true"
        >
          {DISMISS_AFFORDANCE}
        </span>
      )}

      {/* ARIA live region — screen-reader users hear each beat edge
          as it enters. Polite + atomic; keyed on the announcement so
          each transition re-fires the live region. */}
      <LiveLine line={ariaLine} />
    </main>
  );
}

// ---------- Helpers ---------------------------------------------------

/**
 * Pure arrival-factor derivation for the outcome chapter. Exported so
 * unit tests can cover the reduced-motion clamp + decline-no-place
 * branch without a React mount.
 *
 *   - Decline variant has no `place` beat → placeBeat is null →
 *     return 0 (the Room's verified-flag already pins the rest
 *     state; no GL change is driven by the chapter).
 *   - Reduced-motion on confirmation → clamp: 0 before the beat
 *     starts, 1 inside the beat's window (and after). The emissive
 *     arrives instantly on the first tick of `place.startMs`.
 *   - Otherwise → the rate-6 `arrivalFactor` curve.
 */
export function computeOutcomeArrival(
  placeBeat: Beat | null,
  tMs: number,
  reducedMotion: boolean,
): number {
  if (!placeBeat) return 0;
  if (reducedMotion) return tMs >= placeBeat.startMs ? 1 : 0;
  return arrivalFactor(placeBeat, tMs);
}

function pickSlot(
  active: readonly ActiveBeat[],
  choose: (a: ActiveBeat) => ActiveBeat | null,
): ActiveBeat | null {
  for (const a of active) {
    const picked = choose(a);
    if (picked) return picked;
  }
  return null;
}

function LiveLine(props: { line: string | null }): ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      key={props.line ?? "empty"}
    >
      {props.line ?? ""}
    </div>
  );
}
