/**
 * PANG — document bytes accessor.
 *
 * Thin wrapper around `opfsRead(fileRef)` that centralises the
 * missing-bytes telemetry. The spine's claim "documents exist as
 * evidence" is load-bearing; a silent null return would let the
 * renderer show a broken state without anyone noticing.
 *
 * The module is a leaf: it imports the storage bootstrap and the
 * telemetry emitter and returns a narrow `{ file, mime } | null`
 * shape the viewer reads directly. No caching: the viewer opens
 * infrequently and the bytes are OPFS-local — the system call
 * overhead is negligible. If that changes, an `LRU` cache here is
 * a single-file edit.
 */

import { opfsRead } from "@/lib/storage/bootstrap";
import { documentsBytesMissEvent } from "./otel";

export interface DocumentBytes {
  /** OPFS-resident file handle, ready to `.arrayBuffer()` or `.stream()`. */
  readonly file: File;
  /** The document's MIME, narrowed to the three PANG supports. */
  readonly mime: "application/pdf" | "image/png" | "image/jpeg";
}

/**
 * Read a document's OPFS bytes by `fileRef`. Returns `null` when the
 * file is missing (eviction, migration loss, or a dangling ref).
 *
 * Emits `documents.bytes.miss` with `workId` + `fileRef` on a miss
 * so the failure-mode's third regression class (missing bytes) is
 * diagnosable from telemetry alone — no need to reproduce the state.
 *
 * The `mime` argument is the MIME the store recorded on the
 * `DocumentRecord`; this function doesn't re-sniff headers. The
 * caller is responsible for passing the store's truth.
 */
export async function readDocumentBytes(
  workId: string,
  fileRef: string,
  mime: DocumentBytes["mime"],
): Promise<DocumentBytes | null> {
  // `opfsRead` already handles the "no OPFS available" branch by
  // returning null; re-guarding here would duplicate the same check
  // without adding information.
  const file = await opfsRead(fileRef);
  if (!file) {
    documentsBytesMissEvent(workId, fileRef);
    return null;
  }
  return { file, mime };
}
