/**
 * PANG — verification store persistence (OPFS).
 *
 * The verification store is in-memory; without this mirror, a
 * refresh mid-lifecycle would blank the `"requested"` chip even
 * though the outbox holds the durable request. The pattern copies
 * `works.persist.ts`: one sidecar file on OPFS, one-way-data from
 * the store (subscribe-and-write), hydration on boot.
 *
 *   /verification/index.json
 *
 * The outbox directory lives alongside at `/verification/outbox/` —
 * managed by `src/verification/outbox.ts`. This module does not
 * read or write outbox records; it only mirrors store state.
 *
 * Why two stores of truth: the outbox holds what *hasn't* been sent
 * to the server yet; the verification store holds what the server
 * has acked (plus optimistic in-flight state). After ack, the
 * outbox entry is removed — the verification store is the only
 * record. After terminal failure, the outbox entry is still there
 * (so a reconcile can re-submit if the user taps again); the store
 * records `"failed"`.
 *
 * Reconcile reads both (on boot) and aligns them. See
 * `src/verification/reconcile.ts` (Phase F).
 */

import { opfsRead, opfsWrite } from "@/lib/storage/bootstrap";
import {
  useVerification,
  type PushDecision,
  type VerificationState,
} from "@/stores/verification";

const INDEX_PATH = "verification/index.json";

// ---------- Durable shape ----------------------------------------

interface PersistedIndex {
  readonly version: "v1";
  readonly entries: Readonly<Record<string, VerificationState>>;
  /**
   * Per-work push-subscription decision. Optional so a legacy index
   * written before Phase D rehydrates without synthetic entries.
   */
  readonly push?: Readonly<Record<string, PushDecision>>;
}

export function serialiseIndex(
  byWorkId: Readonly<Record<string, VerificationState>>,
  pushByWorkId: Readonly<Record<string, PushDecision>> = {},
): string {
  const payload: PersistedIndex = {
    version: "v1",
    entries: byWorkId,
    push: pushByWorkId,
  };
  return JSON.stringify(payload);
}

/**
 * Parse a serialised index. Returns an empty pair on any shape
 * mismatch. The per-entry validator is structural — each
 * `VerificationState` variant is checked by its `kind` + required
 * companion fields. The outbox re-parses the corresponding
 * `VerificationRequest`, so a corrupt store entry cannot spawn a
 * malformed retry.
 *
 * Returns both halves of the persisted slice — verification state
 * and push decisions — so one call round-trips the full store.
 */
export interface ParsedIndex {
  readonly entries: Readonly<Record<string, VerificationState>>;
  readonly push: Readonly<Record<string, PushDecision>>;
}

const EMPTY_PARSED: ParsedIndex = { entries: {}, push: {} };

export function parseIndex(text: string): ParsedIndex {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_PARSED;
  }
  if (!raw || typeof raw !== "object") return EMPTY_PARSED;
  const r = raw as Record<string, unknown>;
  if (r["version"] !== "v1") return EMPTY_PARSED;
  const entries = r["entries"];
  if (!entries || typeof entries !== "object") return EMPTY_PARSED;
  const outEntries: Record<string, VerificationState> = {};
  for (const [workId, value] of Object.entries(entries)) {
    const parsed = parseState(value);
    if (parsed) outEntries[workId] = parsed;
  }
  const pushRaw = r["push"];
  const outPush: Record<string, PushDecision> = {};
  if (pushRaw && typeof pushRaw === "object") {
    for (const [workId, value] of Object.entries(pushRaw)) {
      const parsed = parsePushDecision(value);
      if (parsed) outPush[workId] = parsed;
    }
  }
  return { entries: outEntries, push: outPush };
}

function parseState(raw: unknown): VerificationState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r["kind"];
  switch (kind) {
    case "none":
      return { kind: "none" };
    case "requesting":
    case "requested":
      if (!isString(r["requestId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      return {
        kind,
        requestId: r["requestId"] as string,
        submittedAt: r["submittedAt"] as string,
      };
    case "dispatched": {
      if (!isString(r["requestId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isString(r["dispatchedAt"])) return null;
      const channel = r["channel"];
      if (channel !== "email" && channel !== "whatsapp") return null;
      return {
        kind: "dispatched",
        requestId: r["requestId"] as string,
        submittedAt: r["submittedAt"] as string,
        dispatchedAt: r["dispatchedAt"] as string,
        channel,
      };
    }
    case "confirmed":
    case "declined": {
      if (!isString(r["requestId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isString(r["decidedAt"])) return null;
      // Iteration #11 — `outcomeChapterShownAt` is optional on the
      // wire (a legacy v1 index written before iter #11 has no such
      // field; it parses as `null`, which replays the chapter on
      // next Room entry — the correct migration posture). Present
      // values are validated as ISO-ish strings; any non-null
      // non-string is rejected rather than coerced.
      const shownAtRaw = r["outcomeChapterShownAt"];
      let outcomeChapterShownAt: string | null;
      if (shownAtRaw === undefined || shownAtRaw === null) {
        outcomeChapterShownAt = null;
      } else if (typeof shownAtRaw === "string" && shownAtRaw.length > 0) {
        outcomeChapterShownAt = shownAtRaw;
      } else {
        return null;
      }
      return {
        kind,
        requestId: r["requestId"] as string,
        submittedAt: r["submittedAt"] as string,
        decidedAt: r["decidedAt"] as string,
        outcomeChapterShownAt,
      };
    }
    case "expired":
      if (!isString(r["requestId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isString(r["decidedAt"])) return null;
      return {
        kind,
        requestId: r["requestId"] as string,
        submittedAt: r["submittedAt"] as string,
        decidedAt: r["decidedAt"] as string,
      };
    case "failed":
      if (!isString(r["requestId"])) return null;
      if (!isString(r["submittedAt"])) return null;
      if (!isString(r["reason"])) return null;
      return {
        kind,
        requestId: r["requestId"] as string,
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

function parsePushDecision(raw: unknown): PushDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r["kind"]) {
    case "unoffered":
      return { kind: "unoffered" };
    case "granted":
      if (!isString(r["storedAt"])) return null;
      return { kind: "granted", storedAt: r["storedAt"] as string };
    case "refused":
      if (!isString(r["at"])) return null;
      return { kind: "refused", at: r["at"] as string };
    case "unsupported":
      if (!isString(r["reason"])) return null;
      return { kind: "unsupported", reason: r["reason"] as string };
    default:
      return null;
  }
}

// ---------- Read / write -----------------------------------------

async function writeIndex(
  byWorkId: Readonly<Record<string, VerificationState>>,
  pushByWorkId: Readonly<Record<string, PushDecision>>,
): Promise<void> {
  try {
    await opfsWrite(INDEX_PATH, serialiseIndex(byWorkId, pushByWorkId));
  } catch {
    // Non-fatal.
  }
}

export async function hydrateVerification(): Promise<ParsedIndex> {
  if (typeof navigator === "undefined") return EMPTY_PARSED;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return EMPTY_PARSED;
  }

  const file = await opfsRead(INDEX_PATH);
  if (!file) return EMPTY_PARSED;
  const text = await file.text();
  return parseIndex(text);
}

/**
 * Subscribe to the verification store and mirror `byWorkId` +
 * `pushByWorkId` to OPFS. Returns an unsubscribe. Called once on
 * AppBoot.
 */
export function installVerificationPersistence(): () => void {
  if (typeof navigator === "undefined") return () => {};
  if (!navigator.storage || !("getDirectory" in navigator.storage)) {
    return () => {};
  }

  // Prime the file on install so a reader always sees a valid
  // index even if the store is empty.
  const initial = useVerification.getState();
  void writeIndex(initial.byWorkId, initial.pushByWorkId);

  // Two subscriptions, one sink. Either slice changing re-reads the
  // latest state for the *other* slice so we never overwrite one
  // with stale bytes. The writes are cheap (one JSON.stringify, one
  // OPFS append) and the two slices change at different cadences.
  const unsubState = useVerification.subscribe(
    (s) => s.byWorkId,
    (byWorkId) => {
      void writeIndex(byWorkId, useVerification.getState().pushByWorkId);
    },
  );
  const unsubPush = useVerification.subscribe(
    (s) => s.pushByWorkId,
    (pushByWorkId) => {
      void writeIndex(useVerification.getState().byWorkId, pushByWorkId);
    },
  );

  return () => {
    unsubState();
    unsubPush();
  };
}
