/**
 * PANG — chapter driver.
 *
 * Pure selection logic over a `ChapterPlan`. Given a wall-clock offset
 * `tMs`, returns:
 *
 *   - the set of beats that are currently painting (envelope > 0)
 *   - whether the chapter has reached its `ready` beat (dismissable)
 *
 * The driver holds no state. Callers are free to memoise or
 * short-circuit based on the previous tick — the function is cheap
 * (linear in beat count, which never exceeds ~12).
 *
 * The transition bookkeeping lives in `otel.ts`: the caller passes the
 * last tick's active-beat id set to `diffActiveBeats()`, which returns
 * entered/exited sets suitable for span emission.
 */

import { beatEnvelope, beatProgress } from "./envelope";
import type { ActiveBeat, Beat, ChapterPlanBase } from "./types";

/** Return the beats visible at `tMs`, paired with their envelope. */
export function activeBeats(
  plan: ChapterPlanBase,
  tMs: number,
): readonly ActiveBeat[] {
  const out: ActiveBeat[] = [];
  for (const beat of plan.beats) {
    // Cheap pre-filter: anything strictly outside the window has zero
    // envelope and zero progress contribution.
    if (tMs < beat.startMs) continue;
    const endMs = beat.startMs + beat.durationMs;
    if (tMs >= endMs) continue;
    const envelope = beatEnvelope(beat, tMs);
    if (envelope <= 0) continue;
    out.push({
      beat,
      envelope,
      progress: beatProgress(beat, tMs),
    });
  }
  return out;
}

/** Look up a single beat by kind. Returns the first match, or null. */
export function findBeatByKind(
  plan: ChapterPlanBase,
  kind: Beat["kind"],
): Beat | null {
  for (const b of plan.beats) if (b.kind === kind) return b;
  return null;
}

/** Has the chapter reached its terminal ready beat? */
export function isReady(plan: ChapterPlanBase, tMs: number): boolean {
  return tMs >= plan.readyAtMs;
}

/**
 * Given the previous tick's active-id set + the current tick's active
 * list, return the ids that just entered (rose from 0 to >0) and
 * those that just exited (fell from >0 to 0).
 *
 * Used by the chapter component to emit `chapter.beat.enter` /
 * `chapter.beat.exit` observability events exactly once per edge.
 */
export function diffActiveBeats(
  prevIds: ReadonlySet<string>,
  curr: readonly ActiveBeat[],
): { entered: readonly string[]; exited: readonly string[] } {
  const currIds = new Set<string>();
  for (const a of curr) currIds.add(a.beat.id);
  const entered: string[] = [];
  for (const id of currIds) {
    if (!prevIds.has(id)) entered.push(id);
  }
  const exited: string[] = [];
  for (const id of prevIds) {
    if (!currIds.has(id)) exited.push(id);
  }
  return { entered, exited };
}

/**
 * Collapse the active beats into a single authoritative "narration"
 * payload for the ARIA live region. Rule: announce the most recently
 * entered beat that owns speakable content. If the top beat is a
 * camera / pose beat, fall back to the next speakable beat (or `null`
 * if none).
 *
 * This is intentionally conservative — screen readers re-announce on
 * content change, so the live region should update at most once per
 * beat transition, not per frame.
 */
export function ariaLineForActive(
  active: readonly ActiveBeat[],
): string | null {
  // Prefer beats whose envelope is climbing (rising phase) — those
  // are the "new" thing the user should hear.
  const rising = active.find(
    (a) =>
      a.envelope > 0 &&
      a.envelope < 1 &&
      a.progress < a.beat.fadeInMs / Math.max(a.beat.durationMs, 1),
  );
  const candidate = rising ?? active[active.length - 1];
  if (!candidate) return null;
  const p = candidate.beat.payload;
  if (!p) return null;
  switch (p.kind) {
    case "text":
      return p.text;
    case "artifact":
      return `A ${p.artifact.label} has arrived.`;
    case "attribution":
      return `Recorded from ${p.galleryName}.`;
    case "context":
      return p.label;
    case "camera":
    case "pose":
      return null;
    default: {
      // Exhaustiveness guard — any new BeatPayload kind must land
      // here explicitly.
      const _never: never = p;
      void _never;
      return null;
    }
  }
}
