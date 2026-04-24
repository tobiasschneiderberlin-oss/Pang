"use client";

/**
 * PANG — enrichment panel.
 *
 * The DOM surface for iteration #5's data rendered on iteration #6's
 * surface: a museum-style timeline (`<dl>`) of provenance entries +
 * a paragraph of P-LLM-authored `bioMuji`. Mounts beside the focused
 * work, sibling to `DocumentsChapter` and `FocusedWorkPanel`.
 *
 * Rendering discipline — iteration #6 codify target #2 ("ink
 * attribution is structural, not decorative"):
 *
 *   - Timeline entries are contributor-assembled facts; their ink
 *     attribution is `data-pang-source="gallery"` (or "museum", or
 *     "prior-owner" — all three land under the same "gallery" ink
 *     bucket for now; a future deepening can widen the palette).
 *   - `bioMuji` is P-LLM prose; its ink attribution is
 *     `data-pang-source="ai"`. Attribution is on the elements
 *     themselves so the audit harness can grep for "ai" at any depth
 *     without needing a container-aware selector.
 *
 * State shapes (read from `useEnrichment.stateOf(workId)`):
 *
 *   - "none"       → render nothing. The panel does not explain itself
 *                    in the absence of data.
 *   - "enriching"  → render nothing (no chatter, no spinner; muji).
 *                    The absence is the state.
 *   - "ready"      → load the cached payload (`readEnrichmentCache`),
 *                    render the timeline + bio.
 *   - "stale"      → same as ready — rendering "what we have" beats
 *                    rendering nothing; the reconcile pass will refresh.
 *   - "failed"     → render nothing. The status is stored; a later
 *                    surface picks up the retry affordance.
 *
 * Observability: `enrichment.panel.render` fires once per (workId →
 * ready transition) — the first frame where the panel paints real
 * data for a given focus. Subsequent re-renders (progress ticks,
 * focus changes) do not re-fire. The event is the evidence that
 * iteration #5 data reached iteration #6's surface.
 *
 * Accessibility: the panel is polite chrome; no focus trap, no
 * landmark collision. `<aside aria-label="provenance and context">`
 * names it in the landmark tree; the timeline `<dl>` + bio `<p>`
 * are screen-reader-reachable without extra ARIA.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useWorks } from "@/stores/works";
import { useEnrichment, ENRICHMENT_NONE } from "@/stores/enrichment";
import { readEnrichmentCache } from "@/enrichment/cache";
import type {
  ContributorRole,
  EnrichmentOutput,
  ProvenanceContext,
  TimelineEntry,
} from "@/enrichment/schema";
import { enrichmentPanelRenderEvent } from "@/documents/otel";
import { ENRICHMENT_PANEL_LABEL } from "@/ai/enrichment/voice";
import { BULLET_SEPARATOR } from "@/ai/chapter/voice";

export function EnrichmentPanel(): ReactElement | null {
  const focusedId = useWorks((s) => s.focusedId);
  // Fall back to the module-scoped `ENRICHMENT_NONE` singleton — a
  // freshly allocated `{ kind: "none" }` on every call hands React an
  // unstable snapshot and trips `useSyncExternalStore`'s cache warning
  // (observed in Playwright e2e as "infinite loop").
  const state = useEnrichment((s) =>
    focusedId ? s.byWorkId[focusedId] ?? ENRICHMENT_NONE : ENRICHMENT_NONE,
  );

  // `loaded` is stamped with the workId the payload was fetched for;
  // at render time we compare against the currently focused work and
  // treat any mismatch as "no payload." This derives the reset-on-
  // focus-change without calling `setState` synchronously inside the
  // effect (React 19 `react-hooks/set-state-in-effect` lint: setState
  // in effect bodies cascades renders — the derived comparison has no
  // such cost).
  const [loaded, setLoaded] = useState<{
    readonly workId: string;
    readonly payload: EnrichmentOutput;
  } | null>(null);
  const payload: EnrichmentOutput | null =
    loaded && focusedId && loaded.workId === focusedId ? loaded.payload : null;
  // Latch the `enrichment.panel.render` event per work so a payload
  // re-render (hash drift, same work) fires exactly once.
  const emittedForWorkRef = useRef<string | null>(null);

  // Load the cached payload on transitions into `ready` / `stale` for
  // the current focused work. The effect only writes when the async
  // read completes — never synchronously — so the stale-payload reset
  // happens in render (via the `loaded.workId === focusedId` compare)
  // rather than via a cascade.
  useEffect(() => {
    if (!focusedId) return;
    if (state.kind !== "ready" && state.kind !== "stale") return;
    let cancelled = false;
    void (async () => {
      const out = await readEnrichmentCache(focusedId);
      if (cancelled || !out) return;
      setLoaded({ workId: focusedId, payload: out });
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedId, state.kind]);

  // Emit the render event on first paint per-work. The ref resets
  // when focus leaves so a later re-focus re-fires (new attention
  // window).
  useEffect(() => {
    if (!focusedId || !payload) return;
    if (emittedForWorkRef.current === focusedId) return;
    emittedForWorkRef.current = focusedId;
    enrichmentPanelRenderEvent(
      focusedId,
      payload.timeline.length,
      payload.artistContext.bioMuji.length > 0,
    );
  }, [focusedId, payload]);

  useEffect(() => {
    return () => {
      emittedForWorkRef.current = null;
    };
  }, [focusedId]);

  if (!focusedId) return null;
  if (!payload) return null;

  return (
    <Panel
      workId={focusedId}
      payload={payload}
    />
  );
}

function Panel(props: {
  readonly workId: string;
  readonly payload: EnrichmentOutput;
}): ReactElement {
  const timeline = useMemo(
    () => [...props.payload.timeline].sort(sortTimeline),
    [props.payload.timeline],
  );
  const bio = props.payload.artistContext.bioMuji;

  return (
    <aside
      className="pointer-events-auto absolute bottom-8 right-8 flex max-w-sm flex-col gap-4 bg-paper p-4"
      style={{ borderRadius: 0 }}
      aria-label={ENRICHMENT_PANEL_LABEL}
      data-pang-work-id={props.workId}
    >
      {timeline.length > 0 && (
        <dl className="flex flex-col gap-2 text-sm">
          {timeline.map((entry, index) => (
            <TimelineRow key={timelineKey(entry, index)} entry={entry} />
          ))}
        </dl>
      )}
      {bio && (
        <p
          className="text-sm text-ink-ai"
          data-pang-source="ai"
        >
          {bio}
        </p>
      )}
    </aside>
  );
}

// ---------- Timeline row ----------------------------------------------

function TimelineRow(props: { readonly entry: TimelineEntry }): ReactElement {
  const { entry } = props;
  const source = inkForRole(entry.contributorRole);
  return (
    <div className="flex flex-col gap-0.5">
      <dt
        className="flex gap-2 text-ink"
        data-pang-source={source}
      >
        <span className="tabular-nums text-ink-muted">
          {entry.year !== null ? entry.year : "—"}
        </span>
        <span>{entry.location}</span>
        <span aria-hidden="true" className="text-ink-muted">
          {BULLET_SEPARATOR}
        </span>
        <span className="text-ink-muted">
          {contextLabel(entry.context)}
        </span>
      </dt>
      {entry.note && (
        <dd
          className="pl-10 text-xs text-ink-muted"
          data-pang-source={source}
        >
          {entry.note}
        </dd>
      )}
    </div>
  );
}

// ---------- Helpers ---------------------------------------------------

/**
 * Sort timeline entries: nulls last, then ascending by year. Stable
 * on equal years (Array.sort is already stable in V8 / JSC since 2019).
 */
function sortTimeline(a: TimelineEntry, b: TimelineEntry): number {
  if (a.year === null && b.year === null) return 0;
  if (a.year === null) return 1;
  if (b.year === null) return -1;
  return a.year - b.year;
}

function timelineKey(entry: TimelineEntry, index: number): string {
  return `${entry.year ?? "null"}/${entry.location}/${index}`;
}

/**
 * Map a context enum to a short, sentence-case label. Mirrors the
 * voice-corpus register: observational, no evaluation, no marketing.
 * Kept inline (not in `voice.ts`) because the set is tiny and local
 * to this surface — a separate export would pay for itself only once.
 */
function contextLabel(context: ProvenanceContext): string {
  switch (context) {
    case "museum":
      return "museum";
    case "fair":
      return "fair";
    case "studio":
      return "studio";
    case "private":
      return "private";
    case "auction":
      return "auction";
    default: {
      const _never: never = context;
      void _never;
      return "—";
    }
  }
}

/**
 * Map a contributor role to the `data-pang-source` bucket. All three
 * contributor roles land under "gallery" for now — the distinction
 * surfaces only in the label chrome, not the ink palette. A future
 * widening can split this into three buckets; today the palette
 * (four inks, per `PANG_DS`) doesn't have the room.
 */
function inkForRole(
  _role: ContributorRole,
): "gallery" {
  return "gallery";
}
