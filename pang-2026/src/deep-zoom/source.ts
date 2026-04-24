/**
 * PANG — durable tile-source shape.
 *
 * The two pyramid shapes OpenSeadragon consumes natively, sealed
 * behind a Zod-validated discriminated union so a malformed sidecar
 * never reaches OSD:
 *
 *   - `simple-image` — flat JPEG / PNG. No pyramid, no tiling. The
 *     deep-zoom surface still mounts so Laura's pinch-past-flat
 *     gesture survives, but the "paint strokes visible" promise is
 *     deferred to whichever DZI eventually replaces this entry.
 *   - `dzi` — relative URL to a `.dzi` manifest produced by the
 *     build-time pyramid generator (`scripts/build-deepzoom-pyramids.ts`).
 *     OSD reads the manifest and pulls tile levels on demand from
 *     the sibling `_files/` directory the generator writes alongside.
 *
 * The shape lives in `src/deep-zoom/` (not `src/stores/`) because
 * both the durable store and the runtime `<DeepZoom>` viewer
 * consume it — keeping it in either silo would force a circular
 * import the first time the other one tried to type-check against
 * the same union. Iter #7's `<DeepZoom>` originally declared
 * `DeepZoomSource` inline; iter #8 lifts it here, drops the
 * inline declaration, and re-exports the type from `DeepZoom.tsx`
 * so call sites that already typed against the old name keep
 * compiling.
 *
 * Codified in `PANG_Aha_Sprint.md` iter #8 (data phase) — primitive
 * ahead of data per `CLAUDE.md` § 5 move 5; the adapter shape is
 * decided here, before the seed pyramids land in the public tree.
 */

import { z } from "zod";

/**
 * URL constraint for tile sources. Both `dzi` and `simple-image`
 * accept site-relative paths (preferred — survives a CDN swap and
 * keeps the CSP clean) and absolute https URLs (for museum-hosted
 * Open Access pyramids the gallery later registers). No `data:`,
 * no `blob:` — those don't survive a refresh, and the durable
 * shape must.
 */
const TileSourceUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (v) => v.startsWith("/") || v.startsWith("https://"),
    "tileSource.url must be site-relative or https://",
  );

/**
 * The durable, Zod-validated tile source. Shape is intentionally
 * identical to the runtime `DeepZoomSource` consumed by `<DeepZoom>`,
 * so the projection in / out of the store is the identity function.
 */
export const TileSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dzi"),
    url: TileSourceUrlSchema,
  }),
  z.object({
    kind: z.literal("simple-image"),
    url: TileSourceUrlSchema,
  }),
]);

export type TileSource = z.infer<typeof TileSourceSchema>;

/**
 * Parse a raw value (from JSON, from a sidecar, from a fixture)
 * into a `TileSource`, or return `null` if the shape doesn't pass.
 * Mirrors the persistence layer's `parseDocument` style — additive,
 * drop-on-mismatch — so a malformed `tileSource` field never takes
 * the entry's other fields with it.
 */
export function parseTileSource(raw: unknown): TileSource | null {
  const result = TileSourceSchema.safeParse(raw);
  return result.success ? result.data : null;
}
