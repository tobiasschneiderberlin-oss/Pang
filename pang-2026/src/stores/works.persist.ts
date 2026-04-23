/**
 * PANG — works store persistence (OPFS).
 *
 * The Zustand works store is in-memory; without this module a
 * refresh blanks the wall. Real-world PANG use — the collector
 * opens the invite link, scans, then comes back three days later —
 * assumes the collection survives restarts. This module is the
 * load-bearing bit of that assumption.
 *
 * Two files per boot:
 *
 *   /works/index.json   — the durable entry list (id, status,
 *                         size). The `imageUrl` is re-minted on
 *                         hydration because `blob:` URLs don't
 *                         survive a page load, so we don't persist
 *                         it.
 *   /works/<id>.png     — the rectified capture bytes for each
 *                         entry. On hydration, each is read back
 *                         and wrapped in a fresh `URL.createObjectURL`
 *                         call; the resulting URL is assigned to
 *                         `CollectionEntry.imageUrl`.
 *
 * The persistence flow is one-way-data: the store is the source of
 * truth, this module is a mirror. `installWorksPersistence()`
 * subscribes to the store and writes deltas; callers never write to
 * OPFS directly. Hydration is the single entry point for pulling
 * state back.
 *
 * Why OPFS (P5, A16) and not IndexedDB: the bytes are binary
 * blobs that never need query semantics. OPFS is the right spine
 * for that and already set up by `bootstrapOpfs()`. IndexedDB is
 * reserved for structured records with indices (provenance, later).
 *
 * Failure policy: every OPFS operation catches its own errors so a
 * persistence failure never blocks a user action. A missing image
 * file on hydration means the entry is skipped — better to show
 * the rest of the wall than to show nothing.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  useWorks,
  type CollectionEntry,
  type DocumentMime,
  type DocumentRecord,
  type VerificationHint,
} from "@/stores/works";
import { ArtworkSnapshotSchema } from "@/verification/schema";

const INDEX_PATH = "works/index.json";

/** File path for a work's persisted bytes. */
function imagePath(id: string): string {
  return `works/${id}.png`;
}

/**
 * The durable shape. `imageUrl` is intentionally omitted — the
 * hydration path re-creates it from the persisted bytes. Writing a
 * `blob:` URL would be worse than nothing (the URL is always dead on
 * the next page load, and an optimistic reader might use it before
 * checking OPFS).
 */
interface PersistedEntry {
  readonly id: string;
  readonly status: CollectionEntry["status"];
  readonly size: readonly [number, number];
  readonly verificationHint?: VerificationHint;
  readonly documents?: readonly DocumentRecord[];
}

/** Project an in-memory entry to its durable shape. Pure; testable. */
export function projectDurable(entry: CollectionEntry): PersistedEntry {
  const base: PersistedEntry = {
    id: entry.id,
    status: entry.status,
    size: [entry.size[0], entry.size[1]] as const,
  };
  // `exactOptionalPropertyTypes`: only attach the key when we have a
  // real hint — a `verificationHint: undefined` field would differ
  // structurally and trip the strict type checker.
  const withHint = entry.verificationHint
    ? { ...base, verificationHint: entry.verificationHint }
    : base;
  return entry.documents && entry.documents.length > 0
    ? { ...withHint, documents: entry.documents }
    : withHint;
}

/** Inverse projection — pure; validates shape and drops unknown fields. */
export function parseDurable(raw: unknown): PersistedEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r["id"];
  const status = r["status"];
  const size = r["size"];
  if (typeof id !== "string" || id.length === 0) return null;
  if (status !== "verified" && status !== "unverified") return null;
  if (!Array.isArray(size) || size.length !== 2) return null;
  const w = size[0];
  const h = size[1];
  if (typeof w !== "number" || typeof h !== "number") return null;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w <= 0 || h <= 0) return null;
  const base: PersistedEntry = { id, status, size: [w, h] as const };

  // Verification hint is optional — legacy entries from iteration #3
  // have no hint and continue to hydrate without one. The submit
  // affordance is disabled for those entries.
  const hintRaw = r["verificationHint"];
  const withHint =
    hintRaw !== undefined
      ? (() => {
          const hint = parseVerificationHint(hintRaw);
          return hint ? { ...base, verificationHint: hint } : base;
        })()
      : base;

  // Documents are optional and additive — entries persisted before
  // iteration #6 simply have none. A malformed `documents` field
  // drops silently so the rest of the entry still hydrates.
  const docsRaw = r["documents"];
  if (docsRaw === undefined) return withHint;
  const docs = parseDocuments(docsRaw);
  if (docs.length === 0) return withHint;
  return { ...withHint, documents: docs };
}

function parseDocuments(raw: unknown): DocumentRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentRecord[] = [];
  for (const item of raw) {
    const parsed = parseDocument(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseDocument(raw: unknown): DocumentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r["type"];
  const fileRef = r["fileRef"];
  const mime = r["mime"];
  const extractedFields = r["extractedFields"];
  if (type !== "coa" && type !== "invoice" && type !== "condition_report") {
    return null;
  }
  if (typeof fileRef !== "string" || fileRef.length === 0) return null;
  if (
    mime !== "application/pdf" &&
    mime !== "image/png" &&
    mime !== "image/jpeg"
  ) {
    return null;
  }
  const fields = parseExtractedFields(extractedFields);
  return {
    type,
    fileRef,
    mime: mime as DocumentMime,
    extractedFields: fields,
  };
}

function parseExtractedFields(raw: unknown): Readonly<Record<string, string>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.length > 0 && v.length <= 240) {
      out[k] = v;
    }
  }
  return out;
}

function parseVerificationHint(raw: unknown): VerificationHint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const galleryIdHint = r["galleryIdHint"];
  const galleryNameHint = r["galleryNameHint"];
  const galleryFreeText = r["galleryFreeText"];
  const detectedFrom = r["detectedFrom"];
  const artworkSnapshotRaw = r["artworkSnapshot"];
  const photoRef = r["photoRef"];
  const capturedAt = r["capturedAt"];

  if (!isNullableString(galleryIdHint)) return null;
  if (!isNullableString(galleryNameHint)) return null;
  if (!isNullableString(galleryFreeText)) return null;
  if (
    detectedFrom !== null &&
    detectedFrom !== "email" &&
    detectedFrom !== "certificate" &&
    detectedFrom !== "visual" &&
    detectedFrom !== "manual"
  ) {
    return null;
  }
  if (typeof photoRef !== "string" || photoRef.length === 0) return null;
  if (typeof capturedAt !== "string" || capturedAt.length === 0) return null;

  const snapshotParse = ArtworkSnapshotSchema.safeParse(artworkSnapshotRaw);
  if (!snapshotParse.success) return null;

  return {
    galleryIdHint,
    galleryNameHint,
    galleryFreeText,
    detectedFrom,
    artworkSnapshot: snapshotParse.data,
    photoRef,
    capturedAt,
  };
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

/** Serialise the durable index. Pure; testable. */
export function serialiseIndex(entries: readonly CollectionEntry[]): string {
  return JSON.stringify(entries.map(projectDurable));
}

/** Parse a serialised index. Returns `[]` on any shape mismatch. */
export function parseIndex(text: string): PersistedEntry[] {
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw)) return [];
    const out: PersistedEntry[] = [];
    for (const r of raw) {
      const parsed = parseDurable(r);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Write the index sidecar. Best-effort: a thrown OPFS error is
 * swallowed so that a render never gets blocked by a storage issue
 * — the user sees their work on the wall either way, and the next
 * write gets a fresh shot.
 */
async function writeIndex(
  entries: readonly CollectionEntry[],
): Promise<void> {
  try {
    await opfsWrite(INDEX_PATH, serialiseIndex(entries));
  } catch {
    // Non-fatal. Iteration #5 surfaces this into observability.
  }
}

/**
 * Write an entry's image bytes. Reads from the `blob:` URL the
 * store carries at write time. Already-persisted ids short-circuit
 * via an existence check so the subscription doesn't re-write the
 * same bytes on every focus change.
 */
async function writeImageIfMissing(entry: CollectionEntry): Promise<void> {
  try {
    const existing = await opfsRead(imagePath(entry.id));
    if (existing) return;
    const response = await fetch(entry.imageUrl);
    if (!response.ok) return;
    const buf = await response.arrayBuffer();
    await opfsWrite(imagePath(entry.id), new Uint8Array(buf));
  } catch {
    // Non-fatal.
  }
}

/**
 * Remove an entry's image bytes. Called when an id leaves the
 * store (removeEntry). Missing files are fine.
 */
async function removeImage(id: string): Promise<void> {
  try {
    if (typeof navigator === "undefined") return;
    if (!navigator.storage || !("getDirectory" in navigator.storage)) return;
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("works", { create: true });
    await dir.removeEntry(`${id}.png`).catch(() => {});
  } catch {
    // Non-fatal.
  }
}

/**
 * Load the index + image bytes from OPFS and rebuild the in-memory
 * entry list. Each entry gets a fresh `blob:` URL minted from its
 * persisted bytes. Entries whose image file is missing are skipped
 * (defensive — a partial write, or OPFS eviction, should not take
 * the whole wall with it).
 *
 * Returned entries are ready to drop into the store via `addEntry`.
 * The caller is responsible for doing so; this module does not
 * mutate the store on its own.
 */
export async function hydrateWorks(): Promise<CollectionEntry[]> {
  if (typeof navigator === "undefined") return [];
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return [];

  const indexFile = await opfsRead(INDEX_PATH);
  if (!indexFile) return [];

  const text = await indexFile.text();
  const persisted = parseIndex(text);
  if (persisted.length === 0) return [];

  const out: CollectionEntry[] = [];
  for (const p of persisted) {
    const img = await opfsRead(imagePath(p.id));
    if (!img) continue; // skip orphans
    const blobUrl = URL.createObjectURL(img);
    const base = {
      id: p.id,
      imageUrl: blobUrl,
      status: p.status,
      size: p.size,
    } as const;
    const withHint = p.verificationHint
      ? { ...base, verificationHint: p.verificationHint }
      : base;
    out.push(
      p.documents && p.documents.length > 0
        ? { ...withHint, documents: p.documents }
        : withHint,
    );
  }
  return out;
}

/**
 * Subscribe to the store. On each `entries` change:
 *   - Write the index sidecar.
 *   - For every id that newly appeared, persist its image bytes.
 *   - For every id that disappeared, delete its image bytes.
 *
 * Returns an unsubscribe function. The caller (typically `AppBoot`)
 * keeps it alive for the session and drops it on unmount.
 *
 * Idempotent with respect to repeated mounts: each subscription
 * writes its own deltas; the index gets overwritten with the
 * latest snapshot each time, so concurrent subscribers converge.
 */
export function installWorksPersistence(): () => void {
  if (typeof navigator === "undefined") return () => {};
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return () => {};
  }

  let lastIds = new Set<string>(
    useWorks.getState().entries.map((e) => e.id),
  );

  // Prime OPFS with the current snapshot on install — covers the
  // case where entries were added before this subscription was
  // attached (e.g. hydration pre-seeding, test fixtures).
  void writeIndex(useWorks.getState().entries);
  for (const entry of useWorks.getState().entries) {
    void writeImageIfMissing(entry);
  }

  const unsubscribe = useWorks.subscribe(
    (state) => state.entries,
    (entries) => {
      const nextIds = new Set(entries.map((e) => e.id));

      // Added ids: persist their bytes.
      for (const entry of entries) {
        if (!lastIds.has(entry.id)) {
          void writeImageIfMissing(entry);
        }
      }
      // Removed ids: delete their bytes.
      for (const id of lastIds) {
        if (!nextIds.has(id)) {
          void removeImage(id);
        }
      }
      lastIds = nextIds;

      // Always refresh the index — small, cheap, keeps the sidecar
      // in lockstep with the store.
      void writeIndex(entries);
    },
  );

  return unsubscribe;
}
