"use client";

/**
 * PANG — the arrival chapter.
 *
 * A timed choreography that plays when a freshly-scanned work lands on
 * the wall. The chapter is the confirmation — there is no "added!"
 * toast, no "view in collection" CTA. The camera glides, the work
 * resolves into its hanging pose, the voice line settles in, the
 * pre-filed artifacts fold in beside it, the gallery attribution
 * appears, the artist context reads as a wall text, and the settle
 * holds before Laura is invited back to the wall.
 *
 * The full state runs ~42s. The null state (no artifacts, no gallery,
 * no bio) runs ~31s — the null is a *wall text*, not a placeholder.
 *
 * The chapter state machine is pure (`src/ai/chapter/*`). This
 * component is the renderer:
 *
 *   1. `planChapter()` on mount produces an immutable `ChapterPlan`.
 *   2. A RAF loop advances `tMs` (chapter-local ms since start).
 *   3. `activeBeats(plan, tMs)` returns the beats that should paint
 *      this tick, each with envelope + progress.
 *   4. Each render consumes the active list: text beats populate the
 *      wall-caption slot, artifact beats populate the carrier stack,
 *      attribution + context populate their own slots.
 *   5. `arrivalFactor` + `overlayOpacity` drive the GL pose + the
 *      captured-still overlay — both pulled from the *same* rate-6
 *      curve as the beat envelopes, so chrome and scene share a hand.
 *
 * Observability: five event kinds (plan / beat.enter / beat.exit /
 * ready / dismiss), emitted exactly once per edge via
 * `diffActiveBeats()` + a latched "ready was crossed" flag. A missing
 * capability (no View Transitions API) emits `chapter.fallback`.
 *
 * Laura's dismiss is the sole affordance. Pointer or keyboard; both
 * only fire once the chapter has reached `ready`.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { IntakeOutput } from "@/ai/tools/artwork";
import { entryFromIntake, useWorks, type CollectionEntry } from "@/stores/works";
// Client-only mount: `TheRoomClient` transitively imports
// `three/webgpu`, which touches `self` at module load and crashes Node.
// `"use client"` marks the hydration boundary but not the SSR boundary;
// `next/dynamic({ ssr: false })` (inside `TheRoomClientDynamic`) is the
// SSR boundary that keeps `/scan` server-renderable. The imperative
// handle type is a type-only import — safe for SSR, no runtime trace.
// See `src/room/dom/TheRoomClientDynamic.tsx`.
import { TheRoomClientDynamic as TheRoomClient } from "@/room/dom/TheRoomClientDynamic";
import type { TheRoomClientHandle } from "@/room/dom/TheRoomClient";
import {
  activeBeats,
  ariaLineForActive,
  arrivalFactor,
  chapterBeatEnterEvent,
  chapterBeatExitEvent,
  chapterDismissEvent,
  chapterFallbackEvent,
  chapterPlanEvent,
  chapterReadyEvent,
  diffActiveBeats,
  findBeatByKind,
  isReady,
  overlayOpacity,
  planChapter,
  NULL_REFLECTION,
  CONTEXT_LABEL,
  ATTRIBUTION_LABEL,
  DISMISS_AFFORDANCE,
  SURFACE_LABEL,
  type ActiveBeat,
} from "@/ai/chapter";
import { ArtifactCarrier } from "./ArtifactCarrier";

export interface ArrivalChapterProps {
  readonly output: IntakeOutput;
  readonly imageBlobUrl: string;
  readonly onDone: () => void;
}

export function ArrivalChapter(props: ArrivalChapterProps): ReactElement {
  const addEntry = useWorks((s) => s.addEntry);
  const setFocusedId = useWorks((s) => s.setFocusedId);

  // Mint the entry id once — a re-render must not produce a second
  // copy on the wall. `entryFromIntake` is idempotent given the same
  // inputs, but caching the instance keeps the intent legible.
  const entryRef = useRef<CollectionEntry | null>(null);
  if (entryRef.current === null) {
    entryRef.current = entryFromIntake(props.output, props.imageBlobUrl);
  }
  const entry = entryRef.current;

  // Plan the chapter once. Pure function of `(output, workId, imageUrl)`
  // — the same plan is safe to re-derive in a StrictMode double-mount.
  const plan = useMemo(
    () => planChapter(props.output, entry.id, props.imageBlobUrl),
    [props.output, entry.id, props.imageBlobUrl],
  );

  // Chapter-local clock. The RAF loop sets this each frame; the
  // component re-renders each tick. React 19's batching is fast
  // enough that this pattern doesn't regress INP even on a tier-B
  // device — the per-frame work is ~1ms of array filter + two number
  // writes.
  const [tMs, setTMs] = useState(0);

  // Imperative handle to the Room so the RAF loop can drive the
  // per-frame arrival factor without triggering re-renders of the
  // underlying canvas.
  const roomRef = useRef<TheRoomClientHandle | null>(null);

  // One-time side effects: place the work + aim the camera + emit
  // the `chapter.plan` event. The deps array is intentionally empty
  // — the entry id is stable for the life of this surface and the
  // plan shape is captured at mount.
  useEffect(() => {
    addEntry(entry);
    setFocusedId(entry.id);

    chapterPlanEvent(plan.workId, plan.shape, plan.totalMs);

    // Detect missing View Transitions API — an older browser would
    // have skipped the review → arrival morph. We still land here
    // (the route pushed directly); name the fallback so the
    // regression is observable.
    if (
      typeof document !== "undefined" &&
      typeof document.startViewTransition !== "function"
    ) {
      chapterFallbackEvent(0, "view-transitions", "unsupported");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Latch so `chapter.ready` emits exactly once per chapter.
  const readyEmittedRef = useRef(false);
  // Previous-tick active-id set for beat-edge diffing.
  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  // RAF loop. The chapter is a pure function of `tMs`; we only need
  // to advance the clock and let React paint each frame.
  useEffect(() => {
    const startedAt = performance.now();
    let rafId = 0;
    const tick = (): void => {
      const now = performance.now();
      setTMs(now - startedAt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Derive every render artefact from `(plan, tMs)`. Pure, cheap.
  const active = useMemo(() => activeBeats(plan, tMs), [plan, tMs]);
  const readyNow = isReady(plan, tMs);
  const placeBeat = useMemo(() => findBeatByKind(plan, "place"), [plan]);
  const arrival = arrivalFactor(placeBeat, tMs);
  const overlay = overlayOpacity(placeBeat, tMs);

  // Drive the scene pose each frame. The imperative handle ignores
  // the call when the scene isn't mounted yet; the pending stash in
  // `TheRoomCanvas` catches any pre-mount writes so no frames leak.
  useEffect(() => {
    roomRef.current?.setArrivalFactor(entry.id, arrival);
  }, [entry.id, arrival]);

  // Emit beat enter / exit events. We diff against the previous
  // tick's id set so every edge fires exactly once regardless of
  // render cadence.
  useEffect(() => {
    const { entered, exited } = diffActiveBeats(prevActiveIdsRef.current, active);
    if (entered.length || exited.length) {
      for (const id of entered) {
        const beat = plan.beats.find((b) => b.id === id);
        if (beat) chapterBeatEnterEvent(id, beat.kind, tMs);
      }
      for (const id of exited) {
        const beat = plan.beats.find((b) => b.id === id);
        if (beat) chapterBeatExitEvent(id, beat.kind, tMs);
      }
    }
    const next = new Set<string>();
    for (const a of active) next.add(a.beat.id);
    prevActiveIdsRef.current = next;
  }, [active, plan, tMs]);

  // Latch the `chapter.ready` event — fires the first tick after the
  // ready beat's start has been crossed.
  useEffect(() => {
    if (readyNow && !readyEmittedRef.current) {
      readyEmittedRef.current = true;
      chapterReadyEvent(tMs);
    }
  }, [readyNow, tMs]);

  // Keyboard dismiss. Enter + Space are both acceptable; other keys
  // are ignored. Listener is attached for the life of the component
  // and guarded against pre-ready presses — the affordance only
  // exists once `readyNow` is true.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!readyNow) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      chapterDismissEvent(tMs, "keyboard");
      props.onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readyNow, tMs, props]);

  const onPointer = (): void => {
    if (!readyNow) return;
    chapterDismissEvent(tMs, "pointer");
    props.onDone();
  };

  // ---- Derived slot content -------------------------------------
  //
  // The chapter's DOM chrome is organised into slots, not a linear
  // component tree — because beats overlap, a render tree keyed by
  // beat would double-paint the narration slot during the narration-
  // riding-approach window. Slots let each beat kind claim its own
  // zone, and the driver's envelope lights only the right one.

  const narrationSlot = pickSlot(active, (a) => {
    if (a.beat.kind === "narration" || a.beat.kind === "null-reflection") {
      return a;
    }
    return null;
  });
  const attributionSlot = pickSlot(active, (a) =>
    a.beat.kind === "attribution" ? a : null,
  );
  const contextSlot = pickSlot(active, (a) =>
    a.beat.kind === "context" ? a : null,
  );
  const artifactSlots = active.filter((a) => a.beat.kind === "artifact");
  const isNullReflection =
    narrationSlot?.beat.kind === "null-reflection";

  const ariaLine = ariaLineForActive(active);

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-paper"
      aria-label={SURFACE_LABEL}
      onPointerDown={onPointer}
      role={readyNow ? "button" : undefined}
      tabIndex={readyNow ? 0 : -1}
      style={{ viewTransitionName: "intake-frame" }}
    >
      {/* The Room — the work is already on the wall by the time the
          chapter starts drawing. The imperative handle forwards the
          per-frame arrival factor so the pose rides the same rate-6
          curve as the DOM overlay. */}
      <div className="absolute inset-0">
        <TheRoomClient ref={roomRef} />
      </div>

      {/* Captured-still overlay. Holds at full opacity while the
          camera approaches + the work settles; dissolves as the
          `place` beat lands. The rate-6 decay is the conjugate of
          `arrivalFactor` — their envelopes sum to 1 everywhere after
          place.startMs (see envelope.test.ts § conservation). */}
      <div
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{ opacity: overlay }}
        aria-hidden="true"
      >
        {/* next/image is wrong here: the source is a device-local
            blob: URL, no optimisation pipeline can touch it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={props.imageBlobUrl}
          alt=""
          className="max-h-[70vh] max-w-[90vw] object-contain"
          style={{ viewTransitionName: "add-to-wall" }}
        />
      </div>

      {/* Context slot — "About the artist." + bioMuji. Sits in the
          top-left quadrant like a wall plaque, well away from the
          work's centre. Only paints while the context beat is
          active. */}
      {contextSlot && contextSlot.beat.payload?.kind === "context" && (
        <aside
          className="pointer-events-none absolute left-8 top-24 max-w-sm flex flex-col gap-2"
          style={{ opacity: contextSlot.envelope }}
          aria-hidden="true"
        >
          <span className="text-xs uppercase tracking-wide text-ink-ai">
            {CONTEXT_LABEL}
          </span>
          <p className="text-sm text-ink-ai" data-pang-source="ai">
            {contextSlot.beat.payload.body}
          </p>
        </aside>
      )}

      {/* Attribution slot — "Recorded from [gallery]". Sits just
          above the narration so the chain reads vertically:
          narration (AI) → attribution (gallery) → artifacts (docs). */}
      {attributionSlot &&
        attributionSlot.beat.payload?.kind === "attribution" && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-40 mx-auto flex max-w-md flex-col items-center gap-1 text-center"
            style={{ opacity: attributionSlot.envelope }}
            aria-hidden="true"
          >
            <span className="text-xs uppercase tracking-wide text-ink-ai">
              {ATTRIBUTION_LABEL}
            </span>
            <span className="text-sm text-ink">
              {attributionSlot.beat.payload.galleryName}
            </span>
          </div>
        )}

      {/* Artifact procession. Cards stack on the right; each rides
          its own envelope. MAX_ARTIFACTS (3) means the stack never
          grows beyond a single museum-tag group. */}
      {artifactSlots.length > 0 && (
        <div
          className="pointer-events-none absolute right-8 top-1/2 flex -translate-y-1/2 flex-col gap-4"
          aria-hidden="true"
        >
          {artifactSlots.map((a) => {
            if (a.beat.payload?.kind !== "artifact") return null;
            return (
              <ArtifactCarrier
                key={a.beat.id}
                artifact={a.beat.payload.artifact}
                envelope={a.envelope}
                progress={a.progress}
              />
            );
          })}
        </div>
      )}

      {/* Narration / null-reflection slot. The wall-caption zone at
          the bottom of the viewport. Two shapes share it:

            - narration: one P-LLM arrivalLine, AI-ink
            - null-reflection: voice-corpus pair ("The wall holds the
              work. / The gallery has not yet answered."), rendered
              as two visual lines so the reflection reads as wall
              text, not a run-on sentence. */}
      {narrationSlot && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto max-w-2xl px-8 text-center"
          style={{ opacity: narrationSlot.envelope }}
          aria-hidden="true"
        >
          {isNullReflection ? (
            <div className="flex flex-col gap-1 text-lg text-ink-ai">
              <span data-pang-source="voice-corpus">
                {NULL_REFLECTION.first}
              </span>
              <span data-pang-source="voice-corpus">
                {NULL_REFLECTION.second}
              </span>
            </div>
          ) : narrationSlot.beat.payload?.kind === "text" ? (
            <p
              className="text-lg text-ink-ai"
              data-pang-source={narrationSlot.beat.payload.source}
            >
              {narrationSlot.beat.payload.text}
            </p>
          ) : null}
        </div>
      )}

      {/* Dismiss affordance — sits at the very bottom once the
          chapter has reached `ready`. Voice corpus string; sentence
          case; the only interactive element on the surface. */}
      {readyNow && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-xs uppercase tracking-wide text-ink-ai"
          aria-hidden="true"
        >
          {DISMISS_AFFORDANCE}
        </span>
      )}

      {/* ARIA live region — screen-reader users hear each beat edge
          as it enters. `aria-atomic` + a key on the content forces a
          re-announce per transition rather than per character. */}
      <LiveLine line={ariaLine} />
    </main>
  );
}

// ---------- Helpers ---------------------------------------------------

/**
 * Pick the first `ActiveBeat` for which `choose` returns non-null.
 * The active list is already in plan order; the first match is the
 * chronologically-newest for slot kinds that don't overlap with
 * themselves. Returns null when no active beat owns this slot.
 */
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

/**
 * Screen-reader live region. Polite (doesn't interrupt), atomic
 * (announces the whole line, not diffs). Hidden from sight — the
 * sighted surface already renders the same content in the narration
 * slot. Keyed on the line so each new announcement re-fires the
 * region even if the DOM content shape would otherwise suppress it.
 */
function LiveLine(props: { line: string | null }): ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {props.line ?? ""}
    </div>
  );
}
