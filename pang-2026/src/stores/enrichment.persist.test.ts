/**
 * PANG — enrichment persistence parse/serialise tests.
 *
 * OPFS read/write halves need a browser fixture; here we lock the
 * pure halves:
 *
 *   - `serialiseIndex` + `parseIndex` round-trip every
 *     `EnrichmentState` variant.
 *   - `parseIndex` rejects malformed inputs *structurally* — the
 *     persistence layer cannot be the vector that smuggles a bad
 *     state into the store on rehydrate.
 *   - A corrupted entry does not poison the whole file: the
 *     remaining good entries still parse.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseIndex, serialiseIndex } from "./enrichment.persist";
import type { EnrichmentState } from "./enrichment";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

describe("serialiseIndex + parseIndex round-trip", () => {
  it("round-trips a 'none' entry", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": { kind: "none" },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });

  it("round-trips an 'enriching' entry", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": {
        kind: "enriching",
        submissionId: "sub-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });

  it("round-trips a 'ready' entry", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": {
        kind: "ready",
        submissionId: "sub-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        basedOnWorkHash: hashA,
        generatedAt: "2026-04-23T10:05:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });

  it("round-trips a 'stale' entry", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": {
        kind: "stale",
        submissionId: "sub-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        previousWorkHash: hashA,
        generatedAt: "2026-04-23T10:05:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });

  it("round-trips a 'failed' entry", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": {
        kind: "failed",
        submissionId: "sub-1",
        submittedAt: "2026-04-23T10:00:00.000Z",
        reason: "retries/exhausted",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });

  it("round-trips a multi-entry mix", () => {
    const input: Record<string, EnrichmentState> = {
      "w-a": {
        kind: "ready",
        submissionId: "sub-a",
        submittedAt: "2026-04-23T10:00:00.000Z",
        basedOnWorkHash: hashA,
        generatedAt: "2026-04-23T10:05:00.000Z",
      },
      "w-b": {
        kind: "enriching",
        submissionId: "sub-b",
        submittedAt: "2026-04-23T11:00:00.000Z",
      },
      "w-c": {
        kind: "stale",
        submissionId: "sub-c",
        submittedAt: "2026-04-23T09:00:00.000Z",
        previousWorkHash: hashB,
        generatedAt: "2026-04-23T09:05:00.000Z",
      },
    };
    const parsed = parseIndex(serialiseIndex(input));
    assert.deepEqual(parsed, input);
  });
});

describe("parseIndex — structural rejection", () => {
  it("rejects non-JSON input", () => {
    assert.deepEqual(parseIndex("not json"), {});
  });

  it("rejects wrong top-level shape", () => {
    assert.deepEqual(parseIndex(JSON.stringify("string")), {});
    assert.deepEqual(parseIndex(JSON.stringify([])), {});
  });

  it("rejects wrong version", () => {
    const text = JSON.stringify({ version: "v2", entries: {} });
    assert.deepEqual(parseIndex(text), {});
  });

  it("rejects missing entries object", () => {
    const text = JSON.stringify({ version: "v1" });
    assert.deepEqual(parseIndex(text), {});
  });

  it("rejects a ready entry with a non-hex hash", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": {
          kind: "ready",
          submissionId: "sub-1",
          submittedAt: "2026-04-23T10:00:00.000Z",
          basedOnWorkHash: "not-a-hash",
          generatedAt: "2026-04-23T10:05:00.000Z",
        },
      },
    });
    assert.deepEqual(parseIndex(text), {});
  });

  it("rejects a stale entry with missing previousWorkHash", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": {
          kind: "stale",
          submissionId: "sub-1",
          submittedAt: "2026-04-23T10:00:00.000Z",
          generatedAt: "2026-04-23T10:05:00.000Z",
        },
      },
    });
    assert.deepEqual(parseIndex(text), {});
  });

  it("rejects unknown kinds", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-a": { kind: "bogus" },
      },
    });
    assert.deepEqual(parseIndex(text), {});
  });

  it("drops corrupt entries but keeps good neighbours", () => {
    const text = JSON.stringify({
      version: "v1",
      entries: {
        "w-good": {
          kind: "ready",
          submissionId: "sub-1",
          submittedAt: "2026-04-23T10:00:00.000Z",
          basedOnWorkHash: hashA,
          generatedAt: "2026-04-23T10:05:00.000Z",
        },
        "w-bad": { kind: "ready" /* missing fields */ },
        "w-alien": "not-even-an-object",
      },
    });
    const parsed = parseIndex(text);
    assert.deepEqual(Object.keys(parsed).sort(), ["w-good"]);
  });
});
