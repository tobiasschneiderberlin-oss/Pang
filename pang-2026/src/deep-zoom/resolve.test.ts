/**
 * PANG — deep-zoom resolver tests.
 *
 * Locks the pure `resolveTileSource(workId, fileRef, entries)`
 * function: returns the TileSource on a valid hit, returns null on
 * missing entry / missing tileSource / mismatched fileRef.
 *
 * `openDeepZoomForWork` is covered by the preview harness — it
 * reads + writes the live works store.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CollectionEntry } from "@/stores/works";
import { resolveTileSource } from "./resolve";

const E_WITH_DZI: CollectionEntry = {
  id: "vermeer",
  imageUrl: "blob:x",
  status: "verified",
  size: [0.6, 0.8],
  tileSource: {
    kind: "dzi",
    url: "/deep-zoom/vermeer-pearl/manifest.dzi",
  },
};
const E_WITH_SIMPLE: CollectionEntry = {
  id: "goya",
  imageUrl: "blob:x",
  status: "unverified",
  size: [0.6, 0.8],
  tileSource: { kind: "simple-image", url: "/works/flat.jpg" },
};
const E_NO_TILE: CollectionEntry = {
  id: "legacy",
  imageUrl: "blob:x",
  status: "unverified",
  size: [0.6, 0.8],
};

describe("resolveTileSource", () => {
  it("returns the DZI TileSource on a valid workId + fileRef", () => {
    const tile = resolveTileSource(
      "vermeer",
      "/deep-zoom/vermeer-pearl/manifest.dzi",
      [E_WITH_DZI, E_WITH_SIMPLE],
    );
    assert.ok(tile);
    assert.equal(tile.kind, "dzi");
    assert.equal(tile.url, "/deep-zoom/vermeer-pearl/manifest.dzi");
  });

  it("returns the simple-image TileSource on a valid workId + fileRef", () => {
    const tile = resolveTileSource("goya", "/works/flat.jpg", [
      E_WITH_DZI,
      E_WITH_SIMPLE,
    ]);
    assert.ok(tile);
    assert.equal(tile.kind, "simple-image");
    assert.equal(tile.url, "/works/flat.jpg");
  });

  it("returns null when the work id is missing from the list", () => {
    assert.equal(
      resolveTileSource("nonexistent", "/x", [E_WITH_DZI]),
      null,
    );
  });

  it("returns null when the entry has no tileSource", () => {
    assert.equal(resolveTileSource("legacy", "/x", [E_NO_TILE]), null);
  });

  it("returns null when the fileRef does not match the tileSource URL", () => {
    // fileRef could go stale between the tap and the render — any
    // mismatch unmounts the overlay, which is safe.
    assert.equal(
      resolveTileSource(
        "vermeer",
        "/deep-zoom/some-other-work/manifest.dzi",
        [E_WITH_DZI],
      ),
      null,
    );
  });

  it("returns null for an empty entries list", () => {
    assert.equal(resolveTileSource("vermeer", "/x", []), null);
  });
});
