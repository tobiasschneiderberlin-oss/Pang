#!/usr/bin/env tsx
/**
 * PANG — build-time DZI pyramid generator.
 *
 * Produces OpenSeadragon-native Deep Zoom Image pyramids at
 * `public/deep-zoom/<id>/manifest.dzi` + sibling tile directories.
 * Run on demand: `npm run build:deepzoom`. NOT wired into `verify`
 * (native binary `sharp` is heavy and the output is deterministic,
 * so re-running is the author's choice, not CI's).
 *
 * The manifest is the shape OSD's `new OpenSeadragon({tileSources:
 * "/deep-zoom/<id>/manifest.dzi"})` consumes without a second
 * request hop. We don't wrap OSD's tile loader — the only PANG-side
 * contract is "put tiles behind a site-relative URL CSP lets us
 * fetch," and the OPFS cache module (iter #8, next step) handles
 * the cache-on-network-hit side transparently.
 *
 * Source bytes: `scripts/__fixtures__/deepzoom-sources/<id>.jpg`.
 * Iter #8 ships procedural sources (deterministic, checked in) so
 * the pipeline is real end-to-end without shelling out to a museum
 * API in CI. Real museum-grade imagery lands via the enrichment
 * path (iter #10 candidate — see `PANG_Aha_Sprint.md`).
 *
 * The tile directory suffix is `_files`, which is the legacy DZI
 * convention OSD reads by default (`<basename>_files/<level>/<col>_<row>.<ext>`).
 * Hardcoded; OSD has a `tileSource.url` + `tileSource.Files` dance
 * for non-default suffixes, not worth the complexity.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ---------- pure helpers (exposed for tests) --------------------

/**
 * Compute the DZI pyramid plan for a given source size + tile size.
 * Pure; deterministic; testable without touching the filesystem.
 *
 * DZI's rule: the maximum level `L = ceil(log2(max(w, h)))`, and
 * each level `k` has dimensions `ceil(w / 2^(L - k)) x ceil(h / 2^(L - k))`.
 * Level 0 is a 1×1 pixel; level `L` is the source size.
 *
 * `tileSize` is typically 254 (the legacy OSD default that leaves
 * a 2-pixel overlap per side, giving a safe 256×256 JPEG on the
 * wire). We pass it through so tests can exercise smaller grids.
 */
export interface PyramidLevel {
  readonly level: number;
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly rows: number;
  readonly tileCount: number;
}

export interface PyramidPlan {
  readonly maxLevel: number;
  readonly levels: readonly PyramidLevel[];
  readonly totalTiles: number;
}

export function planPyramid(
  width: number,
  height: number,
  tileSize: number,
): PyramidPlan {
  if (width <= 0 || height <= 0 || tileSize <= 0) {
    throw new Error(
      `planPyramid: invalid input (w=${width}, h=${height}, tile=${tileSize})`,
    );
  }
  const maxLevel = Math.ceil(Math.log2(Math.max(width, height)));
  const levels: PyramidLevel[] = [];
  let total = 0;
  for (let level = 0; level <= maxLevel; level++) {
    const scale = 2 ** (maxLevel - level);
    const w = Math.ceil(width / scale);
    const h = Math.ceil(height / scale);
    const cols = Math.max(1, Math.ceil(w / tileSize));
    const rows = Math.max(1, Math.ceil(h / tileSize));
    const tileCount = cols * rows;
    total += tileCount;
    levels.push({
      level,
      width: w,
      height: h,
      cols,
      rows,
      tileCount,
    });
  }
  return { maxLevel, levels, totalTiles: total };
}

/**
 * Seed descriptor. Iter #8 pins three works. The ids are
 * hyphen-delimited slugs that double as directory names — the
 * generator writes to `public/deep-zoom/<id>/`.
 */
export interface SeedDescriptor {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Wall-footprint metres, [w, h], used by the store's layout. */
  readonly sizeM: readonly [number, number];
  /** Accent colour (0–255 per channel) for the procedural source. */
  readonly accent: readonly [number, number, number];
  /** Base warmth tone (0–255 per channel) for the procedural source. */
  readonly base: readonly [number, number, number];
  /**
   * Human-readable label written alongside the source as the
   * "alt" text. Surfaced in sidecar JSON, not in the tile stream
   * (DZI has no alt; the store's `verificationHint.artworkSnapshot`
   * is the source of truth for real metadata).
   */
  readonly label: string;
}

/**
 * Three iter #8 seed works. Ids are stable — `public/deep-zoom/<id>/`
 * paths bake into the durable store. The procedural palette gestures
 * toward each painting's mood without claiming to reproduce it (we
 * do not pretend the procedural source *is* the Vermeer). A later
 * iteration swaps the source bytes for real museum-grade pyramids
 * under the same ids; the store field changes nothing.
 */
export const SEEDS: readonly SeedDescriptor[] = [
  {
    id: "vermeer-pearl",
    width: 3000,
    height: 3600,
    sizeM: [0.39, 0.445],
    accent: [36, 64, 108], // dusk blue (turban)
    base: [246, 232, 198], // warm cream ground
    label: "vermeer — girl with a pearl earring (procedural placeholder)",
  },
  {
    id: "van-gogh-wheatfield",
    width: 3600,
    height: 2800,
    sizeM: [0.505, 0.405],
    accent: [212, 176, 28], // ripe wheat yellow
    base: [96, 128, 188], // sky blue
    label: "van gogh — wheatfield with crows (procedural placeholder)",
  },
  {
    id: "rembrandt-night-watch",
    width: 4000,
    height: 3200,
    sizeM: [0.9, 0.72], // not the real 379 × 453 cm — scaled for wall
    accent: [188, 120, 44], // officer's sash
    base: [28, 20, 12], // dark ground
    label: "rembrandt — the night watch (procedural placeholder)",
  },
];

// ---------- procedural source generator -------------------------

/**
 * Generate a deterministic placeholder source image for a seed.
 * Pure pixel arithmetic; identical bytes every run. Pairs with a
 * hard-coded PRNG (linear congruential) seeded from the work id,
 * so each work reads visually distinct when zoomed in even though
 * the pipeline is the same.
 *
 * The goal is *texture under zoom*, not *looks like a painting*.
 * Laura pinching past the fit-to-viewport render should see
 * brushstroke-like bands, paint-stipple speckle, and palette
 * variation — proof the DZI pipeline fires real tile requests.
 */
export function makeProceduralSource(seed: SeedDescriptor): Buffer {
  const { width: W, height: H, accent, base } = seed;
  const rgb = Buffer.alloc(W * H * 3);
  const seedNum = hashSeed(seed.id);
  let rng = seedNum >>> 0;
  const next = (): number => {
    // Park-Miller LCG — small state, adequate distribution for
    // stippling. We never need cryptographic quality here.
    rng = Math.imul(rng ^ (rng >>> 15), 2246822507) >>> 0;
    rng = Math.imul(rng ^ (rng >>> 13), 3266489917) >>> 0;
    return (rng ^ (rng >>> 16)) / 4294967295;
  };

  for (let y = 0; y < H; y++) {
    // Horizontal band phase — introduces a slow colour drift so a
    // zoom to one quadrant shows different palette than another.
    const bandY = y / H;
    const bandPhase = Math.sin(bandY * Math.PI * 3);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const bandX = x / W;
      // Broad gradient from base to accent — the low-frequency layer.
      const t = clamp(
        (bandX + bandY) * 0.5 + bandPhase * 0.12 + (next() - 0.5) * 0.08,
        0,
        1,
      );
      const r = mix(base[0], accent[0], t);
      const g = mix(base[1], accent[1], t);
      const b = mix(base[2], accent[2], t);
      // Per-pixel stipple — the high-frequency detail that only
      // appears at tile-level resolution (pinching past flat reveals
      // it; at thumbnail scale it averages away).
      const stipple = (next() - 0.5) * 24;
      rgb[i + 0] = clampByte(r + stipple);
      rgb[i + 1] = clampByte(g + stipple);
      rgb[i + 2] = clampByte(b + stipple);
    }
  }
  return rgb;
}

function hashSeed(id: string): number {
  // Small deterministic hash so two runs on the same id produce
  // identical bytes. Not collision-resistant; not a security
  // primitive.
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h || 1;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------- main (async; only runs when this file is executed) --

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const SOURCE_DIR = join(REPO_ROOT, "scripts", "__fixtures__", "deepzoom-sources");
const OUT_DIR = join(REPO_ROOT, "public", "deep-zoom");

/**
 * The tile extension + quality knobs. JPEG q=82 is a sensible
 * default for paint-reveal imagery — banding appears around q=72,
 * and q=90 is pure bloat for this use.
 */
const TILE_FORMAT = "jpeg";
const TILE_QUALITY = 82;
const TILE_SIZE = 254;
const TILE_OVERLAP = 1;

interface SourceInfo {
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

async function ensureSource(seed: SeedDescriptor): Promise<SourceInfo> {
  const sourcePath = join(SOURCE_DIR, `${seed.id}.jpg`);
  if (!existsSync(sourcePath)) {
    mkdirSync(dirname(sourcePath), { recursive: true });
    const rgb = makeProceduralSource(seed);
    const jpeg = await sharp(rgb, {
      raw: { width: seed.width, height: seed.height, channels: 3 },
    })
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    writeFileSync(sourcePath, jpeg);
    process.stdout.write(
      `source: ${seed.id} — generated (${jpeg.length} bytes)\n`,
    );
  } else {
    process.stdout.write(`source: ${seed.id} — cached\n`);
  }
  const meta = await sharp(sourcePath).metadata();
  const width = meta.width ?? seed.width;
  const height = meta.height ?? seed.height;
  return { path: sourcePath, width, height };
}

async function buildPyramid(
  seed: SeedDescriptor,
  source: SourceInfo,
): Promise<void> {
  const outRoot = join(OUT_DIR, seed.id);
  mkdirSync(outRoot, { recursive: true });

  // sharp's layout:"dz" with container:"fs" uses the `.toFile()`
  // path as the stem — passing `<outRoot>/manifest` produces
  // `<outRoot>/manifest.dzi` + `<outRoot>/manifest_files/<level>/
  // <col>_<row>.jpeg`. The `basename` TileOptions field only
  // applies when container is `zip`, so we lean on the path.
  const plan = planPyramid(source.width, source.height, TILE_SIZE);
  process.stdout.write(
    `pyramid: ${seed.id} — ${plan.totalTiles} tiles across ${plan.levels.length} levels (${source.width}x${source.height})\n`,
  );
  const stem = join(outRoot, "manifest");
  await sharp(source.path)
    .tile({
      size: TILE_SIZE,
      overlap: TILE_OVERLAP,
      layout: "dz",
      container: "fs",
      [TILE_FORMAT]: { quality: TILE_QUALITY },
    } as sharp.TileOptions)
    .toFile(stem);
}

async function main(): Promise<void> {
  for (const seed of SEEDS) {
    const source = await ensureSource(seed);
    await buildPyramid(seed, source);
  }
  process.stdout.write(`\nall ${SEEDS.length} pyramids built under ${OUT_DIR}\n`);
}

// Run when executed directly (not when imported by tests).
const isMainModule =
  process.argv[1] !== undefined && __filename === process.argv[1];
if (isMainModule) {
  main().catch((err: unknown) => {
    process.stderr.write(`build-deepzoom-pyramids failed: ${String(err)}\n`);
    process.exit(1);
  });
}
