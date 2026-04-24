/**
 * PANG — outcome chapter mount hook tests (iter #11).
 *
 * The mount hook owns three load-bearing invariants from the
 * iteration brief's failure-mode declaration (§ 9):
 *
 *   1. *FIFO — one chapter at a time.* Two confirmations arriving
 *      while a third plays queue in order; neither mounts until the
 *      400 ms inter-chapter gap has elapsed past the active's
 *      dismiss. The spine's "and now the next one" beat depends on
 *      this queue discipline.
 *
 *   2. *Surface gate.* A confirmation that lands while the active
 *      surface is off-Room (e.g. still on `/scan`) queues rather
 *      than surfacing. Navigating to Room flushes the head. Tested
 *      through the exported `useSurface` store — the hook
 *      subscribes internally.
 *
 *   3. *Already-shown skip.* A rehydrated entry whose latch is
 *      non-null (OPFS persisted the shown-at) does not re-surface,
 *      and the skip is announced on telemetry with
 *      `reason: "already-shown"`. Same behaviour for off-surface
 *      reconciles — the skip emits `reason: "surface-not-room"`.
 *
 * The module uses a singleton queue (by design — one chapter at a
 * time globally), so tests reset with `_resetOutcomeMountForTest()`
 * in `beforeEach`. The `_advanceForTest` seam fast-forwards the
 * 400 ms gap for determinism; real timing is e2e territory.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  dismissOutcomeChapter,
  _advanceForTest,
  _resetOutcomeMountForTest,
  _peekOutcomeMountForTest,
  _wireStoresForTest,
} from "./outcome-mount";
import { useVerification } from "@/stores/verification";
import { useSurface } from "@/stores/surface";

// ---------- Sink for skip telemetry ------------------------------
//
// `chapter.outcome.skipped` emits via `console.debug`. Tests swap
// it to assert the skip branch fired.

type Payload = {
  readonly event: string;
  readonly attrs: Record<string, string | number | boolean>;
};

const sink: Payload[] = [];
let originalDebug: typeof console.debug;

beforeEach(() => {
  sink.length = 0;
  originalDebug = console.debug;
  console.debug = (line: string) => {
    try {
      sink.push(JSON.parse(line) as Payload);
    } catch {
      /* non-JSON lines ignored */
    }
  };
  // Reset module + stores before each case — the singleton queue
  // would otherwise leak state across tests.
  _resetOutcomeMountForTest();
  useVerification.getState().clear();
  useSurface.getState().clear();
});

afterEach(() => {
  console.debug = originalDebug;
});

// ---------- Helper: mount the hook once to wire stores -----------
//
// The subscriptions install lazily on first `useOutcomeChapterMount`
// mount. Outside a React renderer we reach the same wiring path
// through a test-only export on the module.

function wire(): void {
  _wireStoresForTest();
}

// Force-transition a work into a confirmed/declined state without
// going through the full request/dispatch dance. The production
// `markConfirmed` / `markDeclined` path requires a prior
// `"requested"` / `"dispatched"` state; here we set the final
// state directly via `replaceState` so tests can focus on the
// outcome-mount behaviour, not the upstream state machine.
//
// Using `replaceState` (not `setState`) because `replaceState` is
// a first-class store action and triggers subscribers.
function setConfirmed(workId: string, decidedAt: string): void {
  useVerification.getState().replaceState(workId, {
    kind: "confirmed",
    requestId: `r-${workId}`,
    submittedAt: "2026-04-24T09:00:00.000Z",
    decidedAt,
    outcomeChapterShownAt: null,
  });
}

function setDeclined(workId: string, decidedAt: string): void {
  useVerification.getState().replaceState(workId, {
    kind: "declined",
    requestId: `r-${workId}`,
    submittedAt: "2026-04-24T09:00:00.000Z",
    decidedAt,
    outcomeChapterShownAt: null,
  });
}

// ---------- enqueue via verification transition ------------------

describe("outcome-mount — enqueue via confirmation transition", () => {
  it("surfaces immediately when Room is active and queue is empty", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-a");
    assert.equal(snap.current?.variant, "confirmation");
    assert.equal(snap.queue.length, 0);
  });

  it("queues a second confirmation while the first plays", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    setConfirmed("w-b", "2026-04-24T10:00:01.000Z");
    setConfirmed("w-c", "2026-04-24T10:00:02.000Z");
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-a");
    assert.deepEqual(
      snap.queue.map((e) => e.workId),
      ["w-b", "w-c"],
    );
  });

  it("preserves FIFO order through dismiss + advance", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    setConfirmed("w-b", "2026-04-24T10:00:01.000Z");
    setConfirmed("w-c", "2026-04-24T10:00:02.000Z");
    // Dismiss the head. Because the gap is a setTimeout, we
    // fast-forward via _advanceForTest.
    dismissOutcomeChapter();
    _advanceForTest();
    let snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-b");
    assert.deepEqual(
      snap.queue.map((e) => e.workId),
      ["w-c"],
    );
    dismissOutcomeChapter();
    _advanceForTest();
    snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-c");
    assert.equal(snap.queue.length, 0);
  });

  it("is idempotent — a duplicate setConfirmed is a no-op", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-a");
    assert.equal(snap.queue.length, 0);
  });
});

// ---------- Surface gate -----------------------------------------

describe("outcome-mount — surface gate", () => {
  it("queues but does not surface when the Room is not active", () => {
    wire();
    useSurface.getState().setActiveSurface("scan");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current, null);
    assert.equal(snap.queue.length, 1);
    assert.equal(snap.queue[0]?.workId, "w-a");
  });

  it("emits chapter.outcome.skipped { reason: 'surface-not-room' }", () => {
    wire();
    useSurface.getState().setActiveSurface("scan");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    const skip = sink.find(
      (p) =>
        p.event === "chapter.outcome.skipped" &&
        p.attrs["pang.chapter.work_id"] === "w-a",
    );
    assert.ok(skip, "expected a surface-not-room skip event");
    assert.equal(skip!.attrs["pang.chapter.skip_reason"], "surface-not-room");
  });

  it("flushes the queue head when the surface transitions to Room", () => {
    wire();
    useSurface.getState().setActiveSurface("scan");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    setConfirmed("w-b", "2026-04-24T10:00:01.000Z");
    let snap = _peekOutcomeMountForTest();
    assert.equal(snap.current, null);
    assert.equal(snap.queue.length, 2);
    useSurface.getState().setActiveSurface("room");
    snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-a");
    assert.equal(snap.queue.length, 1);
  });
});

// ---------- Already-shown skip -----------------------------------

describe("outcome-mount — already-shown skip (seed path)", () => {
  it("does not surface a latched confirmed entry seeded into the store", () => {
    // Simulate a rehydrate: the verification store has a
    // confirmed entry with a non-null latch before the hook wires
    // up. `wireStores`'s seed pass must skip it.
    useVerification.setState((prev) => ({
      byWorkId: {
        ...prev.byWorkId,
        "w-z": {
          kind: "confirmed",
          requestId: "r-z",
          submittedAt: "2026-04-24T09:59:00.000Z",
          decidedAt: "2026-04-24T10:00:00.000Z",
          outcomeChapterShownAt: "2026-04-24T10:00:05.000Z",
        },
      },
    }));
    useSurface.getState().setActiveSurface("room");
    wire();
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current, null, "latched entry must not surface");
    assert.equal(snap.queue.length, 0);
  });

  it("surfaces an unlatched rehydrated confirmed on wire", () => {
    useVerification.setState((prev) => ({
      byWorkId: {
        ...prev.byWorkId,
        "w-y": {
          kind: "confirmed",
          requestId: "r-y",
          submittedAt: "2026-04-24T09:59:00.000Z",
          decidedAt: "2026-04-24T10:00:00.000Z",
          outcomeChapterShownAt: null,
        },
      },
    }));
    useSurface.getState().setActiveSurface("room");
    wire();
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-y");
  });
});

// ---------- Decline variant --------------------------------------

describe("outcome-mount — decline variant", () => {
  it("encodes variant='decline' when the entry is declined", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setDeclined("w-a", "2026-04-24T11:00:00.000Z");
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-a");
    assert.equal(snap.current?.variant, "decline");
  });
});

// ---------- Gap timer --------------------------------------------

describe("outcome-mount — inter-chapter gap", () => {
  it("holds `current=null` after dismiss until gap elapses", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    setConfirmed("w-b", "2026-04-24T10:00:01.000Z");
    dismissOutcomeChapter();
    // Immediately post-dismiss and pre-advance, current is null
    // and the queue still holds w-b.
    let snap = _peekOutcomeMountForTest();
    assert.equal(snap.current, null);
    assert.equal(snap.queue.length, 1);
    _advanceForTest();
    snap = _peekOutcomeMountForTest();
    assert.equal(snap.current?.workId, "w-b");
  });

  it("dismiss with an empty queue leaves current null", () => {
    wire();
    useSurface.getState().setActiveSurface("room");
    setConfirmed("w-a", "2026-04-24T10:00:00.000Z");
    dismissOutcomeChapter();
    _advanceForTest();
    const snap = _peekOutcomeMountForTest();
    assert.equal(snap.current, null);
    assert.equal(snap.queue.length, 0);
  });
});
