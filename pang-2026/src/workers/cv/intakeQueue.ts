/**
 * PANG — intake upload queue.
 *
 * TUS-style resumable queue (A16). Each job lives as a pair of OPFS
 * files:
 *   /intake/staged/<id>.png   — the rectified artwork bytes
 *   /intake/staged/<id>.json  — a sidecar with metadata + status
 *
 * A job moves through states:
 *
 *   pending  → the client has captured it, not yet POSTed
 *   uploading → active fetch; resumes on failure
 *   done     → agent returned OK; client has the output
 *   failed   → terminal; compensation UI shows
 *
 * The queue is read-only from the server's perspective — it is a
 * client-side construct. The route handler treats each POST as
 * independent and does not know about the queue.
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import type { IntakeOutput, IntakeRequestMetadata } from "@/ai/tools/artwork";

export type IntakeJobStatus =
  | { kind: "pending" }
  | { kind: "uploading"; attempt: number; lastAttemptAt: string }
  | { kind: "done"; output: IntakeOutput }
  | { kind: "failed"; error: string; compensate: boolean };

export interface IntakeJob {
  readonly id: string;
  readonly createdAt: string;
  readonly metadata: IntakeRequestMetadata;
  status: IntakeJobStatus;
}

const STAGED_DIR = "intake/staged";

function jsonPath(id: string): string {
  return `${STAGED_DIR}/${id}.json`;
}
function imagePath(id: string): string {
  return `${STAGED_DIR}/${id}.png`;
}

/**
 * Enqueue a job. Writes the PNG bytes + sidecar to OPFS atomically
 * (PNG first, sidecar second; the uploader ignores any job without a
 * sidecar, so a half-write is self-healing — re-capture is required,
 * but no corrupt upload ever hits the server).
 */
export async function enqueueIntakeJob(
  bytes: Uint8Array,
  metadata: IntakeRequestMetadata,
): Promise<IntakeJob> {
  const id = newId();
  const job: IntakeJob = {
    id,
    createdAt: new Date().toISOString(),
    metadata,
    status: { kind: "pending" },
  };
  await opfsWrite(imagePath(id), bytes);
  await opfsWrite(jsonPath(id), JSON.stringify(job));
  return job;
}

export async function loadIntakeJob(id: string): Promise<IntakeJob | null> {
  const file = await opfsRead(jsonPath(id));
  if (!file) return null;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as IntakeJob;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeIntakeJobStatus(
  job: IntakeJob,
  next: IntakeJobStatus,
): Promise<IntakeJob> {
  const updated: IntakeJob = { ...job, status: next };
  await opfsWrite(jsonPath(job.id), JSON.stringify(updated));
  return updated;
}

/**
 * Attempt to run a job through `/api/intake`. Handles the resumable
 * semantics: on network error, the status is written as `uploading`
 * with an incremented attempt counter; the bytes stay put and the
 * next call replays the same `/api/intake` POST.
 *
 * Retryable: 5xx and fetch-level errors.
 * Terminal: 4xx (means the client shape was wrong; the capture is
 * unusable) → `failed` with `compensate: true`.
 */
export async function runIntakeJob(
  job: IntakeJob,
): Promise<IntakeJob> {
  const next = await writeIntakeJobStatus(job, {
    kind: "uploading",
    attempt:
      job.status.kind === "uploading" ? job.status.attempt + 1 : 1,
    lastAttemptAt: new Date().toISOString(),
  });

  const imageFile = await opfsRead(imagePath(job.id));
  if (!imageFile) {
    return writeIntakeJobStatus(next, {
      kind: "failed",
      error: "image_missing",
      compensate: true,
    });
  }

  const form = new FormData();
  form.set("metadata", JSON.stringify(next.metadata));
  form.set("image", imageFile, `${job.id}.png`);

  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    if (response.ok) {
      const { output } = (await response.json()) as {
        output: IntakeOutput;
      };
      return writeIntakeJobStatus(next, { kind: "done", output });
    }
    if (response.status >= 400 && response.status < 500) {
      return writeIntakeJobStatus(next, {
        kind: "failed",
        error: `http_${response.status}`,
        compensate: true,
      });
    }
    // 5xx → leave as uploading; caller retries with backoff.
    return next;
  } catch {
    // Network-level error → retryable. Caller backs off.
    return next;
  }
}

function newId(): string {
  // ULID-shaped; good enough for filenames without pulling a lib.
  const now = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(36))
    .join("")
    .slice(0, 12);
  return `${now}-${rand}`;
}
