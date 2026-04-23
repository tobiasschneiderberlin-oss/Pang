/**
 * PANG — verification persistence parse/serialise tests.
 *
 * The OPFS read/write halves need a browser fixture (or a mock on
 * `navigator.storage`); here we lock the pure halves:
 *
 *   - `serialiseIndex` + `parseIndex` round-trip every
 *     `VerificationState` variant.
 *   - `parseIndex` rejects malformed inputs *structurally* — the
 *     persistence layer cannot be the vector that smuggles a bad
 *     state into the store. The outbox re-parses the embedded
 *     `VerificationRequest`, so the store's job here is *shape*.
 *   - A corrupted entry does not poison the whole file: the remaining
 *     good entries still parse.
 *   - Phase D: `push` slice round-trips every `PushDecision` variant;
 *     a legacy v1 index without `push` parses as an empty push map.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serialiseIndex, parseIndex } from "./verification.persist";
import type { PushDecision, VerificationState } from "./verification";

const EMPTY = { entries: {}, push: {} };

describe("serialiseIndex + parseIndex round-trip", () => {
  it("round-trips a 'none' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": { kind: "none" },
    };
    const text = serialiseIndex(input);
    const parsed = parseIndex(text);
    assert.deepEqual(parsed.entries, input);
    assert.deepEqual(parsed.push, {});
  });

  it("round-trips a 'requesting' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "requesting",
        requestId: "req-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips a 'requested' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "requested",
        requestId: "req-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips a 'confirmed' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "confirmed",
        requestId: "req-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-24T10:00:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips a 'declined' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "declined",
        requestId: "req-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        decidedAt: "2026-04-24T10:00:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips a 'failed' entry", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "failed",
        requestId: "req-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        reason: "network/timeout",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips a multi-entry mix", () => {
    const input: Record<string, VerificationState> = {
      "w-a": {
        kind: "requested",
        requestId: "req-a",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
      "w-b": {
        kind: "confirmed",
        requestId: "req-b",
        submittedAt: "2026-04-22T10:00:00.000Z",
        decidedAt: "2026-04-23T10:00:00.000Z",
      },
      "w-c": { kind: "none" },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed.entries, input);
  });

  it("round-trips an empty map", () => {
    const parsed = parseIndex(serialiseIndex({}));
    assert.deepEqual(parsed, EMPTY);
  });
});

describe("serialiseIndex + parseIndex round-trip — push decisions", () => {
  it("round-trips a 'granted' decision", () => {
    const push: Record<string, PushDecision> = {
      "w-a": { kind: "granted", storedAt: "2026-04-23T10:00:01.000Z" },
    };
    const parsed = parseIndex(serialiseIndex({}, push));
    assert.deepEqual(parsed.push, push);
  });

  it("round-trips a 'refused' decision", () => {
    const push: Record<string, PushDecision> = {
      "w-a": { kind: "refused", at: "2026-04-23T10:00:01.000Z" },
    };
    const parsed = parseIndex(serialiseIndex({}, push));
    assert.deepEqual(parsed.push, push);
  });

  it("round-trips an 'unsupported' decision", () => {
    const push: Record<string, PushDecision> = {
      "w-a": { kind: "unsupported", reason: "no-vapid" },
    };
    const parsed = parseIndex(serialiseIndex({}, push));
    assert.deepEqual(parsed.push, push);
  });

  it("round-trips an 'unoffered' decision", () => {
    const push: Record<string, PushDecision> = {
      "w-a": { kind: "unoffered" },
    };
    const parsed = parseIndex(serialiseIndex({}, push));
    assert.deepEqual(parsed.push, push);
  });

  it("legacy v1 without 'push' rehydrates as empty push map", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": { kind: "none" },
      },
    });
    const parsed = parseIndex(text);
    assert.deepEqual(parsed.push, {});
  });

  it("drops malformed push entries, keeps good ones", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {},
      push: {
        "w-a": { kind: "granted", storedAt: "2026-04-23T10:00:00.000Z" },
        "w-b": { kind: "granted" /* missing storedAt */ },
        "w-c": { kind: "bogus" },
      },
    });
    const parsed = parseIndex(text);
    assert.ok("w-a" in parsed.push);
    assert.equal("w-b" in parsed.push, false);
    assert.equal("w-c" in parsed.push, false);
  });
});

describe("parseIndex rejects malformed input", () => {
  it("returns empty for invalid JSON", () => {
    assert.deepEqual(parseIndex("{not json"), EMPTY);
  });

  it("returns empty for a non-object top-level", () => {
    assert.deepEqual(parseIndex("\"string\""), EMPTY);
    assert.deepEqual(parseIndex("null"), EMPTY);
    assert.deepEqual(parseIndex("[]"), EMPTY);
  });

  it("returns empty when version is missing", () => {
    assert.deepEqual(parseIndex(JSON.stringify({ entries: {} })), EMPTY);
  });

  it("returns empty when version is wrong", () => {
    assert.deepEqual(
      parseIndex(JSON.stringify({ version: "v2", entries: {} })),
      EMPTY,
    );
  });

  it("returns empty when entries is missing", () => {
    assert.deepEqual(parseIndex(JSON.stringify({ version: "v1" })), EMPTY);
  });

  it("returns empty when entries is not an object", () => {
    assert.deepEqual(
      parseIndex(JSON.stringify({ version: "v1", entries: "nope" })),
      EMPTY,
    );
  });
});

describe("parseIndex per-entry validation", () => {
  it("drops entries with unknown kind, keeps good ones", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": {
          kind: "requested",
          requestId: "req-a",
          submittedAt: "2026-04-23T10:00:00.000Z",
        },
        "w-b": { kind: "bogus" },
      },
    });
    const parsed = parseIndex(text);
    assert.ok("w-a" in parsed.entries);
    assert.equal("w-b" in parsed.entries, false);
  });

  it("drops entries missing required fields for their kind", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-missing-req-id": {
          kind: "requested",
          submittedAt: "2026-04-23T10:00:00.000Z",
        },
        "w-missing-submitted": {
          kind: "requesting",
          requestId: "req-1",
        },
        "w-missing-decided": {
          kind: "confirmed",
          requestId: "req-1",
          submittedAt: "2026-04-23T10:00:00.000Z",
        },
        "w-missing-reason": {
          kind: "failed",
          requestId: "req-1",
          submittedAt: "2026-04-23T10:00:00.000Z",
        },
      },
    });
    assert.deepEqual(parseIndex(text).entries, {});
  });

  it("drops entries with empty-string required fields", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": {
          kind: "requested",
          requestId: "",
          submittedAt: "2026-04-23T10:00:00.000Z",
        },
      },
    });
    assert.deepEqual(parseIndex(text).entries, {});
  });

  it("accepts the 'none' shape without extra fields", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: { "w-a": { kind: "none" } },
    });
    const parsed = parseIndex(text);
    assert.deepEqual(parsed.entries["w-a"], { kind: "none" });
  });
});
