/**
 * PANG — enrichment store persistence (OPFS).
 *
 * The enrichment store is in-memory; without this mirror a refresh
 * mid-lifecycle would blank the `"enriching"` indicator even though
 * the server has the submission on record. Same pattern as
 * `verification.persist.ts`: one sidecar file, one-way-data from the
 * store, hydration on boot.
 *
 *   /enrichment/status.json
 *
 * The cache directory lives alongside at `/enrichment/<workId>.json`
 * (managed by `@/enrichment/cache.ts`). This module does not read or
 * write cache payloads; it only mirrors the *status* slice. The two
 * are independent by design:
 *
 *   - Cache payload missing + store says "ready" → treat as cache
 *     miss; re-dispatch from the status edge.
 *   - Cache payload present + store says "none" → treat as orphan;
 *     invalidate on next reconcile.
 *
 * Drift is normal across boots; reconcile aligns on the next pass.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  useEnrichment,
  type EnrichmentState,
} from "@/stores/enrichment";

const INDEX_PATH = "enrichment/status.json";

// ---------- Durable shape ----------------------------------------

interface PersistedIndex {
  readonly version: "v1";
  readonly entries: Readonly<Record<string, EnrichmentState>>;
}

export function serialiseIndex(
  byWorkId: Readonly<Record<string, EnrichmentState>>,
): string {
  const payload: PersistedIndex = {
    version: "v1",
    entries: byWorkId,
  };
  return JSON.stringify(payload);
}

/**
 * Parse a serialised index. Returns `{}` on any shape mismatch.
 * Per-entry validator is structural: each `EnrichmentState` variant
 * checks its `kind` + companion fields.
 */
export function parseIndex(
  text: string,
): Readonly<Record<string, EnrichmentState>> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  if (r["version"] !== "v1") return {};
  const entries = r["entries"];
  if (!entries || typeof entries !== "object") return {};
  const out: Record<string, EnrichmentState> = {};
  for (const [workId, value] of Object.entries(entries)) {
    const parsed = parseState(value);
    if (parsed) out[workId] = parsed;
  }
  return out;
}

function parseState(raw: unknown): EnrichmentState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r["kind"];
  switch (kind) {
    case "none":
      return { kind: "none" };
    case "enriching":
      if (!isString(r["submissionId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      return {
        kind: "enriching",
        submissionId: r["submissionId"] as string,
        submittedAt: r["submittedAt"] as string,
      };
    case "ready":
      if (!isString(r["submissionId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isHash(r["basedOnWorkHash"])) return null;
      if (!isString(r["generatedAt"])) return null;
      return {
        kind: "ready",
        submissionId: r["submissionId"] as string,
        submittedAt: r["submittedAt"] as string,
        basedOnWorkHash: r["basedOnWorkHash"] as string,
        generatedAt: r["generatedAt"] as string,
      };
    case "stale":
      if (!isString(r["submissionId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isHash(r["previousWorkHash"])) return null;
      if (!isString(r["generatedAt"])) return null;
      return {
        kind: "stale",
        submissionId: r["submissionId"] as string,
        submittedAt: r["submittedAt"] as string,
        previousWorkHash: r["previousWorkHash"] as string,
        generatedAt: r["generatedAt"] as string,
      };
    case "failed":
      if (!isString(r["submissionId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isString(r["reason"])) return null;
      return {
        kind: "failed",
        submissionId: r["submissionId"] as string,
        submittedAt: r["submittedAt"] as string,
        reason: r["reason"] as string,
      };
    default:
      return null;
  }
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isHash(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
}

// ---------- Read / write -----------------------------------------

async function writeIndex(
  byWorkId: Readonly<Record<string, EnrichmentState>>,
): Promise<void> {
  try {
    await opfsWrite(INDEX_PATH, serialiseIndex(byWorkId));
  } catch {
    // Non-fatal.
  }
}

export async function hydrateEnrichment(): Promise<
  Readonly<Record<string, EnrichmentState>>
> {
  if (typeof navigator === "undefined") return {};
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return {};
  }
  const file = await opfsRead(INDEX_PATH);
  if (!file) return {};
  const text = await file.text();
  return parseIndex(text);
}

/**
 * Subscribe to the enrichment store and mirror `byWorkId` to OPFS.
 * Returns an unsubscribe. Called once on AppBoot.
 */
export function installEnrichmentPersistence(): () => void {
  if (typeof navigator === "undefined") return () => {};
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return () => {};
  }

  // Prime the sidecar so a reader always sees a valid index.
  const initial = useEnrichment.getState();
  void writeIndex(initial.byWorkId);

  return useEnrichment.subscribe(
    (s) => s.byWorkId,
    (byWorkId) => {
      void writeIndex(byWorkId);
    },
  );
}
