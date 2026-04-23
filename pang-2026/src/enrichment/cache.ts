/**
 * PANG — enrichment cache (OPFS-backed).
 *
 * Two files per cached work:
 *
 *   /enrichment/index.json   — durable index: list of
 *                              `{ workId, basedOnWorkHash, generatedAt }`.
 *                              The reconcile pass at boot reads this
 *                              and cross-checks against the current
 *                              works store — a stored entry whose
 *                              hash no longer matches is invalidated
 *                              and emits `enrichment.cache.invalidate`.
 *   /enrichment/<workId>.json — the full `EnrichmentOutput` payload.
 *                              Read on-demand when a work's focused
 *                              surface opens; never loaded eagerly.
 *
 * Why OPFS (P5, A16): the payloads are binary-safe JSON and
 * per-entry; IndexedDB would add indexing overhead we don't need
 * (lookup is always `workId`). Mirrors the intake queue, the
 * outbox, and the works store — the OPFS layout of the app now
 * has four coherent sidecar patterns.
 *
 * `basedOnWorkHash` is the invalidation key: when the intake
 * record's content fields change (see `computeWorkHash` in
 * `./schema.ts`), a stored entry goes stale and reconcile tears
 * it out. The sigil on the hash (`|v1`) future-proofs the shape:
 * a v2 sigil rotation invalidates every v1 entry wholesale.
 *
 * Failure policy: every OPFS operation catches its own errors. A
 * cache miss is indistinguishable from a corrupt file by design —
 * the caller re-dispatches and a fresh payload lands on the next
 * successful agent run.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  EnrichmentOutputSchema,
  type EnrichmentOutput,
} from "./schema";
import {
  cacheHitEvent,
  cacheInvalidateEvent,
  cacheMissEvent,
  reconcileEvent,
  type CacheInvalidateReason,
  type EnrichmentReconcileSummary,
} from "./otel";

const INDEX_PATH = "enrichment/index.json";

function payloadPath(workId: string): string {
  return `enrichment/${workId}.json`;
}

// ---------- Index entry --------------------------------------------

/**
 * The durable per-work index entry. The full `EnrichmentOutput`
 * lives in its own file so the index stays small enough to read on
 * every boot.
 */
export interface EnrichmentIndexEntry {
  readonly workId: string;
  readonly basedOnWorkHash: string;
  readonly generatedAt: string;
}

/** Project a full output to its index entry. Pure; testable. */
export function projectIndexEntry(
  output: EnrichmentOutput,
): EnrichmentIndexEntry {
  return {
    workId: output.workId,
    basedOnWorkHash: output.basedOnWorkHash,
    generatedAt: output.generatedAt,
  };
}

/** Parse one raw entry. Returns null on shape mismatch. Pure; testable. */
export function parseIndexEntry(raw: unknown): EnrichmentIndexEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const workId = r["workId"];
  const basedOnWorkHash = r["basedOnWorkHash"];
  const generatedAt = r["generatedAt"];
  if (typeof workId !== "string" || workId.length === 0) return null;
  if (typeof basedOnWorkHash !== "string") return null;
  if (!/^[0-9a-f]{64}$/.test(basedOnWorkHash)) return null;
  if (typeof generatedAt !== "string" || generatedAt.length === 0) return null;
  return { workId, basedOnWorkHash, generatedAt };
}

/** Serialise the full index list. Pure; testable. */
export function serialiseIndex(
  entries: readonly EnrichmentIndexEntry[],
): string {
  return JSON.stringify(entries);
}

/** Parse the full index. Pure; testable. Returns `[]` on any shape issue. */
export function parseIndex(text: string): EnrichmentIndexEntry[] {
  try {
    // A1 / A3 context: this JSON.parse reads our own sidecar (not AI
    // model output), so it's allowed. The shape is re-validated.
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    const out: EnrichmentIndexEntry[] = [];
    for (const r of raw) {
      const parsed = parseIndexEntry(r);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- Cache operations --------------------------------------

/**
 * Read a cached `EnrichmentOutput` by `workId`. Returns `null` on
 * miss or on any shape/parse error (the caller re-dispatches and a
 * fresh payload replaces the corrupt one on next success).
 *
 * Emits `enrichment.cache.hit` on a successful read and
 * `enrichment.cache.miss` otherwise.
 */
export async function readEnrichmentCache(
  workId: string,
): Promise<EnrichmentOutput | null> {
  if (typeof navigator === "undefined") {
    cacheMissEvent(workId);
    return null;
  }
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    cacheMissEvent(workId);
    return null;
  }
  try {
    const file = await opfsRead(payloadPath(workId));
    if (!file) {
      cacheMissEvent(workId);
      return null;
    }
    const text = await file.text();
    const raw = JSON.parse(text);
    const parsed = EnrichmentOutputSchema.safeParse(raw);
    if (!parsed.success) {
      cacheMissEvent(workId);
      return null;
    }
    cacheHitEvent(workId, parsed.data.basedOnWorkHash);
    return parsed.data;
  } catch {
    cacheMissEvent(workId);
    return null;
  }
}

/**
 * Write a fresh `EnrichmentOutput` to the cache and update the
 * index sidecar. Best-effort: an OPFS error is swallowed so a
 * storage failure never blocks the in-memory store update.
 */
export async function writeEnrichmentCache(
  output: EnrichmentOutput,
): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return;
  try {
    // Re-parse defensively: the caller should have passed a
    // schema-validated object, but this module is the last hop before
    // bytes hit disk. A rejected write is better than a corrupt entry.
    const validated = EnrichmentOutputSchema.parse(output);

    await opfsWrite(payloadPath(validated.workId), JSON.stringify(validated));

    const existing = await readIndex();
    const withoutCurrent = existing.filter(
      (e) => e.workId !== validated.workId,
    );
    const next = [...withoutCurrent, projectIndexEntry(validated)];
    await opfsWrite(INDEX_PATH, serialiseIndex(next));
  } catch {
    // Non-fatal.
  }
}

/**
 * Remove a cached entry and update the index. Emits
 * `enrichment.cache.invalidate` with the named reason. The caller
 * re-dispatches; we do not re-dispatch from here.
 */
export async function invalidateEnrichmentCache(
  workId: string,
  reason: CacheInvalidateReason,
): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("enrichment", { create: true });
    await dir.removeEntry(`${workId}.json`).catch(() => {});

    const existing = await readIndex();
    const next = existing.filter((e) => e.workId !== workId);
    await opfsWrite(INDEX_PATH, serialiseIndex(next));

    cacheInvalidateEvent(workId, reason);
  } catch {
    // Non-fatal. The stale entry remains visible until the next
    // reconcile pass; that is safer than a partial delete.
  }
}

/**
 * Read the index sidecar. Returns `[]` on any read/parse failure.
 */
export async function readIndex(): Promise<EnrichmentIndexEntry[]> {
  if (typeof navigator === "undefined") return [];
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return [];
  try {
    const file = await opfsRead(INDEX_PATH);
    if (!file) return [];
    const text = await file.text();
    return parseIndex(text);
  } catch {
    return [];
  }
}

// ---------- Reconcile (pure + procedural wrappers) ----------------

/**
 * Pure decision function: given the current index and the current
 * work-hash map (from the works store), return the list of work ids
 * to invalidate and which tally each belongs in.
 *
 * Extracted as a pure function so the reconcile logic is unit-testable
 * without touching OPFS or the works store. Mirrors the intake and
 * verification reconcile patterns.
 *
 * - "stale"  — entry exists, current hash differs
 * - "orphan" — entry exists, work is gone from the store
 * - neither  — entry's hash matches, leave alone
 */
export interface EnrichmentReconcilePlan {
  readonly staleWorkIds: readonly string[];
  readonly orphanWorkIds: readonly string[];
}

export function planReconcile(
  index: readonly EnrichmentIndexEntry[],
  currentWorkHashes: ReadonlyMap<string, string>,
): EnrichmentReconcilePlan {
  const stale: string[] = [];
  const orphan: string[] = [];
  for (const entry of index) {
    const currentHash = currentWorkHashes.get(entry.workId);
    if (currentHash === undefined) {
      orphan.push(entry.workId);
    } else if (currentHash !== entry.basedOnWorkHash) {
      stale.push(entry.workId);
    }
  }
  return { staleWorkIds: stale, orphanWorkIds: orphan };
}

/**
 * Boot-time reconcile. Reads the index, compares against the current
 * works state (supplied as a `workId → workHash` map by the caller —
 * the cache module stays independent of the works store), and
 * invalidates stale + orphan entries. Returns a summary for the
 * caller to fold into an `enrichment.reconcile` telemetry event.
 *
 * The caller is responsible for supplying the current-hash map; a
 * missing workId means "orphan" by construction. This keeps the
 * cache module a leaf — the works store never imports from here.
 */
export async function reconcileEnrichmentCache(
  currentWorkHashes: ReadonlyMap<string, string>,
): Promise<EnrichmentReconcileSummary> {
  const index = await readIndex();
  const plan = planReconcile(index, currentWorkHashes);

  for (const id of plan.staleWorkIds) {
    await invalidateEnrichmentCache(id, "workHashChanged");
  }
  for (const id of plan.orphanWorkIds) {
    await invalidateEnrichmentCache(id, "workHashChanged");
  }

  const summary: EnrichmentReconcileSummary = {
    staleCacheEntries: plan.staleWorkIds.length,
    orphanCacheEntries: plan.orphanWorkIds.length,
    invalidated: plan.staleWorkIds.length + plan.orphanWorkIds.length,
  };
  reconcileEvent(summary);
  return summary;
}
