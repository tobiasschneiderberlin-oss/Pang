/**
 * PANG — Narrative monthly idempotency marker store (iter #14).
 *
 * Filesystem-backed server stand-in (primitive 52) for the one-per-
 * (collector, YYYY-MM) marker the Narrative Agent commits against.
 * The Supabase mirror lands with the platform iteration; the row
 * shape JSON here is literally the production row shape (primitive 52
 * rule).
 *
 * Layout:
 *
 *     .pang/server-monthly-narrative/
 *       <collectorId>/
 *         2026-04.json
 *         2026-03.json
 *
 * Primitive 51 (idempotency markers commit before the side effect):
 * the route handler writes a `kind: "skipped"` or `kind: "paragraph"`
 * marker **before** the overlay can be observed. If the marker write
 * crashes, no paragraph is cached and the next tick retries. If the
 * marker commits but the cache flush fails, the next tick reads the
 * marker and returns the cached paragraph — the failure mode is
 * "same reading, different session" instead of "the same month, two
 * readings".
 *
 * The store exposes three operations:
 *
 *   getCurrentMonth(collectorId, now)   — read the marker for this
 *                                         calendar month. Returns
 *                                         `null` if no marker.
 *   hasCurrentMonth(collectorId, now)   — cheap existence check.
 *   putCurrentMonth(collectorId, marker, now) — atomic tmp+rename
 *                                                write.
 *   getPriorMonthHash(collectorId, now) — the most-recent *previous*
 *                                          month's collectionHash, for
 *                                          change-detection.
 *
 * Every path composition goes through `resolveMarkerPath` — caller
 * ids are sanitised to a filename-safe shape so a carefully-crafted
 * id cannot escape the store root.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { monthOf } from "./input";
import {
  NarrativeMarkerSchema,
  type NarrativeMarker,
} from "./schema";

/** Store root. Overridable by env for tests. */
export function storeRoot(): string {
  return (
    process.env["PANG_NARRATIVE_STORE_DIR"] ??
    path.resolve(process.cwd(), ".pang", "server-monthly-narrative")
  );
}

/**
 * Reject ids with path separators, nulls, or outside a conservative
 * charset. Callers pass real collector ids (uuid-ish); this is a
 * belt-and-braces to ensure nothing traverses out of the directory.
 */
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export class NarrativeStoreError extends Error {
  constructor(
    public readonly kind: "bad-id" | "bad-month" | "parse",
    message: string,
  ) {
    super(message);
    this.name = "NarrativeStoreError";
  }
}

function assertSafeId(collectorId: string): void {
  if (!SAFE_ID.test(collectorId)) {
    throw new NarrativeStoreError(
      "bad-id",
      `unsafe collectorId: ${collectorId}`,
    );
  }
}

/**
 * Resolve the marker file path for (collectorId, YYYY-MM). Callers
 * should not construct this by hand; calling through this helper is
 * the only supported path shape.
 */
export function resolveMarkerPath(
  collectorId: string,
  month: string,
): string {
  assertSafeId(collectorId);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new NarrativeStoreError("bad-month", `bad month: ${month}`);
  }
  return path.join(storeRoot(), collectorId, `${month}.json`);
}

async function readMarker(filepath: string): Promise<NarrativeMarker | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filepath, "utf8");
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new NarrativeStoreError(
      "parse",
      `bad json at ${filepath}: ${(err as Error).message}`,
    );
  }
  return NarrativeMarkerSchema.parse(json);
}

async function writeMarker(
  filepath: string,
  marker: NarrativeMarker,
): Promise<void> {
  const dir = path.dirname(filepath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filepath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(marker, null, 2), "utf8");
  await fs.rename(tmp, filepath);
}

// ---------- Public API -------------------------------------------

/**
 * Read the current-month marker for a collector. Returns `null` if
 * the month has not been decided yet.
 *
 * Primitive 51 fallout: when this returns a non-null marker, the
 * month is closed — a paragraph OR a skip. The route does not call
 * the agent again.
 */
export async function getCurrentMonth(
  collectorId: string,
  now: Date,
): Promise<NarrativeMarker | null> {
  const p = resolveMarkerPath(collectorId, monthOf(now));
  return readMarker(p);
}

/** Cheap existence check for the current month's marker. */
export async function hasCurrentMonth(
  collectorId: string,
  now: Date,
): Promise<boolean> {
  return (await getCurrentMonth(collectorId, now)) !== null;
}

/**
 * Commit the marker for the current month. Idempotent: a second call
 * with the same (collector, month) overwrites the prior marker, so
 * the route should have already checked `hasCurrentMonth` and
 * short-circuited. This helper does NOT enforce the "at most one per
 * month" rule — the route is the policy boundary; this store is the
 * persistence mechanism.
 */
export async function putCurrentMonth(
  collectorId: string,
  marker: NarrativeMarker,
  now: Date,
): Promise<void> {
  const expectedMonth = monthOf(now);
  if (marker.month !== expectedMonth) {
    throw new NarrativeStoreError(
      "bad-month",
      `marker.month (${marker.month}) does not match now (${expectedMonth})`,
    );
  }
  if (marker.collectorId !== collectorId) {
    throw new NarrativeStoreError(
      "bad-id",
      `marker.collectorId (${marker.collectorId}) does not match argument (${collectorId})`,
    );
  }
  const p = resolveMarkerPath(collectorId, expectedMonth);
  await writeMarker(p, marker);
}

/**
 * Return the `collectionHash` of the most recent prior month's
 * marker, or `null` if no prior marker is on disk. The route's
 * "unchanged-collection" gate uses this to decide whether to skip
 * the round-trip for a collection whose shape has not moved since
 * last month.
 *
 * Implementation: list the collector's dir, filter to YYYY-MM.json
 * less than the current month, read the highest match.
 */
export async function getPriorMonthHash(
  collectorId: string,
  now: Date,
): Promise<string | null> {
  assertSafeId(collectorId);
  const dir = path.join(storeRoot(), collectorId);
  let entries: readonly string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
  const current = monthOf(now);
  const months = entries
    .filter((name) => /^\d{4}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, -5))
    .filter((m) => m < current)
    .sort((a, b) => b.localeCompare(a));
  const latest = months[0];
  if (latest === undefined) return null;
  const marker = await readMarker(path.join(dir, `${latest}.json`));
  return marker?.collectionHash ?? null;
}

/**
 * Clear markers for a given collector. Test-only helper (exported
 * for the store tests + Playwright advance-month helper). Not used
 * in production paths.
 */
export async function clearCollector(collectorId: string): Promise<void> {
  assertSafeId(collectorId);
  const dir = path.join(storeRoot(), collectorId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return;
    }
    throw err;
  }
}
