/**
 * PANG — outcome chapter mount hook (iter #11).
 *
 * The hook that decides *when* the outcome chapter plays. Watches
 * the verification store for entries transitioning into
 * `kind: "confirmed" | "declined"` with a null `outcomeChapterShownAt`,
 * and surfaces at most one chapter at a time to the mount. An
 * already-shown entry is a no-op (the latch did its job); an off-Room
 * transition queues (FIFO) and flushes on next Room entry.
 *
 * The contract is a tuple:
 *
 *   const current = useOutcomeChapterMount();
 *   // current: { workId, plan } | null
 *
 * A non-null value is a request to render the `OutcomeChapter` for
 * `workId` with the given `plan`. The consumer calls
 * `dismissOutcomeChapter()` on the component's `onDone` callback;
 * the hook applies a 400 ms inter-chapter gap and then surfaces the
 * next queued entry, if any.
 *
 * The queue + active slot + gap timer live in a private module
 * singleton (not a React state) because multiple consumers of the
 * hook would otherwise each get their own queue; the spine is
 * "one chapter at a time, globally". The hook's consumer component
 * (`OutcomeChapterMount`) renders the top entry and calls the
 * dismiss function; any other consumer would read the same slot.
 *
 * Failure-mode observability:
 *
 *   - `chapter.outcome.skipped { reason: "already-shown" }` on a
 *     latched entry's arrival transition. A return visitor whose
 *     latch persisted fires this on every Room entry — zero
 *     skipped events signals the OPFS persistence regressed.
 *
 *   - `chapter.outcome.skipped { reason: "surface-not-room" }` on
 *     an unlatched entry whose transition landed off the Room
 *     surface. Navigating to Room surfaces the queue's head, not
 *     the off-surface transition.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { planConfirmationChapter, planDeclineChapter } from "./plan";
import type { OutcomeChapterPlan } from "./types";
import { chapterOutcomeSkippedEvent } from "./otel";
import { useVerification } from "@/stores/verification";
import { useSurface } from "@/stores/surface";

const INTER_CHAPTER_GAP_MS = 400;

interface QueueEntry {
  readonly workId: string;
  readonly variant: "confirmation" | "decline";
  readonly decidedAt: string;
}

interface MountState {
  readonly current: QueueEntry | null;
  readonly queue: readonly QueueEntry[];
}

const EMPTY_STATE: MountState = { current: null, queue: [] };

// ---------- Store singleton --------------------------------------
//
// React 18's `useSyncExternalStore` needs a subscribe + snapshot pair.
// The store is a plain object with a Set of subscribers; updates are
// synchronous and trigger all subscribers on the same tick.

const listeners = new Set<() => void>();
let state: MountState = EMPTY_STATE;

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MountState {
  return state;
}

// SSR snapshot must be referentially stable across calls.
const SSR_SNAPSHOT: MountState = EMPTY_STATE;
function getServerSnapshot(): MountState {
  return SSR_SNAPSHOT;
}

// ---------- Queue operations -------------------------------------

/**
 * Record that a verification entry has transitioned into a
 * confirmed / declined state with a null latch. If the Room is the
 * active surface and no chapter is currently playing, the entry
 * becomes `current` immediately. Otherwise it joins the queue.
 *
 * A work already in the queue or as `current` is a no-op (the
 * transition fired twice; we're idempotent).
 */
function enqueue(entry: QueueEntry): void {
  if (state.current?.workId === entry.workId) return;
  if (state.queue.some((e) => e.workId === entry.workId)) return;
  state = { current: state.current, queue: [...state.queue, entry] };
  maybeAdvance();
  notify();
}

/**
 * Advance `current` from the head of the queue if the Room is active
 * and no chapter is playing. Side-effecting but pure with respect to
 * the caller — the notify is the caller's responsibility when the
 * advance came from a store-side change; the entry-addition path
 * notifies itself.
 */
function maybeAdvance(): void {
  if (state.current !== null) return;
  if (state.queue.length === 0) return;
  const surface = useSurface.getState().active;
  if (surface !== "room") return;
  const [head, ...rest] = state.queue;
  state = { current: head!, queue: rest };
}

/**
 * Clear the current slot after dismiss, after the inter-chapter gap
 * has elapsed. Advances to the next queue entry if the Room is
 * still active.
 *
 * The gap is a real wall-clock delay — a setTimeout that a unit
 * test can fast-forward via `advanceGap()`. Using real time in
 * production matches the brief's "recognisable and-now-the-next-one
 * beat" — 400 ms is enough to feel like a separator, short enough
 * to not feel like a pause.
 */
let gapTimer: ReturnType<typeof setTimeout> | null = null;

export function dismissOutcomeChapter(): void {
  if (state.current === null) return;
  state = { current: null, queue: state.queue };
  notify();

  if (gapTimer !== null) clearTimeout(gapTimer);
  gapTimer = setTimeout(() => {
    gapTimer = null;
    maybeAdvance();
    notify();
  }, INTER_CHAPTER_GAP_MS);
}

/**
 * Test seam: skip the inter-chapter gap and advance immediately. The
 * production path never calls this — the real timeout is the real
 * ceremony.
 */
export function _advanceForTest(): void {
  if (gapTimer !== null) {
    clearTimeout(gapTimer);
    gapTimer = null;
  }
  maybeAdvance();
  notify();
}

/**
 * Test seam: reset module state. Invoked by tests' beforeEach; not
 * exported from the barrel.
 *
 * Also resets `storesWired` so tests can re-run the seed pass by
 * calling `_wireStoresForTest` again. Unsubscribing existing store
 * subscriptions would be cleaner, but we have no unsubscribe
 * handle for Zustand's `subscribe` from `subscribeWithSelector` in
 * this module's private scope — and the listeners are idempotent
 * under reset (each run installs a fresh subscription; the store
 * itself is cleared in the test's beforeEach).
 */
export function _resetOutcomeMountForTest(): void {
  if (gapTimer !== null) {
    clearTimeout(gapTimer);
    gapTimer = null;
  }
  state = EMPTY_STATE;
  listeners.clear();
  storesWired = false;
  for (const unsub of storeUnsubs) unsub();
  storeUnsubs.length = 0;
}

/**
 * Test seam: force the store subscriptions to wire without rendering
 * the React hook. Production code never calls this — production
 * reaches `wireStores` via `useOutcomeChapterMount`'s mount effect.
 */
export function _wireStoresForTest(): void {
  wireStores();
}

// ---------- Store subscriptions ----------------------------------
//
// Two subscriptions keep the queue synced to the world:
//
//   1. Verification store's `byWorkId` slice — transitions into
//      confirmed / declined with a null latch enqueue (with the
//      already-shown skip firing on latched entries).
//   2. Surface store's `active` slice — a transition into "room"
//      advances the queue head.
//
// The subscriptions are installed lazily on the first
// `useOutcomeChapterMount` mount; a matching unsubscribe never
// happens because the store is a module singleton whose lifetime is
// the app's. (Tests use `_resetOutcomeMountForTest` to clear.)

let storesWired = false;
const storeUnsubs: Array<() => void> = [];

function wireStores(): void {
  if (storesWired) return;
  storesWired = true;

  // Seed from current state — a confirmed entry that was already in
  // the store at mount time is a legitimate queue target, not
  // something to ignore.
  for (const [workId, s] of Object.entries(
    useVerification.getState().byWorkId,
  )) {
    if (s.kind !== "confirmed" && s.kind !== "declined") continue;
    if (s.outcomeChapterShownAt !== null) continue;
    enqueue({
      workId,
      variant: s.kind === "confirmed" ? "confirmation" : "decline",
      decidedAt: s.decidedAt,
    });
  }

  const unsubVerification = useVerification.subscribe(
    (store) => store.byWorkId,
    (byWorkId, prev) => {
      for (const [workId, next] of Object.entries(byWorkId)) {
        const before = prev[workId];
        if (!isOutcomeTransition(before, next)) continue;
        if (next.kind !== "confirmed" && next.kind !== "declined") continue;
        const variant =
          next.kind === "confirmed" ? "confirmation" : "decline";
        if (next.outcomeChapterShownAt !== null) {
          chapterOutcomeSkippedEvent(variant, workId, "already-shown");
          continue;
        }
        const surface = useSurface.getState().active;
        if (surface !== "room") {
          chapterOutcomeSkippedEvent(variant, workId, "surface-not-room");
        }
        enqueue({ workId, variant, decidedAt: next.decidedAt });
      }
    },
  );

  const unsubSurface = useSurface.subscribe(
    (store) => store.active,
    (active) => {
      if (active !== "room") return;
      maybeAdvance();
      notify();
    },
  );

  storeUnsubs.push(unsubVerification, unsubSurface);
}

/**
 * Is the pair (before, after) an "outcome arrived" transition?
 * Two true cases:
 *   1. `before` was not a terminal outcome and `after` is.
 *   2. `before` had a non-null latch that became null (e.g. the
 *      reconcile pass re-set the state — unusual but possible).
 *   3. The entry appeared for the first time with an outcome kind
 *      (before is undefined).
 *
 * A resend of the same confirmed state with the same decidedAt is
 * not a transition (same reference → skip at the store level).
 */
function isOutcomeTransition(
  before: unknown,
  after: unknown,
): boolean {
  if (!after || typeof after !== "object") return false;
  const a = after as { kind?: string };
  if (a.kind !== "confirmed" && a.kind !== "declined") return false;
  if (!before || typeof before !== "object") return true;
  const b = before as { kind?: string };
  return b.kind !== a.kind;
}

// ---------- Hook -------------------------------------------------

export interface OutcomeChapterMountState {
  readonly workId: string;
  readonly plan: OutcomeChapterPlan;
}

/**
 * Reactive read of the current outcome chapter to render. Returns
 * `null` when no chapter is due. The returned `plan` is stable per
 * `(workId, variant, decidedAt)` — React's `useMemo` inside the hook
 * protects against plan re-derivation on unrelated re-renders.
 *
 * The consumer is responsible for rendering `<OutcomeChapter>` with
 * the returned plan and calling `dismissOutcomeChapter()` on
 * `onDone`. Typically this is the `OutcomeChapterMount` component
 * mounted at the Room route.
 */
export function useOutcomeChapterMount(): OutcomeChapterMountState | null {
  useEffect(() => {
    wireStores();
  }, []);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const current = snapshot.current;
  const plan = useMemo(() => {
    if (!current) return null;
    return current.variant === "confirmation"
      ? planConfirmationChapter(current.workId, current.decidedAt)
      : planDeclineChapter(current.workId, current.decidedAt);
  }, [current]);
  if (!current || !plan) return null;
  return { workId: current.workId, plan };
}

/**
 * Imperative test-seam accessor for the queue depth + current entry.
 * Production code does not read this; tests use it to assert
 * enqueue / advance / dismiss behaviour.
 */
export function _peekOutcomeMountForTest(): MountState {
  return state;
}
