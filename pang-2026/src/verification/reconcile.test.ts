/**
 * PANG — verification reconcile tests.
 *
 * `planReconcile` is the pure core of the boot-time alignment pass:
 * given a snapshot of the outbox + the store's `byWorkId`, it
 * returns the set of removals, rehydrates, and downgrades needed to
 * close the gap between the two sources of truth. OPFS I/O and the
 * real store are mocked away — each case is a matrix cell in the
 * drift table described in `reconcile.ts`.
 *
 * Locks the four drift shapes the reconciler exists to handle:
 *
 *   1. outbox record + store "none"        → rehydrate to "requesting"
 *   2. outbox record + store "confirmed"   → pop the record
 *   3. outbox record + store "failed"      → pop the record
 *   4. store "requesting" + no record      → downgrade to "failed"
 *
 * Plus the stable case: outbox record + store "requesting" / "requested"
 * means both agree; nothing to do.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planReconcile } from "./reconcile";
import type { OutboxRecord } from "./outbox";
import type { VerificationRequest } from "./schema";
import type { VerificationState } from "@/stores/verification";

function request(workId: string, requestId: string): VerificationRequest {
  return {
    version: "v1",
    requestId,
    workId,
    galleryIdHint: "gal-1",
    galleryNameHint: null,
    galleryFreeText: null,
    detectedFrom: "email",
    artworkSnapshot: {
      artist: "Jane Doe",
      title: null,
      year: null,
      medium: null,
      dimensionsCm: null,
    },
    photoRef: `works/${workId}.png`,
    capturedAt: "2026-04-23T09:58:00.000Z",
    submittedAt: "2026-04-23T10:00:00.000Z",
  };
}

function record(workId: string, requestId: string): OutboxRecord {
  return {
    request: request(workId, requestId),
    attempt: 0,
    nextAttemptAt: "2026-04-23T10:00:00.000Z",
  };
}

describe("planReconcile — outbox-first drift shapes", () => {
  it("rehydrates when outbox has a record but store says 'none'", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const plan = planReconcile(records, {});
    assert.equal(plan.rehydrate.length, 1);
    assert.equal(plan.rehydrate[0]!.workId, "w-1");
    assert.equal(plan.rehydrate[0]!.state.kind, "requesting");
    if (plan.rehydrate[0]!.state.kind === "requesting") {
      assert.equal(plan.rehydrate[0]!.state.requestId, "ku7mt1xp-abc123def456");
    }
    assert.equal(plan.summary.resubmitted, 1);
    assert.equal(plan.recordsToRemove.length, 0);
  });

  it("pops the record when store is already 'confirmed'", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "confirmed",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.deepEqual(plan.recordsToRemove, ["ku7mt1xp-abc123def456"]);
    assert.equal(plan.summary.orphanOutboxEntries, 1);
  });

  it("pops the record when store is 'declined'", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "declined",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.deepEqual(plan.recordsToRemove, ["ku7mt1xp-abc123def456"]);
  });

  it("pops the record when store is 'failed'", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "failed",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
        reason: "retries/exhausted",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.deepEqual(plan.recordsToRemove, ["ku7mt1xp-abc123def456"]);
  });

  it("is a no-op when store and outbox agree ('requesting')", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "requesting",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.equal(plan.recordsToRemove.length, 0);
    assert.equal(plan.rehydrate.length, 0);
    assert.equal(plan.downgrade.length, 0);
    assert.equal(plan.summary.orphanOutboxEntries, 0);
  });

  it("is a no-op when store and outbox agree ('requested')", () => {
    const records = [record("w-1", "ku7mt1xp-abc123def456")];
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "requested",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.equal(plan.recordsToRemove.length, 0);
    assert.equal(plan.rehydrate.length, 0);
    assert.equal(plan.downgrade.length, 0);
  });
});

describe("planReconcile — store-first drift shapes", () => {
  it("downgrades a 'requesting' state whose outbox record is missing", () => {
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "requesting",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const plan = planReconcile([], byWorkId);
    assert.equal(plan.downgrade.length, 1);
    assert.equal(plan.downgrade[0]!.workId, "w-1");
    assert.equal(plan.downgrade[0]!.reason, "reconcile/lost");
    assert.equal(plan.summary.downgraded, 1);
    assert.equal(plan.summary.orphanStoreEntries, 1);
  });

  it("does not downgrade 'requested' states with no outbox record", () => {
    // The outbox is popped on ack; 'requested' with no record is the
    // healthy steady state.
    const byWorkId: Record<string, VerificationState> = {
      "w-1": {
        kind: "requested",
        requestId: "ku7mt1xp-abc123def456",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const plan = planReconcile([], byWorkId);
    assert.equal(plan.downgrade.length, 0);
    assert.equal(plan.summary.orphanStoreEntries, 0);
  });

  it("does not touch 'confirmed' / 'declined' / 'failed' with no record", () => {
    const byWorkId: Record<string, VerificationState> = {
      "w-a": {
        kind: "confirmed",
        requestId: "r-a",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
      },
      "w-b": {
        kind: "declined",
        requestId: "r-b",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
      },
      "w-c": {
        kind: "failed",
        requestId: "r-c",
        submittedAt: "2026-04-23T10:00:00.000Z",
        reason: "retries/exhausted",
      },
    };
    const plan = planReconcile([], byWorkId);
    assert.equal(plan.downgrade.length, 0);
    assert.equal(plan.summary.orphanStoreEntries, 0);
  });
});

describe("planReconcile — mixed pass", () => {
  it("handles several shapes in one pass with an accurate summary", () => {
    // One rehydrate (record, no store) + one orphan-outbox (record,
    // store confirmed) + one downgrade (store requesting, no record).
    const records = [
      record("w-1", "r-1"), // rehydrate target
      record("w-2", "r-2"), // orphan-outbox target
    ];
    const byWorkId: Record<string, VerificationState> = {
      "w-2": {
        kind: "confirmed",
        requestId: "r-2",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-23T11:00:00.000Z",
      },
      "w-3": {
        kind: "requesting",
        requestId: "r-ghost",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const plan = planReconcile(records, byWorkId);
    assert.equal(plan.rehydrate.length, 1);
    assert.equal(plan.rehydrate[0]!.workId, "w-1");
    assert.deepEqual(plan.recordsToRemove, ["r-2"]);
    assert.equal(plan.downgrade.length, 1);
    assert.equal(plan.downgrade[0]!.workId, "w-3");
    assert.deepEqual(plan.summary, {
      orphanOutboxEntries: 1,
      orphanStoreEntries: 1,
      resubmitted: 1,
      downgraded: 1,
    });
  });

  it("is stable on an empty outbox + empty store (no-op)", () => {
    const plan = planReconcile([], {});
    assert.equal(plan.recordsToRemove.length, 0);
    assert.equal(plan.rehydrate.length, 0);
    assert.equal(plan.downgrade.length, 0);
    assert.deepEqual(plan.summary, {
      orphanOutboxEntries: 0,
      orphanStoreEntries: 0,
      resubmitted: 0,
      downgraded: 0,
    });
  });
});

// ---------- pollOutcomeOnce (iter #10) ---------------------------

import { pollOutcomeOnce } from "./reconcile";

type FetchFn = typeof globalThis.fetch;

describe("pollOutcomeOnce — dispatched walker wire classification", () => {
  const requestId = "ku7mt1xp-abc123def456";
  const originalFetch: FetchFn | undefined = globalThis.fetch;

  function install(response: Response | Error): void {
    const fn: FetchFn = async () => {
      if (response instanceof Error) throw response;
      return response;
    };
    (globalThis as { fetch: FetchFn }).fetch = fn;
  }

  function restore(): void {
    if (originalFetch !== undefined) {
      (globalThis as { fetch: FetchFn }).fetch = originalFetch;
    }
  }

  it("returns 'pending' on 204 No Content", async () => {
    install(new Response(null, { status: 204 }));
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "pending");
    } finally {
      restore();
    }
  });

  it("returns 'outcome' + 'confirmed' on a 200 with a valid confirmed payload", async () => {
    const payload = {
      version: "v1" as const,
      requestId,
      workId: "w-1",
      outcome: "confirmed" as const,
      decidedAt: "2026-04-23T12:00:00.000Z",
    };
    install(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "outcome");
      if (result.kind === "outcome") {
        assert.equal(result.outcome, "confirmed");
        assert.equal(result.decidedAt, "2026-04-23T12:00:00.000Z");
      }
    } finally {
      restore();
    }
  });

  it("returns 'outcome' + 'declined' on a 200 with a valid declined payload", async () => {
    const payload = {
      version: "v1" as const,
      requestId,
      workId: "w-1",
      outcome: "declined" as const,
      decidedAt: "2026-04-23T12:00:00.000Z",
    };
    install(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "outcome");
      if (result.kind === "outcome") {
        assert.equal(result.outcome, "declined");
      }
    } finally {
      restore();
    }
  });

  it("returns 'unauth' on 401", async () => {
    install(new Response(null, { status: 401 }));
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "unauth");
    } finally {
      restore();
    }
  });

  it("returns 'error' with http/500 on a 500", async () => {
    install(new Response("oops", { status: 500 }));
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "error");
      if (result.kind === "error") {
        assert.equal(result.reason, "http/500");
      }
    } finally {
      restore();
    }
  });

  it("returns 'error' on a network throw", async () => {
    install(new TypeError("net::ERR_INTERNET_DISCONNECTED"));
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "error");
    } finally {
      restore();
    }
  });

  it("returns 'error' on a schema mismatch (outcome field bogus)", async () => {
    install(
      new Response(
        JSON.stringify({
          version: "v1",
          requestId,
          workId: "w-1",
          outcome: "BOGUS",
          decidedAt: "2026-04-23T12:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "error");
      if (result.kind === "error") {
        assert.equal(result.reason, "schema");
      }
    } finally {
      restore();
    }
  });

  it("returns 'error' on non-JSON body", async () => {
    install(
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    try {
      const result = await pollOutcomeOnce(requestId);
      assert.equal(result.kind, "error");
      if (result.kind === "error") {
        assert.equal(result.reason, "bad_json");
      }
    } finally {
      restore();
    }
  });
});
