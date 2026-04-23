/**
 * PANG — OPFS-backed verification outbox.
 *
 * The outbox is where a `VerificationRequest` lives between the
 * collector's tap and the server's 2xx acknowledgement. It survives
 * refresh, survives offline, survives a tab-kill. The store's
 * optimistic `"requested"` flip is a mirror of the outbox state, not
 * an alternate truth — the outbox is the durable record; the store
 * is the render cache.
 *
 * Layout (under OPFS root, so P5 is literal):
 *
 *   verification/outbox/<requestId>.json
 *
 * Each file holds:
 *
 *   {
 *     "request": <VerificationRequest>,
 *     "attempt": <int>,            // 0 on enqueue; incremented on each
 *                                  // failed send
 *     "nextAttemptAt": <iso>,      // when the replay should re-try
 *     "lastErrorReason"?: <string> // optional diagnostic
 *   }
 *
 * Why one file per request (not a single index): an index forces a
 * read-modify-write on every enqueue and drain step, which races
 * badly under a concurrent drain + enqueue. One-file-per-request is
 * atomic at the OPFS layer — the request is either there or it's
 * not — and the drain walks the directory.
 *
 * The module emits `verification.outbox.*` events on every edge. A
 * regression where the outbox fills without draining is visible in
 * telemetry as repeated `enqueue` without matching `drain.complete`.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  VerificationRequestSchema,
  type VerificationRequest,
} from "./schema";
import { outboxEnqueueEvent } from "./otel";

const OUTBOX_DIR = "verification/outbox";

function outboxPath(requestId: string): string {
  return `${OUTBOX_DIR}/${requestId}.json`;
}

// ---------- Record shape -----------------------------------------

/**
 * The on-disk shape. Not a Zod schema because it's all internal —
 * anything that survives `parseOutboxRecord()` is trusted client
 * data (not `Untrusted<T>`). The enclosing `request` field *is*
 * schema-validated on every read so a corrupt file fails loudly.
 */
export interface OutboxRecord {
  readonly request: VerificationRequest;
  /** Zero on enqueue. Incremented on each failed send. */
  readonly attempt: number;
  /** ISO timestamp of the next attempt. On enqueue: now. */
  readonly nextAttemptAt: string;
  readonly lastErrorReason?: string;
}

export function serialiseOutboxRecord(r: OutboxRecord): string {
  return JSON.stringify(r);
}

export function parseOutboxRecord(text: string): OutboxRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parsedRequest = VerificationRequestSchema.safeParse(r["request"]);
  if (!parsedRequest.success) return null;
  const attempt = r["attempt"];
  const nextAttemptAt = r["nextAttemptAt"];
  const lastErrorReason = r["lastErrorReason"];
  if (typeof attempt !== "number" || !Number.isInteger(attempt) || attempt < 0) {
    return null;
  }
  if (typeof nextAttemptAt !== "string" || nextAttemptAt.length === 0) {
    return null;
  }
  if (lastErrorReason !== undefined && typeof lastErrorReason !== "string") {
    return null;
  }
  const record: OutboxRecord =
    typeof lastErrorReason === "string"
      ? {
          request: parsedRequest.data,
          attempt,
          nextAttemptAt,
          lastErrorReason,
        }
      : {
          request: parsedRequest.data,
          attempt,
          nextAttemptAt,
        };
  return record;
}

// ---------- Enqueue / read / update / remove --------------------

/**
 * Persist a fresh request to the outbox. Returns the durable record
 * — the caller (store) can mirror `attempt: 0` into its state.
 *
 * Fails loudly if OPFS is unavailable — the caller is expected to
 * catch and flip the store to `"failed"` so the surface re-offers
 * the ask. A silent failure would desync store and outbox; the
 * reconcile path would eventually catch it, but the surface would
 * look stuck.
 */
export async function enqueueVerificationRequest(
  request: VerificationRequest,
): Promise<OutboxRecord> {
  const record: OutboxRecord = {
    request,
    attempt: 0,
    nextAttemptAt: request.submittedAt,
  };
  await opfsWrite(outboxPath(request.requestId), serialiseOutboxRecord(record));
  outboxEnqueueEvent(request.requestId, request.workId);
  return record;
}

export async function readOutboxRecord(
  requestId: string,
): Promise<OutboxRecord | null> {
  const file = await opfsRead(outboxPath(requestId));
  if (!file) return null;
  const text = await file.text();
  return parseOutboxRecord(text);
}

export async function updateOutboxRecord(
  updated: OutboxRecord,
): Promise<void> {
  await opfsWrite(
    outboxPath(updated.request.requestId),
    serialiseOutboxRecord(updated),
  );
}

export async function removeOutboxRecord(requestId: string): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("verification", {
      create: true,
    });
    const outbox = await dir.getDirectoryHandle("outbox", { create: true });
    await outbox.removeEntry(`${requestId}.json`).catch(() => {});
  } catch {
    // Non-fatal.
  }
}

/**
 * Walk the outbox directory and return every record, sorted by
 * `nextAttemptAt` ascending. The drain path reads this list FIFO-ish
 * by attempt time — oldest first.
 */
export async function listOutboxRecords(): Promise<OutboxRecord[]> {
  if (typeof navigator === "undefined") return [];
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return [];
  const out: OutboxRecord[] = [];
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root
      .getDirectoryHandle("verification", { create: true })
      .catch(() => null);
    if (!dir) return [];
    const outbox = await dir
      .getDirectoryHandle("outbox", { create: true })
      .catch(() => null);
    if (!outbox) return [];

    const asIterable = outbox as FileSystemDirectoryHandle & {
      entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    };
    if (typeof asIterable.entries !== "function") return [];

    for await (const [name, handle] of asIterable.entries()) {
      if (!name.endsWith(".json")) continue;
      if (handle.kind !== "file") continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      const text = await file.text();
      const parsed = parseOutboxRecord(text);
      if (parsed) out.push(parsed);
    }
  } catch {
    // Non-fatal — the drain path tolerates an empty list.
  }
  out.sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt));
  return out;
}
