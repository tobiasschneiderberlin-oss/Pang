/**
 * PANG — OPFS tile cache pure-helper tests.
 *
 * The OPFS I/O side of this module (read/writeIndex, getTileBlob,
 * putTileBlob, evictLRU, cacheStats, fetchTileCached) touches the
 * origin private file system and is not exercisable under Node's
 * test runner without a FileSystemDirectoryHandle shim. Those
 * paths are covered by the preview harness (iter #6 pattern, real
 * `navigator.storage` under Chromium).
 *
 * What we lock here:
 *   - `cacheKey(url)` is deterministic, hex, 16 chars (FNV-1a 64b).
 *   - `cacheKey` changes with the URL (no stupid collisions on the
 *     tiny URL set we care about).
 *   - `workIdFromUrl` extracts the slug; rejects shapes that don't
 *     match `/deep-zoom/<slug>/...`.
 *   - `parseIndexEntry` accepts well-formed rows, rejects everything
 *     else (wrong types, empty strings, negative numbers, bad hash).
 *   - `serialiseIndex` + `parseIndex` round-trip an entry list.
 *   - `parseIndex` never throws on malformed JSON / wrong top type.
 *   - `planEviction` returns empty under-budget; pops in ascending
 *     `lastAccessMs` order; accounts bytes correctly.
 *   - `perWorkBytes` aggregates per work, buckets unknown URLs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cacheKey,
  parseIndex,
  parseIndexEntry,
  pathForKey,
  perWorkBytes,
  planEviction,
  serialiseIndex,
  workIdFromUrl,
  type TileIndexEntry,
} from "./opfs-cache";

// ---------- cacheKey --------------------------------------------

describe("cacheKey", () => {
  it("produces a 16-char lowercase hex string", () => {
    const k = cacheKey("/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg");
    assert.match(k, /^[0-9a-f]{16}$/);
  });

  it("is deterministic — identical input produces identical output", () => {
    const url = "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg";
    assert.equal(cacheKey(url), cacheKey(url));
  });

  it("differs for different URLs", () => {
    const a = cacheKey("/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg");
    const b = cacheKey("/deep-zoom/vermeer-pearl/manifest_files/8/0_1.jpeg");
    assert.notEqual(a, b);
  });

  it("differs between adjacent tile coordinates across a realistic set", () => {
    // 64 tile URLs from a typical mid-level DZI grid. All 64 keys
    // must be distinct — FNV-1a has low collision risk but we're
    // hand-checking on the exact traffic shape we care about.
    const seen = new Set<string>();
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const url = `/deep-zoom/vermeer-pearl/manifest_files/10/${col}_${row}.jpeg`;
        seen.add(cacheKey(url));
      }
    }
    assert.equal(seen.size, 64);
  });

  it("handles the empty string without throwing", () => {
    assert.match(cacheKey(""), /^[0-9a-f]{16}$/);
  });
});

// ---------- pathForKey ------------------------------------------

describe("pathForKey", () => {
  it("nests under deep-zoom-cache/ with a .bin extension", () => {
    assert.equal(pathForKey("abc1234567890def"), "deep-zoom-cache/abc1234567890def.bin");
  });
});

// ---------- workIdFromUrl ---------------------------------------

describe("workIdFromUrl", () => {
  it("extracts the slug from a canonical DZI tile URL", () => {
    assert.equal(
      workIdFromUrl("/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg"),
      "vermeer-pearl",
    );
  });

  it("extracts the slug from a manifest URL", () => {
    assert.equal(
      workIdFromUrl("/deep-zoom/van-gogh-wheatfield/manifest.dzi"),
      "van-gogh-wheatfield",
    );
  });

  it("returns null for a URL that isn't under /deep-zoom/", () => {
    assert.equal(workIdFromUrl("/works/flat.jpg"), null);
  });

  it("returns null for an absolute URL with a different origin", () => {
    assert.equal(
      workIdFromUrl("https://example.com/deep-zoom/vermeer/manifest.dzi"),
      null,
    );
  });

  it("returns null when the slug segment is missing", () => {
    assert.equal(workIdFromUrl("/deep-zoom/"), null);
    assert.equal(workIdFromUrl("/deep-zoom"), null);
  });

  it("rejects non-slug characters (uppercase, underscore, slash)", () => {
    assert.equal(workIdFromUrl("/deep-zoom/Vermeer-Pearl/manifest.dzi"), null);
    assert.equal(workIdFromUrl("/deep-zoom/vermeer_pearl/manifest.dzi"), null);
  });
});

// ---------- parseIndexEntry -------------------------------------

const OK_HASH = "0123456789abcdef";

describe("parseIndexEntry", () => {
  it("accepts a well-formed entry", () => {
    const parsed = parseIndexEntry({
      hash: OK_HASH,
      url: "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg",
      bytes: 1234,
      lastAccessMs: 1_700_000_000_000,
    });
    assert.ok(parsed);
    assert.equal(parsed.hash, OK_HASH);
    assert.equal(parsed.bytes, 1234);
  });

  it("rejects null / undefined / non-objects", () => {
    assert.equal(parseIndexEntry(null), null);
    assert.equal(parseIndexEntry(undefined), null);
    assert.equal(parseIndexEntry("string"), null);
    assert.equal(parseIndexEntry(42), null);
  });

  it("rejects missing or misshapen hash", () => {
    assert.equal(
      parseIndexEntry({ url: "/x", bytes: 1, lastAccessMs: 1 }),
      null,
    );
    assert.equal(
      parseIndexEntry({ hash: "short", url: "/x", bytes: 1, lastAccessMs: 1 }),
      null,
    );
    assert.equal(
      parseIndexEntry({
        hash: "XYZ0123456789ABC",
        url: "/x",
        bytes: 1,
        lastAccessMs: 1,
      }),
      null,
    );
  });

  it("rejects empty url", () => {
    assert.equal(
      parseIndexEntry({ hash: OK_HASH, url: "", bytes: 1, lastAccessMs: 1 }),
      null,
    );
  });

  it("rejects negative or non-finite bytes", () => {
    assert.equal(
      parseIndexEntry({ hash: OK_HASH, url: "/x", bytes: -1, lastAccessMs: 1 }),
      null,
    );
    assert.equal(
      parseIndexEntry({
        hash: OK_HASH,
        url: "/x",
        bytes: Infinity,
        lastAccessMs: 1,
      }),
      null,
    );
    assert.equal(
      parseIndexEntry({ hash: OK_HASH, url: "/x", bytes: NaN, lastAccessMs: 1 }),
      null,
    );
  });

  it("rejects negative or non-finite lastAccessMs", () => {
    assert.equal(
      parseIndexEntry({ hash: OK_HASH, url: "/x", bytes: 1, lastAccessMs: -1 }),
      null,
    );
    assert.equal(
      parseIndexEntry({
        hash: OK_HASH,
        url: "/x",
        bytes: 1,
        lastAccessMs: NaN,
      }),
      null,
    );
  });

  it("accepts zero bytes (empty tile is legal if unusual)", () => {
    const parsed = parseIndexEntry({
      hash: OK_HASH,
      url: "/x",
      bytes: 0,
      lastAccessMs: 1,
    });
    assert.ok(parsed);
    assert.equal(parsed.bytes, 0);
  });
});

// ---------- serialiseIndex / parseIndex -------------------------

describe("serialiseIndex / parseIndex", () => {
  const E1: TileIndexEntry = {
    hash: "0000000000000001",
    url: "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg",
    bytes: 1024,
    lastAccessMs: 1_700_000_000_000,
  };
  const E2: TileIndexEntry = {
    hash: "0000000000000002",
    url: "/deep-zoom/van-gogh-wheatfield/manifest_files/8/0_0.jpeg",
    bytes: 2048,
    lastAccessMs: 1_700_000_001_000,
  };

  it("round-trips a non-empty list", () => {
    const parsed = parseIndex(serialiseIndex([E1, E2]));
    assert.equal(parsed.length, 2);
    assert.deepEqual(parsed[0], E1);
    assert.deepEqual(parsed[1], E2);
  });

  it("round-trips an empty list", () => {
    assert.deepEqual(parseIndex(serialiseIndex([])), []);
  });

  it("returns [] on malformed JSON", () => {
    assert.deepEqual(parseIndex("{not json"), []);
    assert.deepEqual(parseIndex(""), []);
  });

  it("returns [] when the top level is not an array", () => {
    assert.deepEqual(parseIndex('{"hash": "x"}'), []);
    assert.deepEqual(parseIndex('"oops"'), []);
    assert.deepEqual(parseIndex("42"), []);
  });

  it("drops individual malformed rows, keeps the rest", () => {
    const text = JSON.stringify([
      E1,
      { hash: "short", url: "/x", bytes: 1, lastAccessMs: 1 }, // bad hash
      E2,
      { hash: OK_HASH, url: "/y", bytes: -1, lastAccessMs: 1 }, // bad bytes
    ]);
    const parsed = parseIndex(text);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.hash, E1.hash);
    assert.equal(parsed[1]?.hash, E2.hash);
  });
});

// ---------- planEviction ----------------------------------------

function entry(
  hash: string,
  bytes: number,
  lastAccessMs: number,
  url = "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg",
): TileIndexEntry {
  return { hash, bytes, lastAccessMs, url };
}

describe("planEviction", () => {
  it("returns an empty plan when total is already under maxBytes", () => {
    const entries = [entry("a".repeat(16), 100, 1), entry("b".repeat(16), 200, 2)];
    const plan = planEviction(entries, 1000);
    assert.equal(plan.hashesToRemove.length, 0);
    assert.equal(plan.bytesFreed, 0);
    assert.equal(plan.remainingBytes, 300);
  });

  it("returns an empty plan when total exactly equals maxBytes", () => {
    const entries = [entry("a".repeat(16), 500, 1), entry("b".repeat(16), 500, 2)];
    const plan = planEviction(entries, 1000);
    assert.equal(plan.hashesToRemove.length, 0);
    assert.equal(plan.remainingBytes, 1000);
  });

  it("evicts the least-recently-used entry first", () => {
    const oldest = entry("a".repeat(16), 400, 1); // LRU
    const newer = entry("b".repeat(16), 400, 10);
    const newest = entry("c".repeat(16), 400, 100);
    const plan = planEviction([newest, oldest, newer], 800);
    assert.equal(plan.hashesToRemove.length, 1);
    assert.equal(plan.hashesToRemove[0], oldest.hash);
    assert.equal(plan.bytesFreed, 400);
    assert.equal(plan.remainingBytes, 800);
  });

  it("keeps evicting until the remainder is at or under maxBytes", () => {
    // 5 entries @ 300 each = 1500 total; max 500 → evict 4 oldest
    const entries = [
      entry("a".repeat(16), 300, 1),
      entry("b".repeat(16), 300, 2),
      entry("c".repeat(16), 300, 3),
      entry("d".repeat(16), 300, 4),
      entry("e".repeat(16), 300, 5),
    ];
    const plan = planEviction(entries, 500);
    assert.equal(plan.hashesToRemove.length, 4);
    assert.deepEqual(
      [...plan.hashesToRemove],
      [
        "a".repeat(16),
        "b".repeat(16),
        "c".repeat(16),
        "d".repeat(16),
      ],
    );
    assert.equal(plan.bytesFreed, 1200);
    assert.equal(plan.remainingBytes, 300);
  });

  it("handles ties in lastAccessMs without crashing (order-stable-enough)", () => {
    const a = entry("a".repeat(16), 600, 5);
    const b = entry("b".repeat(16), 600, 5);
    const plan = planEviction([a, b], 700);
    // Must remove exactly one; deterministic across re-runs.
    assert.equal(plan.hashesToRemove.length, 1);
    const first = planEviction([a, b], 700).hashesToRemove[0];
    const second = planEviction([a, b], 700).hashesToRemove[0];
    assert.equal(first, second);
  });

  it("returns everything when maxBytes is 0", () => {
    const entries = [entry("a".repeat(16), 100, 1), entry("b".repeat(16), 100, 2)];
    const plan = planEviction(entries, 0);
    assert.equal(plan.hashesToRemove.length, 2);
    assert.equal(plan.remainingBytes, 0);
  });

  it("handles an empty index", () => {
    const plan = planEviction([], 1000);
    assert.equal(plan.hashesToRemove.length, 0);
    assert.equal(plan.remainingBytes, 0);
  });

  it("does not mutate the input array", () => {
    const entries = [
      entry("a".repeat(16), 300, 5),
      entry("b".repeat(16), 300, 1),
      entry("c".repeat(16), 300, 3),
    ];
    const before = entries.map((e) => e.hash);
    planEviction(entries, 100);
    const after = entries.map((e) => e.hash);
    assert.deepEqual(after, before);
  });
});

// ---------- perWorkBytes ----------------------------------------

describe("perWorkBytes", () => {
  it("aggregates bytes by work id", () => {
    const entries = [
      entry(
        "a".repeat(16),
        1000,
        1,
        "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg",
      ),
      entry(
        "b".repeat(16),
        2000,
        2,
        "/deep-zoom/vermeer-pearl/manifest_files/8/0_1.jpeg",
      ),
      entry(
        "c".repeat(16),
        4000,
        3,
        "/deep-zoom/van-gogh-wheatfield/manifest_files/8/0_0.jpeg",
      ),
    ];
    const per = perWorkBytes(entries);
    assert.equal(per["vermeer-pearl"], 3000);
    assert.equal(per["van-gogh-wheatfield"], 4000);
  });

  it("buckets URLs that don't match the deep-zoom shape under (unknown)", () => {
    const entries = [
      entry("a".repeat(16), 500, 1, "/somewhere/else.jpg"),
      entry(
        "b".repeat(16),
        800,
        2,
        "/deep-zoom/vermeer-pearl/manifest_files/8/0_0.jpeg",
      ),
    ];
    const per = perWorkBytes(entries);
    assert.equal(per["(unknown)"], 500);
    assert.equal(per["vermeer-pearl"], 800);
  });

  it("returns an empty map for an empty index", () => {
    assert.deepEqual(perWorkBytes([]), {});
  });
});
