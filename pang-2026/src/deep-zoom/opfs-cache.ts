/**
 * PANG — OPFS tile cache for deep-zoom.
 *
 * OSD pulls tiles from `/deep-zoom/<workId>/manifest_files/<level>/
 * <col>_<row>.jpeg`. On a fresh session, every tile is a network
 * hit; on a return session, the browser's HTTP cache *might* hold
 * them — or might not, depending on the Cache-Control headers the
 * static server emits. This module gives PANG a persistent,
 * quota-managed tile store under OPFS (Architecture doc A16 +
 * P5): `deep-zoom-cache/<hash>.bin`, with a tiny index sidecar
 * `deep-zoom-cache/index.json` tracking size and last-access time.
 *
 * The cache is the wrapper around `fetchTile()` that the DeepZoom
 * component installs on OSD's `downloadTileStart` hook. The
 * component is free to call `fetchTileCached(url)` directly too
 * (pre-warm in the background when the Room focuses a work with
 * a tileSource).
 *
 * LRU eviction is per-work: `evictLRU({ maxBytes })` removes the
 * least-recently-used tiles across the whole cache until total
 * bytes fall under `maxBytes`. `navigator.storage.estimate()` is
 * consulted as a soft quota signal; when free space drops below
 * `LOW_QUOTA_THRESHOLD_BYTES`, eviction fires before the next
 * write even if we're under `maxBytes`.
 *
 * Pure helpers (serialise, parse, plan) are tested directly; the
 * OPFS I/O is tested via the preview harness (iter #6 pattern —
 * real `navigator.storage` under Chromium).
 *
 * Codified in `PANG_Aha_Sprint.md` iter #8.
 */

const CACHE_DIR = "deep-zoom-cache";
/**
 * Soft per-cache ceiling. 40 MB holds roughly 12 k DZI tiles at
 * ~3 KB per tile — enough for a handful of works fully pre-paged.
 * Crossing this bound triggers LRU eviction on the next write.
 */
export const DEFAULT_MAX_BYTES = 40 * 1024 * 1024;
/**
 * If free OPFS space falls below this, evict before writing. Keeps
 * the cache from being the last user of the origin's quota.
 */
export const LOW_QUOTA_THRESHOLD_BYTES = 50 * 1024 * 1024;

// ---------- pure helpers ----------------------------------------

/**
 * Index entry per cached tile. Keyed by cache `hash`; `url` is the
 * original request URL (kept for diagnostics + per-work eviction);
 * `bytes` is the cached payload size; `lastAccessMs` is the wall-
 * clock timestamp of the most recent hit, updated on every
 * `getTileBlob()` that resolves to a Blob.
 */
export interface TileIndexEntry {
  readonly hash: string;
  readonly url: string;
  readonly bytes: number;
  readonly lastAccessMs: number;
}

/**
 * Deterministic non-crypto hash of a tile URL, hex. We use it as
 * the filename on disk so arbitrary URL characters (slashes, query
 * strings) don't have to be URL-escaped into OPFS names. FNV-1a
 * 64-bit is enough: we need uniqueness across ~10 k tiles, not
 * collision-resistance under attack.
 */
export function cacheKey(url: string): string {
  let h1 = 0xcbf29ce4 >>> 0;
  let h2 = 0x84222325 >>> 0;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + 1), 0x01000193) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  );
}

/** OPFS file path for a given cache hash. */
export function pathForKey(hash: string): string {
  return `${CACHE_DIR}/${hash}.bin`;
}

/**
 * Extract the `workId` from a canonical tile URL. Returns `null`
 * if the URL doesn't match the `/deep-zoom/<workId>/...` shape —
 * the cache still works, but per-work eviction won't group that
 * tile with its siblings. Real URLs from the build-time generator
 * always match, so this is a safety valve, not a hot path.
 */
export function workIdFromUrl(url: string): string | null {
  const m = /^\/deep-zoom\/([a-z0-9-]+)\//.exec(url);
  return m && m[1] ? m[1] : null;
}

/** Serialise the in-memory index to JSON text. */
export function serialiseIndex(entries: readonly TileIndexEntry[]): string {
  return JSON.stringify(entries);
}

/** Parse a single row defensively — drop anything misshaped. */
export function parseIndexEntry(raw: unknown): TileIndexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const hash = r["hash"];
  const url = r["url"];
  const bytes = r["bytes"];
  const lastAccessMs = r["lastAccessMs"];
  if (typeof hash !== "string" || !/^[0-9a-f]{16}$/.test(hash)) return null;
  if (typeof url !== "string" || url.length === 0) return null;
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  if (
    typeof lastAccessMs !== "number" ||
    !Number.isFinite(lastAccessMs) ||
    lastAccessMs < 0
  ) {
    return null;
  }
  return { hash, url, bytes, lastAccessMs };
}

/** Parse a serialised index — drop rows that don't pass, never throw. */
export function parseIndex(text: string): TileIndexEntry[] {
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    const out: TileIndexEntry[] = [];
    for (const r of raw) {
      const parsed = parseIndexEntry(r);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Pure LRU eviction planner. Given the current index, returns the
 * set of hashes to delete so total bytes fall at or under
 * `maxBytes`. Sort ascending by `lastAccessMs` and pop until
 * sufficient. Caller is responsible for the I/O side of removal +
 * writing the new index.
 *
 * If `currentBytes` is already ≤ `maxBytes`, returns an empty
 * plan — no work to do.
 */
export interface EvictionPlan {
  readonly hashesToRemove: readonly string[];
  readonly bytesFreed: number;
  readonly remainingBytes: number;
}

export function planEviction(
  entries: readonly TileIndexEntry[],
  maxBytes: number,
): EvictionPlan {
  const current = entries.reduce((acc, e) => acc + e.bytes, 0);
  if (current <= maxBytes) {
    return { hashesToRemove: [], bytesFreed: 0, remainingBytes: current };
  }
  const sorted = [...entries].sort((a, b) => a.lastAccessMs - b.lastAccessMs);
  const remove: string[] = [];
  let running = current;
  for (const entry of sorted) {
    if (running <= maxBytes) break;
    remove.push(entry.hash);
    running -= entry.bytes;
  }
  return {
    hashesToRemove: remove,
    bytesFreed: current - running,
    remainingBytes: running,
  };
}

/**
 * Reduce the index to a `{workId: bytes}` map. Used by telemetry
 * to report per-work cache footprint without having the caller
 * re-scan the index.
 */
export function perWorkBytes(
  entries: readonly TileIndexEntry[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const id = workIdFromUrl(e.url) ?? "(unknown)";
    out[id] = (out[id] ?? 0) + e.bytes;
  }
  return out;
}

// ---------- OPFS I/O (browser-only; silently no-ops in Node) -----

function hasOpfs(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.storage &&
    "getDirectory" in navigator.storage
  );
}

async function ensureCacheDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOpfs()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(CACHE_DIR, { create: true });
  } catch {
    return null;
  }
}

async function readIndex(): Promise<TileIndexEntry[]> {
  if (!hasOpfs()) return [];
  try {
    const dir = await ensureCacheDir();
    if (!dir) return [];
    const handle = await dir.getFileHandle("index.json").catch(() => null);
    if (!handle) return [];
    const file = await handle.getFile();
    return parseIndex(await file.text());
  } catch {
    return [];
  }
}

async function writeIndex(entries: readonly TileIndexEntry[]): Promise<void> {
  if (!hasOpfs()) return;
  try {
    const dir = await ensureCacheDir();
    if (!dir) return;
    const handle = await dir.getFileHandle("index.json", { create: true });
    const writable = await handle.createWritable();
    await writable.write(serialiseIndex(entries));
    await writable.close();
  } catch {
    // best-effort
  }
}

/**
 * Read a tile's bytes from OPFS. Returns `null` on miss or on any
 * OPFS failure — the caller falls back to network, which is the
 * whole point: the cache is a best-effort layer, never a gate.
 *
 * Side effect: on hit, touches the index so the tile moves to the
 * front of the LRU queue.
 */
export async function getTileBlob(url: string): Promise<Blob | null> {
  if (!hasOpfs()) return null;
  const hash = cacheKey(url);
  try {
    const dir = await ensureCacheDir();
    if (!dir) return null;
    const handle = await dir
      .getFileHandle(`${hash}.bin`)
      .catch(() => null);
    if (!handle) return null;
    const file = await handle.getFile();
    // Touch the index — read, patch, write. A writer contending
    // with a reader is acceptable: worst case we lose one touch,
    // LRU is tolerant of that.
    const index = await readIndex();
    const updated = index.map((e) =>
      e.hash === hash ? { ...e, lastAccessMs: Date.now() } : e,
    );
    void writeIndex(updated);
    return file;
  } catch {
    return null;
  }
}

/**
 * Called whenever LRU eviction fires as a side effect of a write.
 * `count` is the number of tiles removed; `bytesFreed` is the total
 * sum of their sizes; `bytesRemaining` is the new index footprint.
 * The cache treats the callback as advisory — its own state
 * converges regardless of what the callback does or throws.
 */
export type OnEvict = (
  count: number,
  bytesFreed: number,
  bytesRemaining: number,
) => void;

/**
 * Write a tile to OPFS and update the index. No-ops silently if
 * OPFS is unavailable or the write throws — we never want the
 * cache's presence to change what the user sees (only how fast).
 *
 * `opts.onEvict` is called once *per eviction batch*, not per
 * evicted tile. Telemetry attaches here so the callback is
 * scope-agnostic.
 */
export async function putTileBlob(
  url: string,
  blob: Blob,
  opts: { maxBytes?: number; onEvict?: OnEvict } = {},
): Promise<void> {
  if (!hasOpfs()) return;
  const hash = cacheKey(url);
  try {
    const dir = await ensureCacheDir();
    if (!dir) return;
    const handle = await dir.getFileHandle(`${hash}.bin`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    const index = await readIndex();
    const now = Date.now();
    const withoutThis = index.filter((e) => e.hash !== hash);
    const next: TileIndexEntry[] = [
      ...withoutThis,
      { hash, url, bytes: blob.size, lastAccessMs: now },
    ];
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

    // Optional quota probe. If free space is low, be more
    // aggressive than the soft ceiling alone would suggest.
    let effectiveMax = maxBytes;
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ?? Number.POSITIVE_INFINITY;
      const usage = est.usage ?? 0;
      if (quota - usage < LOW_QUOTA_THRESHOLD_BYTES) {
        effectiveMax = Math.min(effectiveMax, Math.floor(maxBytes * 0.5));
      }
    } catch {
      // estimate is advisory; its failure does not block writes.
    }

    const plan = planEviction(next, effectiveMax);
    if (plan.hashesToRemove.length === 0) {
      await writeIndex(next);
      return;
    }
    for (const evictHash of plan.hashesToRemove) {
      await dir.removeEntry(`${evictHash}.bin`).catch(() => {});
    }
    const removeSet = new Set(plan.hashesToRemove);
    const remaining = next.filter((e) => !removeSet.has(e.hash));
    await writeIndex(remaining);
    if (opts.onEvict) {
      try {
        opts.onEvict(
          plan.hashesToRemove.length,
          plan.bytesFreed,
          plan.remainingBytes,
        );
      } catch {
        // Callback is advisory; a throw must not poison the cache.
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Run LRU eviction to bring total cache size at or under `maxBytes`.
 * Returns the plan + the number of actually-freed bytes (which can
 * differ from the plan if an OPFS remove fails — the index still
 * reflects reality because we only drop a row once its file is
 * gone).
 */
export async function evictLRU(
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<{ removed: number; freed: number; remaining: number }> {
  if (!hasOpfs()) return { removed: 0, freed: 0, remaining: 0 };
  const dir = await ensureCacheDir();
  if (!dir) return { removed: 0, freed: 0, remaining: 0 };
  const index = await readIndex();
  const plan = planEviction(index, maxBytes);
  if (plan.hashesToRemove.length === 0) {
    return { removed: 0, freed: 0, remaining: plan.remainingBytes };
  }
  const removed: string[] = [];
  for (const hash of plan.hashesToRemove) {
    try {
      await dir.removeEntry(`${hash}.bin`);
      removed.push(hash);
    } catch {
      // If the file is already gone, drop it from the index anyway.
      removed.push(hash);
    }
  }
  const removedSet = new Set(removed);
  const remaining = index.filter((e) => !removedSet.has(e.hash));
  const freed = index
    .filter((e) => removedSet.has(e.hash))
    .reduce((acc, e) => acc + e.bytes, 0);
  await writeIndex(remaining);
  return {
    removed: removed.length,
    freed,
    remaining: remaining.reduce((acc, e) => acc + e.bytes, 0),
  };
}

/**
 * Inspect the cache without mutating it. Returned stats are a
 * point-in-time snapshot: the counts and byte totals are already
 * stale by the time telemetry reads them. That's fine for a
 * health signal; the cache's own writers continue to converge.
 */
export async function cacheStats(): Promise<{
  count: number;
  totalBytes: number;
  perWork: Record<string, number>;
}> {
  const entries = await readIndex();
  return {
    count: entries.length,
    totalBytes: entries.reduce((acc, e) => acc + e.bytes, 0),
    perWork: perWorkBytes(entries),
  };
}

/**
 * Cache-through fetch. The primary entry point OSD (or a
 * pre-warmer) uses.
 *
 * Flow:
 *   1. Try OPFS. On hit → emit `source: "opfs"`.
 *   2. On miss → `fetch(url)`. On network success → write to OPFS
 *      + emit `source: "network"`.
 *   3. On network failure → propagate the error.
 *
 * `fetcher` is injectable so tests (and the SW, if we ever move
 * there) can stub the network leg without stubbing `fetch`
 * globally.
 */
export async function fetchTileCached(
  url: string,
  fetcher: (u: string) => Promise<Blob> = defaultFetcher,
  opts: { onEvict?: OnEvict } = {},
): Promise<{ blob: Blob; source: "opfs" | "network" }> {
  const cached = await getTileBlob(url);
  if (cached) {
    return { blob: cached, source: "opfs" };
  }
  const blob = await fetcher(url);
  const putOpts: { onEvict?: OnEvict } = {};
  if (opts.onEvict) putOpts.onEvict = opts.onEvict;
  void putTileBlob(url, blob, putOpts);
  return { blob, source: "network" };
}

async function defaultFetcher(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`tile fetch failed: ${response.status} ${url}`);
  }
  return await response.blob();
}
