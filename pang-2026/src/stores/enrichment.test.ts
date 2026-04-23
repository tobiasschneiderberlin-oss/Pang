/**
 * PANG — enrichment store tests.
 *
 * Locks the lifecycle grammar for per-work enrichment status:
 *
 *   - `beginEnriching` is idempotent: returns current state when not
 *     in `"none"`, `"stale"`, or `"failed"`; transitions freshly
 *     from any of those three.
 *   - `markReady` only transitions from `"enriching"` or `"stale"`.
 *   - `markStale` only transitions from `"ready"`. An in-flight
 *     enrichment keeps running — its output lands against the new
 *     hash.
 *   - `markFailed` only from `"enriching"`.
 *   - `replaceState` is the escape hatch for persistence rehydration.
 *   - `stateOf` returns `{ kind: "none" }` for unknown ids.
 *
 * These mirror the verification store's guard pattern; each test
 * `clear()`'s first for isolation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useEnrichment } from "./enrichment";

const workA = "w-alpha";
const workB = "w-beta";
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function reset(): void {
  useEnrichment.getState().clear();
}

describe("stateOf", () => {
  beforeEach(reset);

  it("returns { kind: 'none' } for unknown work ids", () => {
    const s = useEnrichment.getState().stateOf("w-unknown");
    assert.deepEqual(s, { kind: "none" });
  });
});

describe("beginEnriching", () => {
  beforeEach(reset);

  it("transitions from 'none' to 'enriching'", () => {
    const next = useEnrichment.getState().beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(next.kind, "enriching");
    if (next.kind === "enriching") {
      assert.equal(next.submissionId, "sub-1");
      assert.equal(next.submittedAt, "2026-04-23T10:00:00.000Z");
    }
    assert.equal(
      useEnrichment.getState().stateOf(workA).kind,
      "enriching",
    );
  });

  it("transitions from 'failed' to a fresh 'enriching'", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-old",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markFailed(workA, "network/unknown");
    const next = store.beginEnriching({
      workId: workA,
      submissionId: "sub-fresh",
      submittedAt: "2026-04-23T10:05:00.000Z",
    });
    assert.equal(next.kind, "enriching");
    if (next.kind === "enriching") {
      assert.equal(next.submissionId, "sub-fresh");
    }
  });

  it("transitions from 'stale' to a fresh 'enriching'", () => {
    const store = useEnrichment.getState();
    store.replaceState(workA, {
      kind: "stale",
      submissionId: "sub-old",
      submittedAt: "2026-04-23T10:00:00.000Z",
      previousWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    const next = store.beginEnriching({
      workId: workA,
      submissionId: "sub-fresh",
      submittedAt: "2026-04-23T11:00:00.000Z",
    });
    assert.equal(next.kind, "enriching");
  });

  it("is idempotent on 'enriching' — returns the existing state", () => {
    const store = useEnrichment.getState();
    const first = store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    const second = store.beginEnriching({
      workId: workA,
      submissionId: "sub-2",
      submittedAt: "2026-04-23T10:00:01.000Z",
    });
    if (second.kind === "enriching") {
      assert.equal(second.submissionId, "sub-1");
    }
    assert.deepEqual(second, first);
  });

  it("is idempotent on 'ready' — returns the existing state", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    const retry = store.beginEnriching({
      workId: workA,
      submissionId: "sub-2",
      submittedAt: "2026-04-23T10:06:00.000Z",
    });
    assert.equal(retry.kind, "ready");
  });

  it("keeps per-work isolation", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-a",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.beginEnriching({
      workId: workB,
      submissionId: "sub-b",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "enriching");
    assert.equal(store.stateOf(workB).kind, "enriching");
  });
});

describe("markReady", () => {
  beforeEach(reset);

  it("transitions from 'enriching' to 'ready' with the hash", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    const s = store.stateOf(workA);
    assert.equal(s.kind, "ready");
    if (s.kind === "ready") {
      assert.equal(s.basedOnWorkHash, hashA);
      assert.equal(s.submissionId, "sub-1");
    }
  });

  it("transitions from 'stale' to 'ready' (re-dispatch succeeded)", () => {
    const store = useEnrichment.getState();
    store.replaceState(workA, {
      kind: "stale",
      submissionId: "sub-old",
      submittedAt: "2026-04-23T10:00:00.000Z",
      previousWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    store.markReady(workA, {
      basedOnWorkHash: hashB,
      generatedAt: "2026-04-23T11:00:00.000Z",
    });
    const s = store.stateOf(workA);
    if (s.kind === "ready") {
      assert.equal(s.basedOnWorkHash, hashB);
    } else {
      assert.fail("should be ready after re-dispatch");
    }
  });

  it("is a no-op on 'none'", () => {
    const store = useEnrichment.getState();
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "none");
  });

  it("is a no-op on 'failed' (requires beginEnriching first)", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markFailed(workA, "network/unknown");
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "failed");
  });
});

describe("markStale", () => {
  beforeEach(reset);

  it("transitions from 'ready' to 'stale' and keeps the previous hash", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    store.markStale(workA, hashA);
    const s = store.stateOf(workA);
    assert.equal(s.kind, "stale");
    if (s.kind === "stale") {
      assert.equal(s.previousWorkHash, hashA);
      assert.equal(s.submissionId, "sub-1");
    }
  });

  it("is a no-op on 'enriching' (in-flight work keeps running)", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markStale(workA, hashA);
    assert.equal(store.stateOf(workA).kind, "enriching");
  });

  it("is a no-op on 'none'", () => {
    const store = useEnrichment.getState();
    store.markStale(workA, hashA);
    assert.equal(store.stateOf(workA).kind, "none");
  });
});

describe("markFailed", () => {
  beforeEach(reset);

  it("transitions from 'enriching' to 'failed' with the reason", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markFailed(workA, "retries/exhausted");
    const s = store.stateOf(workA);
    assert.equal(s.kind, "failed");
    if (s.kind === "failed") {
      assert.equal(s.reason, "retries/exhausted");
    }
  });

  it("is a no-op on 'ready' (would require markStale first)", () => {
    const store = useEnrichment.getState();
    store.beginEnriching({
      workId: workA,
      submissionId: "sub-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    store.markReady(workA, {
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    store.markFailed(workA, "network/unknown");
    assert.equal(store.stateOf(workA).kind, "ready");
  });
});

describe("replaceState", () => {
  beforeEach(reset);

  it("overrides the current state without transition guards (hydration path)", () => {
    const store = useEnrichment.getState();
    store.replaceState(workA, {
      kind: "ready",
      submissionId: "sub-persisted",
      submittedAt: "2026-04-23T10:00:00.000Z",
      basedOnWorkHash: hashA,
      generatedAt: "2026-04-23T10:05:00.000Z",
    });
    assert.equal(store.stateOf(workA).kind, "ready");
  });
});
