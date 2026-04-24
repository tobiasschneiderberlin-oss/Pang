/**
 * PANG — durable tile-source schema tests.
 *
 * Locks the Zod-validated `TileSource` shape so a malformed sidecar
 * never reaches `<DeepZoom>` / OpenSeadragon. Pure; no fixtures, no
 * I/O. The pyramid generator + the OPFS cache get their own tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TileSourceSchema,
  parseTileSource,
  type TileSource,
} from "./source";

describe("TileSourceSchema", () => {
  it("accepts a site-relative DZI manifest", () => {
    const r = TileSourceSchema.safeParse({
      kind: "dzi",
      url: "/deep-zoom/vermeer-pearl/manifest.dzi",
    });
    assert.equal(r.success, true);
  });

  it("accepts a site-relative simple-image fallback", () => {
    const r = TileSourceSchema.safeParse({
      kind: "simple-image",
      url: "/works/vermeer-pearl.jpg",
    });
    assert.equal(r.success, true);
  });

  it("accepts an https museum-hosted DZI", () => {
    const r = TileSourceSchema.safeParse({
      kind: "dzi",
      url: "https://images.example-museum.org/deep-zoom/x.dzi",
    });
    assert.equal(r.success, true);
  });

  it("rejects an unknown discriminator", () => {
    const r = TileSourceSchema.safeParse({
      kind: "iiif",
      url: "/x",
    });
    assert.equal(r.success, false);
  });

  it("rejects a missing kind", () => {
    const r = TileSourceSchema.safeParse({ url: "/x" });
    assert.equal(r.success, false);
  });

  it("rejects an empty url", () => {
    const r = TileSourceSchema.safeParse({ kind: "dzi", url: "" });
    assert.equal(r.success, false);
  });

  it("rejects a data: URL (not durable across refresh)", () => {
    const r = TileSourceSchema.safeParse({
      kind: "simple-image",
      url: "data:image/png;base64,iVBORw0K...",
    });
    assert.equal(r.success, false);
  });

  it("rejects a blob: URL (dies on next page load)", () => {
    const r = TileSourceSchema.safeParse({
      kind: "simple-image",
      url: "blob:https://pang.app/abc",
    });
    assert.equal(r.success, false);
  });

  it("rejects http:// (CSP forbids unencrypted tile traffic)", () => {
    const r = TileSourceSchema.safeParse({
      kind: "dzi",
      url: "http://insecure.example.com/x.dzi",
    });
    assert.equal(r.success, false);
  });

  it("rejects a url > 2048 chars", () => {
    const tooLong = "/" + "a".repeat(2048);
    const r = TileSourceSchema.safeParse({ kind: "dzi", url: tooLong });
    assert.equal(r.success, false);
  });
});

describe("parseTileSource", () => {
  it("returns the parsed value on a valid shape", () => {
    const v: TileSource | null = parseTileSource({
      kind: "dzi",
      url: "/deep-zoom/x.dzi",
    });
    assert.ok(v);
    assert.equal(v?.kind, "dzi");
    assert.equal(v?.url, "/deep-zoom/x.dzi");
  });

  it("returns null on a malformed shape (drop, don't throw)", () => {
    assert.equal(parseTileSource({ kind: "iiif", url: "/x" }), null);
    assert.equal(parseTileSource(null), null);
    assert.equal(parseTileSource(undefined), null);
    assert.equal(parseTileSource("string"), null);
    assert.equal(parseTileSource(42), null);
  });
});
