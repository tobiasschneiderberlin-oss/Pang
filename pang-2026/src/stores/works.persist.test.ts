/**
 * PANG — works persistence pure-function tests.
 *
 * Only the serialise/parse pipeline is exercised here. The OPFS
 * I/O paths (`writeIndex`, `writeImageIfMissing`, `removeImage`,
 * `hydrateWorks`, `installWorksPersistence`) touch the browser
 * storage API and are not runnable under Node's test runner
 * without a FileSystemDirectoryHandle shim — they are covered by
 * the integration walk in the preview harness.
 *
 * What we lock here:
 *   - `projectDurable` strips volatile fields and preserves the
 *     durable ones.
 *   - `parseDurable` accepts well-formed shapes, rejects everything
 *     else.
 *   - `serialiseIndex` + `parseIndex` round-trip an entry list
 *     losslessly for the durable fields.
 *   - `parseIndex` never throws on malformed JSON.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CollectionEntry } from "@/stores/works";
import {
  parseDurable,
  parseIndex,
  projectDurable,
  serialiseIndex,
} from "./works.persist";

const E1: CollectionEntry = {
  id: "e1",
  imageUrl: "blob:live-url-that-does-not-persist",
  status: "verified",
  size: [0.6, 0.8],
};
const E2: CollectionEntry = {
  id: "e2",
  imageUrl: "blob:another-dead-url",
  status: "unverified",
  size: [1.0, 0.7],
};

// ---------- projectDurable --------------------------------------

describe("projectDurable", () => {
  it("keeps id, status, size", () => {
    const d = projectDurable(E1);
    assert.equal(d.id, "e1");
    assert.equal(d.status, "verified");
    assert.deepEqual([...d.size], [0.6, 0.8]);
  });

  it("drops imageUrl (the blob: URL does not survive a page load)", () => {
    const d = projectDurable(E1) as unknown as Record<string, unknown>;
    assert.equal(d["imageUrl"], undefined);
  });
});

// ---------- parseDurable ----------------------------------------

describe("parseDurable", () => {
  it("accepts a well-formed durable shape", () => {
    const parsed = parseDurable({
      id: "e1",
      status: "verified",
      size: [0.6, 0.8],
    });
    assert.ok(parsed);
    assert.equal(parsed.id, "e1");
  });

  it("rejects missing id", () => {
    assert.equal(
      parseDurable({ status: "verified", size: [0.6, 0.8] }),
      null,
    );
  });

  it("rejects empty id", () => {
    assert.equal(
      parseDurable({ id: "", status: "verified", size: [0.6, 0.8] }),
      null,
    );
  });

  it("rejects unknown status", () => {
    assert.equal(
      parseDurable({ id: "e1", status: "pending", size: [0.6, 0.8] }),
      null,
    );
  });

  it("rejects non-array size", () => {
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: 0.6 }),
      null,
    );
  });

  it("rejects wrong-length size", () => {
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: [0.6] }),
      null,
    );
  });

  it("rejects non-finite size values", () => {
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: [Infinity, 0.8] }),
      null,
    );
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: [NaN, 0.8] }),
      null,
    );
  });

  it("rejects non-positive size values", () => {
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: [0, 0.8] }),
      null,
    );
    assert.equal(
      parseDurable({ id: "e1", status: "verified", size: [-1, 0.8] }),
      null,
    );
  });

  it("rejects null and non-objects", () => {
    assert.equal(parseDurable(null), null);
    assert.equal(parseDurable(undefined), null);
    assert.equal(parseDurable("string"), null);
    assert.equal(parseDurable(42), null);
  });
});

// ---------- serialiseIndex / parseIndex -------------------------

describe("serialiseIndex / parseIndex", () => {
  it("round-trips the durable fields of a non-empty list", () => {
    const text = serialiseIndex([E1, E2]);
    const parsed = parseIndex(text);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.id, "e1");
    assert.equal(parsed[0]?.status, "verified");
    assert.deepEqual([...(parsed[0]?.size ?? [])], [0.6, 0.8]);
    assert.equal(parsed[1]?.id, "e2");
    assert.equal(parsed[1]?.status, "unverified");
  });

  it("round-trips an empty list", () => {
    assert.deepEqual(parseIndex(serialiseIndex([])), []);
  });

  it("serialised text never includes imageUrl", () => {
    const text = serialiseIndex([E1]);
    assert.ok(!text.includes("imageUrl"));
    assert.ok(!text.includes("blob:"));
  });

  it("parseIndex returns [] on malformed JSON", () => {
    assert.deepEqual(parseIndex("{not json"), []);
    assert.deepEqual(parseIndex(""), []);
  });

  it("parseIndex returns [] when the top level is not an array", () => {
    assert.deepEqual(parseIndex('{"e1": {}}'), []);
    assert.deepEqual(parseIndex('"just a string"'), []);
  });

  it("parseIndex drops individual malformed entries, keeps the rest", () => {
    const text = JSON.stringify([
      { id: "e1", status: "verified", size: [0.6, 0.8] },
      { id: "", status: "verified", size: [0.6, 0.8] },
      { id: "e2", status: "bogus", size: [0.6, 0.8] },
      { id: "e3", status: "unverified", size: [0.7, 0.9] },
    ]);
    const parsed = parseIndex(text);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.id, "e1");
    assert.equal(parsed[1]?.id, "e3");
  });
});
