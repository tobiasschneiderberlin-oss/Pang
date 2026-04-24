"use client";

/**
 * PANG — documents chapter renderer.
 *
 * The DOM side of the documents-chapter primitive (iteration #6).
 * Mounts when a focused work carries documents; plays the staggered
 * reveal `settle → artifact.1..n → context → ready` over the
 * 6000–12000 ms budget. Renders nothing for a focused work with no
 * documents — the spine is the work, not the paperwork.
 *
 * The pattern mirrors `ArrivalChapter.tsx`: the state machine is
 * pure (`src/ai/chapter/plan.ts` + `driver.ts`); this component is
 * the renderer. A RAF loop advances `tMs`; `activeBeats(plan, tMs)`
 * returns the beats painting this tick; each artifact beat maps to
 * a tactile card (`TactileArtifactCard`) that delegates the tap to
 * `useWorks.setActiveViewer()`.
 *
 * Lifecycle semantics — iteration #6 codify target #3 ("chapter lives
 * by focus, dies on leave"):
 *
 *   - Mount: a `focusedId` change into a work with documents. The
 *     chapter plans once and emits `documents.chapter.start`.
 *   - Ready: first tick past `readyAtMs`. The chapter stops advancing;
 *     the cards settle; `documents.chapter.complete` emits once.
 *   - Unmount: focus changed, work removed, or the viewer opened
 *     mid-chapter (iteration #6 "viewer-as-escape-hatch"). Emits
 *     `documents.chapter.abort` with the reason.
 *
 * Observability: every beat entry/exit would duplicate the ARIA live
 * region (arrival chapter already owns that ladder); the documents
 * chapter emits only the three lifecycle events above. The beat-level
 * visibility is evidence in itself — we trust the render path.
 *
 * Staggered reveal p75 ≤ 16.67 ms (P23, P10): the chapter renders
 * DOM nodes with opacity + tiny vertical drift; no layout thrash,
 * no filters, no shadows. The card's `opacity` + `translate3d` ride
 * the rate-6 envelope curve — composited paths only.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { ReactNode } from "react";
import {
  activeBeats,
  diffActiveBeats,
  isReady,
  persistentArtifactSlots,
  planDocumentsChapter,
  type ActiveBeat,
  type DocumentsChapterPlan,
} from "@/ai/chapter";
import type { ChapterArtifact } from "@/ai/chapter";
import {
  BULLET_SEPARATOR,
  DOCUMENTS_LABEL,
} from "@/ai/chapter/voice";
import { useWorks, type DocumentRecord } from "@/stores/works";
import {
  documentsChapterAbortEvent,
  documentsChapterCompleteEvent,
  documentsChapterStartEvent,
} from "@/documents/otel";

export interface DocumentsChapterProps {
  readonly workId: string;
  readonly documents: readonly DocumentRecord[];
}

/**
 * Connector: reads the focused work from the store and mounts the
 * chapter iff documents are present. Re-mounts on `focusedId` change
 * (via the `key`) so the chapter plays once per focus, never again.
 */
export function DocumentsChapterConnector(): ReactElement | null {
  const focusedId = useWorks((s) => s.focusedId);
  const entries = useWorks((s) => s.entries);
  if (!focusedId) return null;
  const entry = entries.find((e) => e.id === focusedId);
  if (!entry) return null;
  const documents = entry.documents ?? [];
  if (documents.length === 0) return null;
  return (
    <DocumentsChapter
      key={entry.id}
      workId={entry.id}
      documents={documents}
    />
  );
}

export function DocumentsChapter(props: DocumentsChapterProps): ReactElement {
  const setActiveViewer = useWorks((s) => s.setActiveViewer);
  const activeViewer = useWorks((s) => s.activeViewer);

  // Plan the chapter once per mount. Pure `(documents, workId, focusedAt)`
  // — the same inputs produce byte-identical output, safe under
  // StrictMode's double-invoke.
  const focusedAtRef = useRef<string | null>(null);
  if (focusedAtRef.current === null) {
    focusedAtRef.current = new Date().toISOString();
  }
  const plan: DocumentsChapterPlan = useMemo(
    () =>
      planDocumentsChapter(
        props.documents,
        props.workId,
        focusedAtRef.current ?? new Date().toISOString(),
      ),
    [props.documents, props.workId],
  );

  // Chapter-local clock.
  const [tMs, setTMs] = useState(0);

  // Latch so `documents.chapter.complete` emits exactly once.
  const completeEmittedRef = useRef(false);
  // Latch so `documents.chapter.abort` emits at most once per mount.
  const abortEmittedRef = useRef(false);
  // Edge-diff set for future per-beat emission (unused today; wired
  // so a later telemetry deepening lands as a one-line change).
  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  // One-time side effects: emit start; set up the abort-on-unmount
  // guard. The unmount runs whether focus shifted (the connector's
  // `key` change drops us) or a parent surface tore us down.
  useEffect(() => {
    documentsChapterStartEvent(
      plan.workId,
      plan.shape.artifactCount,
      plan.totalMs,
    );
    const startedAt = performance.now();
    return () => {
      if (abortEmittedRef.current) return;
      if (completeEmittedRef.current) return;
      const elapsed = performance.now() - startedAt;
      abortEmittedRef.current = true;
      documentsChapterAbortEvent(plan.workId, elapsed, "unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RAF loop. Stops once the chapter is ready — no point burning
  // frames on a static settled state. (`ready` has an unbounded
  // duration; `activeBeats` clamps envelope at 1 so the final frame
  // is the rest state.)
  useEffect(() => {
    let rafId = 0;
    const startedAt = performance.now();
    const tick = (): void => {
      const now = performance.now() - startedAt;
      setTMs(now);
      // `isReady` uses the plan's `readyAtMs`; once past, we stop.
      if (now >= plan.readyAtMs) return;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [plan.readyAtMs]);

  // If the viewer opens *before* the chapter hits ready, that's the
  // "viewer-as-escape-hatch" abort the failure-mode declaration calls
  // out. Emit once and latch; the chapter keeps rendering behind the
  // overlay (the viewer stacks above it at z-index).
  const readyNow = isReady(plan, tMs);
  useEffect(() => {
    if (!activeViewer) return;
    if (abortEmittedRef.current) return;
    if (readyNow) return;
    abortEmittedRef.current = true;
    documentsChapterAbortEvent(plan.workId, tMs, "viewer_opened_pre_ready");
  }, [activeViewer, readyNow, plan.workId, tMs]);

  // Latch the `documents.chapter.complete` event on the first tick
  // after the chapter reaches ready.
  useEffect(() => {
    if (!readyNow) return;
    if (completeEmittedRef.current) return;
    completeEmittedRef.current = true;
    documentsChapterCompleteEvent(plan.workId, plan.shape.artifactCount, tMs);
  }, [readyNow, plan.workId, plan.shape.artifactCount, tMs]);

  // Maintain the active-id set; used by a future per-beat telemetry
  // deepening, but kept up to date today so the ledger of active
  // beats is always fresh.
  const active = useMemo(() => activeBeats(plan, tMs), [plan, tMs]);
  useEffect(() => {
    const { entered, exited } = diffActiveBeats(prevActiveIdsRef.current, active);
    if (entered.length || exited.length) {
      const next = new Set<string>();
      for (const a of active) next.add(a.beat.id);
      prevActiveIdsRef.current = next;
    }
  }, [active]);

  // ---- Slot selection ------------------------------------------------
  //
  // The documents chapter has two slot kinds:
  //   - artifacts: a vertical stack on the right, same anchor as the
  //     arrival chapter's procession.
  //   - context: a single voice-corpus line at the bottom-right,
  //     playing once the procession ends.
  //
  // We don't surface `settle` or `ready` visually — they're the
  // chapter's breath + terminal state; the DOM holds the artifact cards
  // at rest during those.

  // Artifact slots: the chapter reveals the cards in sequence, but
  // once a card's beat ends it stays at rest (opacity 1, drift 0) —
  // the documents chapter is the reveal PLUS the resting chrome. Using
  // `active` directly would unmount a card the moment its beat ends,
  // which turns tactile evidence into evanescent flash cards.
  //
  // So we walk `plan.beats` for artifact beats, and for each:
  //   - If `tMs < startMs`: not yet revealed, skip.
  //   - Within the beat: use live envelope + progress.
  //   - Past the beat end: settled rest state (envelope 1, progress 1).
  const artifactSlots = useMemo(
    () => persistentArtifactSlots(plan.beats, tMs),
    [plan.beats, tMs],
  );
  const contextSlot = pickSlot(active, (a) =>
    a.beat.kind === "context" ? a : null,
  );

  const onTap = (fileRef: string | null): void => {
    if (!fileRef) return;
    setActiveViewer(`${plan.workId}:${fileRef}`);
  };

  return (
    <section
      className="pointer-events-none absolute inset-0"
      aria-label={DOCUMENTS_LABEL}
      data-pang-chapter="documents"
    >
      {/* Artifact procession. Anchored to the right of the viewport,
          same metric as the arrival chapter's carrier stack — so the
          two chapters share a mental anchor. Each card catches its
          own pointer events; the surrounding section does not. */}
      {artifactSlots.length > 0 && (
        <div
          className="absolute right-8 top-1/2 flex -translate-y-1/2 flex-col gap-4"
        >
          {artifactSlots.map((a) => {
            if (a.beat.payload?.kind !== "artifact") return null;
            return (
              <TactileArtifactCard
                key={a.beat.id}
                artifact={a.beat.payload.artifact}
                envelope={a.envelope}
                progress={a.progress}
                onTap={onTap}
              />
            );
          })}
        </div>
      )}

      {/* Context slot — voice-corpus closing line. Lives under the
          procession so the stack reads vertically, evidence first,
          the line second. */}
      {contextSlot && contextSlot.beat.payload?.kind === "context" && (
        <div
          className="absolute right-8 bottom-8 max-w-xs text-right"
          style={{ opacity: contextSlot.envelope }}
          aria-hidden="true"
        >
          <p
            className="text-xs uppercase tracking-wide text-ink-ai"
            data-pang-source="voice-corpus"
          >
            {contextSlot.beat.payload.body}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------- TactileArtifactCard ---------------------------------------

/**
 * The tap-aware sibling of `ArtifactCarrier`. Same visual language —
 * sharp corners, 2px `border-ink-ai`, sentence-case label — but this
 * one is tappable when the document carries `fileRef`. A card without
 * a fileRef still renders (the intake may have surfaced fields without
 * bytes); tapping is a no-op, and the card does not render a hover or
 * pressed state that would lie about the gesture.
 *
 * Pointer + keyboard: the card is a `<button>` when tappable, a plain
 * `<div>` otherwise. The button role gives the screen reader the
 * correct affordance without requiring ARIA.
 */
interface TactileArtifactCardProps {
  readonly artifact: ChapterArtifact;
  readonly envelope: number;
  readonly progress: number;
  readonly onTap: (fileRef: string | null) => void;
}

function TactileArtifactCard(
  props: TactileArtifactCardProps,
): ReactElement {
  const opacity = clamp01(props.envelope);
  const drift = (1 - clamp01(props.progress)) * 8;
  const tappable = props.artifact.fileRef !== null;
  const inner = <CardInner artifact={props.artifact} />;

  const style = {
    opacity,
    transform: `translate3d(0, ${drift}px, 0)`,
    // Explicit sharp corners; tailwind's `rounded-*` utilities are
    // absent here but we set the value directly to document intent
    // (P9 — containers have `border-radius: 0`).
    borderRadius: 0,
  } as const;

  if (!tappable) {
    return (
      <div
        className="pointer-events-none flex w-64 max-w-[70vw] flex-col gap-2 border-[2px] border-ink-ai bg-paper p-4"
        style={style}
        data-pang-source="ai"
        aria-hidden="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="pointer-events-auto flex w-64 max-w-[70vw] flex-col gap-2 border-[2px] border-ink-ai bg-paper p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-ai"
      style={style}
      data-pang-source="ai"
      data-pang-kind={props.artifact.kind}
      onPointerDown={(e) => {
        // Prevent the focus-dismissing tap on the Room surface from
        // firing in addition to this card's tap.
        e.stopPropagation();
        props.onTap(props.artifact.fileRef);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        props.onTap(props.artifact.fileRef);
      }}
    >
      {inner}
    </button>
  );
}

function CardInner(props: { readonly artifact: ChapterArtifact }): ReactNode {
  return (
    <>
      <span className="text-xs uppercase tracking-wide text-ink-ai">
        {props.artifact.label}
      </span>
      <ul className="flex flex-col gap-1 text-sm text-ink">
        {props.artifact.fields.map(([key, value]) => (
          <li key={key} className="flex gap-2">
            <span className="text-ink-ai">{key}</span>
            <span aria-hidden="true" className="text-ink-ai">
              {BULLET_SEPARATOR}
            </span>
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- Helpers ----------------------------------------------------

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

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 1;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
