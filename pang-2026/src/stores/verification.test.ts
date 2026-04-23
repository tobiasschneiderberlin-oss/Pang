/**
 * PANG — verification store tests.
 *
 * Locks the lifecycle grammar (kickoff brief § 3: idempotency and
 * transition guards).
 *
 *   - `beginRequest` is idempotent: returns current state when not in
 *     `"none"` or `"failed"`; transitions freshly from either of those
 *     two kinds.
 *   - `ack` only from `"requesting"`.
 *   - `markFailed` only from in-flight (`"requesting"` or `"requested"`).
 *   - `markConfirmed` / `markDeclined` never overwrite terminal states,
 *     and never fire on `"none"` (no in-flight request to resolve).
 *   - `replaceState` is the escape hatch for persistence rehydration.
 *   - `stateOf` returns `{ kind: "none" }` for unknown ids (no undefined).
 *
 * Tests run under `node:test` via `tsx` — no DOM dependency, since the
 * store itself is environment-agnostic. Each test `clear()`'s first to
 * isolate from prior writes.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useVerification } from "./verification";

const workA = "w-alpha";
const workB = "w-beta";

function reset(): void {
  useVerification.getState().clear();
}

describe("stateOf", () => {
  beforeEach(reset);

  it("returns { kind: 'none' } for unknown work ids", () => {
    const s = useVerification.getState().stateOf("w-unknown");
    assert.deepEqual(s, { kind: "none" });
  });
});

describe("beginRequest", () => {
  beforeEach(reset);

  it("transitions from 'none' to 'requesting'", () => {
    const next = useVerification.getState().beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(next.kind, "requesting");
    if (next.kind === "requesting") {
      assert.equal(next.requestId, "req-1");
      assert.equal(next.submittedAt, "2026-04-23T10:00:00.000Z");
    }
    assert.equal(useVerification.getState().stateOf(workA).kind, "requesting");
  });

  it("transitions from 'failed' to a fresh 'requesting'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "failed",
      requestId: "req-old",
      submittedAt: "2026-04-23T09:00:00.000Z",
      reason: "network/timeout",
    });
    const next = store.beginRequest({
      workId: workA,
      requestId: "req-new",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(next.kind, "requesting");
    if (next.kind === "requesting") {
      assert.equal(next.requestId, "req-new");
    }
  });

  it("is a no-op when state is 'requesting' (returns existing)", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    const next = store.beginRequest({
      workId: workA,
      requestId: "req-2",
      submittedAt: "2026-04-23T10:00:05.000Z",
    });
    assert.equal(next.kind, "requesting");
    if (next.kind === "requesting") {
      // Still the original id — idempotency preserved.
      assert.equal(next.requestId, "req-1");
    }
  });

  it("is a no-op when state is 'requested'", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    const next = store.beginRequest({
      workId: workA,
      requestId: "req-2",
      submittedAt: "2026-04-23T10:00:05.000Z",
    });
    assert.equal(next.kind, "requested");
    if (next.kind === "requested") {
      assert.equal(next.requestId, "req-1");
    }
  });

  it("is a no-op when state is 'confirmed'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "confirmed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    const next = store.beginRequest({
      workId: workA,
      requestId: "req-2",
      submittedAt: "2026-04-25T10:00:00.000Z",
    });
    assert.equal(next.kind, "confirmed");
  });

  it("is a no-op when state is 'declined'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "declined",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    const next = store.beginRequest({
      workId: workA,
      requestId: "req-2",
      submittedAt: "2026-04-25T10:00:00.000Z",
    });
    assert.equal(next.kind, "declined");
  });
});

describe("ack", () => {
  beforeEach(reset);

  it("transitions 'requesting' to 'requested' preserving id + submittedAt", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    const s = store.stateOf(workA);
    assert.equal(s.kind, "requested");
    if (s.kind === "requested") {
      assert.equal(s.requestId, "req-1");
      assert.equal(s.submittedAt, "2026-04-23T10:00:00.000Z");
    }
  });

  it("is a no-op from 'none'", () => {
    useVerification.getState().ack(workA);
    assert.equal(useVerification.getState().stateOf(workA).kind, "none");
  });

  it("is a no-op from 'requested' (double-ack)", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    store.ack(workA);
    const s = store.stateOf(workA);
    assert.equal(s.kind, "requested");
  });

  it("is a no-op from 'failed'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "failed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      reason: "network/timeout",
    });
    store.ack(workA);
    assert.equal(store.stateOf(workA).kind, "failed");
  });
});

describe("markFailed", () => {
  beforeEach(reset);

  it("transitions 'requesting' to 'failed'", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markFailed(workA, "network/timeout");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "failed");
    if (s.kind === "failed") {
      assert.equal(s.reason, "network/timeout");
      assert.equal(s.requestId, "req-1");
    }
  });

  it("transitions 'requested' to 'failed'", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    store.markFailed(workA, "server/5xx");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "failed");
    if (s.kind === "failed") {
      assert.equal(s.reason, "server/5xx");
    }
  });

  it("is a no-op from 'none'", () => {
    useVerification.getState().markFailed(workA, "anything");
    assert.equal(useVerification.getState().stateOf(workA).kind, "none");
  });

  it("is a no-op from 'confirmed'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "confirmed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    store.markFailed(workA, "shouldnt-apply");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "confirmed");
  });

  it("is a no-op from 'failed' (idempotent)", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "failed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      reason: "original",
    });
    store.markFailed(workA, "overwrite-attempt");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "failed");
    if (s.kind === "failed") {
      assert.equal(s.reason, "original");
    }
  });
});

describe("markConfirmed", () => {
  beforeEach(reset);

  it("transitions 'requested' to 'confirmed'", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    store.markConfirmed(workA, "2026-04-24T10:00:00.000Z");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "confirmed");
    if (s.kind === "confirmed") {
      assert.equal(s.decidedAt, "2026-04-24T10:00:00.000Z");
      assert.equal(s.requestId, "req-1");
    }
  });

  it("transitions 'requesting' directly to 'confirmed' (push raced ack)", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markConfirmed(workA, "2026-04-23T10:00:30.000Z");
    assert.equal(store.stateOf(workA).kind, "confirmed");
  });

  it("transitions 'failed' to 'confirmed' (server reconcile overrides)", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "failed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      reason: "network/timeout",
    });
    store.markConfirmed(workA, "2026-04-24T10:00:00.000Z");
    assert.equal(store.stateOf(workA).kind, "confirmed");
  });

  it("is a no-op from 'none'", () => {
    useVerification.getState().markConfirmed(workA, "2026-04-24T10:00:00.000Z");
    assert.equal(useVerification.getState().stateOf(workA).kind, "none");
  });

  it("is a no-op from 'confirmed' (idempotent)", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "confirmed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    store.markConfirmed(workA, "2026-04-25T10:00:00.000Z");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "confirmed");
    if (s.kind === "confirmed") {
      // decidedAt preserved.
      assert.equal(s.decidedAt, "2026-04-24T10:00:00.000Z");
    }
  });

  it("is a no-op from 'declined'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "declined",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    store.markConfirmed(workA, "2026-04-25T10:00:00.000Z");
    assert.equal(store.stateOf(workA).kind, "declined");
  });
});

describe("markDeclined", () => {
  beforeEach(reset);

  it("transitions 'requested' to 'declined'", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.ack(workA);
    store.markDeclined(workA, "2026-04-24T10:00:00.000Z");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "declined");
    if (s.kind === "declined") {
      assert.equal(s.decidedAt, "2026-04-24T10:00:00.000Z");
    }
  });

  it("is a no-op from 'none'", () => {
    useVerification.getState().markDeclined(workA, "2026-04-24T10:00:00.000Z");
    assert.equal(useVerification.getState().stateOf(workA).kind, "none");
  });

  it("is a no-op from 'confirmed'", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "confirmed",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    store.markDeclined(workA, "2026-04-25T10:00:00.000Z");
    assert.equal(store.stateOf(workA).kind, "confirmed");
  });
});

describe("replaceState", () => {
  beforeEach(reset);

  it("overwrites with any state (persistence escape hatch)", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "requested",
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "requested");
    store.replaceState(workA, { kind: "none" });
    assert.equal(store.stateOf(workA).kind, "none");
  });

  it("does not mutate unrelated work ids", () => {
    const store = useVerification.getState();
    store.replaceState(workA, {
      kind: "requested",
      requestId: "req-a",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.replaceState(workB, {
      kind: "confirmed",
      requestId: "req-b",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-24T10:00:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "requested");
    assert.equal(store.stateOf(workB).kind, "confirmed");
  });
});

describe("clear", () => {
  beforeEach(reset);

  it("empties all entries", () => {
    const store = useVerification.getState();
    store.beginRequest({
      workId: workA,
      requestId: "req-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.beginRequest({
      workId: workB,
      requestId: "req-2",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.clear();
    assert.equal(store.stateOf(workA).kind, "none");
    assert.equal(store.stateOf(workB).kind, "none");
  });
});
