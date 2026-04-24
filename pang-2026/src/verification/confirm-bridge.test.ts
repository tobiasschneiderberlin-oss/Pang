/**
 * PANG — verification → works bridge tests (iter #10).
 *
 * The bridge flips `CollectionEntry.status` to "verified" on the same
 * tick that the verification store transitions into "confirmed". The
 * tests drive the stores directly and assert the cross-store effect.
 *
 *   1. transition "requested" → "confirmed" ⇒ entry's status flips
 *   2. transition "requesting" → "confirmed" ⇒ same (reconcile path)
 *   3. already-verified entry ⇒ bridge is a no-op
 *   4. unknown work id ⇒ bridge does not throw
 *   5. re-entry "confirmed" → "confirmed" ⇒ bridge does not re-fire
 *   6. unsubscribe stops the bridge
 *
 * Each test installs a fresh bridge and tears it down to avoid
 * cross-test bleed. The stores are reset via `clear()` + replacing
 * entries.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useVerification } from "@/stores/verification";
import { useWorks, type CollectionEntry } from "@/stores/works";
import { installConfirmBridge } from "./confirm-bridge";

const ENTRY: CollectionEntry = {
  id: "w-bridge",
  imageUrl: "blob:test",
  status: "unverified",
  size: [1, 1] as const,
};

let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  useVerification.getState().clear();
  useWorks.setState({ entries: [] });
  useWorks.getState().addEntry(ENTRY);
  unsubscribe = installConfirmBridge();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  useVerification.getState().clear();
  useWorks.setState({ entries: [] });
});

describe("confirm-bridge — flips status on confirmed", () => {
  it("flips dormant → verified when state transitions into confirmed (via requested)", () => {
    useVerification.getState().beginRequest({
      workId: ENTRY.id,
      requestId: "r-1",
      submittedAt: "2026-04-23T10:00:00.000Z",
    });
    useVerification.getState().ack(ENTRY.id);
    useVerification
      .getState()
      .markConfirmed(ENTRY.id, "2026-04-23T11:00:00.000Z");

    const entry = useWorks
      .getState()
      .entries.find((e) => e.id === ENTRY.id);
    assert.ok(entry);
    assert.equal(entry!.status, "verified");
  });

  it("flips status when reconcile installs a confirmed state directly", () => {
    // Simulates the reconcile path: the store discovers a confirmed
    // outcome during walker polling and replaces state wholesale.
    useVerification.getState().replaceState(ENTRY.id, {
      kind: "confirmed",
      requestId: "r-2",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    const entry = useWorks
      .getState()
      .entries.find((e) => e.id === ENTRY.id);
    assert.ok(entry);
    assert.equal(entry!.status, "verified");
  });
});

describe("confirm-bridge — idempotency", () => {
  it("does not re-fire when state stays confirmed across ticks", () => {
    let flipCount = 0;
    const unsub = useWorks.subscribe((s) => s.entries, () => {
      flipCount += 1;
    });

    useVerification.getState().replaceState(ENTRY.id, {
      kind: "confirmed",
      requestId: "r-3",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });
    const after1 = flipCount;

    // Re-assigning the same confirmed state object to itself should
    // not trigger a second status flip.
    useVerification.getState().replaceState(ENTRY.id, {
      kind: "confirmed",
      requestId: "r-3",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    unsub();
    // Two replaceState calls each produce a works-store mutation on
    // the first transition; the second confirmed → confirmed does
    // NOT mutate because the bridge early-exits. Works store is
    // touched exactly once.
    assert.equal(flipCount, after1);
  });

  it("is a no-op when the entry is already verified", () => {
    useWorks.getState().setStatus(ENTRY.id, "verified");
    useVerification.getState().replaceState(ENTRY.id, {
      kind: "confirmed",
      requestId: "r-4",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });
    const entry = useWorks
      .getState()
      .entries.find((e) => e.id === ENTRY.id);
    assert.equal(entry!.status, "verified");
  });

  it("does not throw on a confirmed state for an unknown work id", () => {
    assert.doesNotThrow(() => {
      useVerification.getState().replaceState("w-missing", {
        kind: "confirmed",
        requestId: "r-5",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
        outcomeChapterShownAt: null,
      });
    });
  });
});

describe("confirm-bridge — teardown", () => {
  it("stops flipping status after unsubscribe", () => {
    unsubscribe?.();
    unsubscribe = null;

    useVerification.getState().replaceState(ENTRY.id, {
      kind: "confirmed",
      requestId: "r-6",
      submittedAt: "2026-04-23T10:00:00.000Z",
      decidedAt: "2026-04-23T11:00:00.000Z",
      outcomeChapterShownAt: null,
    });

    const entry = useWorks
      .getState()
      .entries.find((e) => e.id === ENTRY.id);
    // No bridge installed → status should stay unverified.
    assert.equal(entry!.status, "unverified");
  });
});
