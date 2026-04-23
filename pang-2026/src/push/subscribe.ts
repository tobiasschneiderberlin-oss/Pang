/**
 * PANG — push subscription client.
 *
 * Two capabilities:
 *
 *   1. `probePushSupport()` — a pure, side-effect-free capability
 *      check. Returns a discriminated union describing *why* push is
 *      (un)available. Callers should NEVER call `requestPermission()`
 *      from this function — it must be safe to run on render.
 *
 *   2. `subscribeForOutcome(request)` — the one-shot subscribe flow
 *      offered *after* a successful verification submit. It prompts
 *      for permission if not yet granted, calls
 *      `pushManager.subscribe()` with the VAPID public key, and POSTs
 *      the serialised subscription to the server.
 *
 * Doctrine: this surface is never invoked on landing, never invoked
 * on install, and never surfaces on the same tick as the ask-gallery
 * submit. The offer appears inside the "requested" chip, after the
 * gallery has been asked — at that point the user has a concrete
 * reason to accept a notification ("tell me when the gallery
 * answers"). Any other placement is out of policy.
 *
 * Defence in depth:
 *   - VAPID public key is read from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
 *     If absent we report `{ kind: "unsupported", reason: "no-vapid" }`
 *     rather than attempting a subscription — a missing key at build
 *     time is an infrastructure error, not a user-visible failure.
 *   - The `requestPermission()` call is guarded behind `probeSupport`
 *     so we don't prompt in environments where the API does not exist.
 *   - The subscription POST uses `fetch` with `credentials: "include"`
 *     and is idempotent server-side on `requestId`.
 */

import type { VerificationRequest } from "@/verification/schema";
import { PushSubscribeAckSchema, type PushSubscribePayload } from "./schema";
import { pushSubscribeEvent } from "@/verification/otel";

export const PUSH_ENDPOINT = "/api/verification/push/subscribe";

// ---------- Capability probe -------------------------------------

export type PushSupport =
  | { kind: "supported"; reason: null }
  | {
      kind: "unsupported";
      reason:
        | "no-window"
        | "no-service-worker"
        | "no-push-manager"
        | "no-notification"
        | "no-vapid";
    }
  | { kind: "denied" };

/**
 * Pure capability probe. Safe to call on every render. Does not
 * prompt the user, does not register the service worker, does not
 * hit the network.
 */
export function probePushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { kind: "unsupported", reason: "no-window" };
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { kind: "unsupported", reason: "no-service-worker" };
  }
  if (typeof PushManager === "undefined") {
    return { kind: "unsupported", reason: "no-push-manager" };
  }
  if (typeof Notification === "undefined") {
    return { kind: "unsupported", reason: "no-notification" };
  }
  if (!readVapidKey()) {
    return { kind: "unsupported", reason: "no-vapid" };
  }
  if (Notification.permission === "denied") {
    return { kind: "denied" };
  }
  return { kind: "supported", reason: null };
}

function readVapidKey(): string | null {
  // Next inlines `NEXT_PUBLIC_*` at build time, so a direct
  // `process.env` read is safe on the client.
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

// ---------- Subscribe outcome ------------------------------------

export type SubscribeOutcome =
  | {
      kind: "granted";
      storedAt: string;
    }
  | {
      kind: "denied";
    }
  | {
      kind: "unsupported";
      reason: string;
    }
  | {
      kind: "error";
      reason: string;
    };

/**
 * Subscribe for a specific verification outcome. The request binds
 * the push subscription to (`requestId`, `workId`) so the gallery's
 * dispatcher can look up both in one step when it sends the push.
 *
 * This function is the orchestration layer only; the decision to
 * call it lives in the UI (after a successful submit).
 */
export async function subscribeForOutcome(
  request: VerificationRequest,
): Promise<SubscribeOutcome> {
  const support = probePushSupport();
  if (support.kind === "unsupported") {
    pushSubscribeEvent(request.requestId, "unsupported", support.reason);
    return { kind: "unsupported", reason: support.reason };
  }
  if (support.kind === "denied") {
    pushSubscribeEvent(request.requestId, "denied", "already-denied");
    return { kind: "denied" };
  }

  // Permission prompt — returns "granted" | "denied" | "default".
  // A "default" result (user dismissed the prompt) classifies as
  // denied for our purposes: we do not retry, we do not nag.
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    const reason = errorReason(e);
    pushSubscribeEvent(request.requestId, "error", reason);
    return { kind: "error", reason };
  }
  if (permission !== "granted") {
    pushSubscribeEvent(request.requestId, "denied");
    return { kind: "denied" };
  }

  // Pull the subscription off the already-registered SW. We wait for
  // the `.ready` promise so we never race a first-tick registration.
  let subscription: PushSubscription;
  try {
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(readVapidKey() ?? "");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (e) {
    const reason = errorReason(e);
    pushSubscribeEvent(request.requestId, "error", reason);
    return { kind: "error", reason };
  }

  const payload = toPayload(request, subscription);
  try {
    const res = await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const reason = `http/${res.status}`;
      pushSubscribeEvent(request.requestId, "error", reason);
      return { kind: "error", reason };
    }
    let ackJson: unknown;
    try {
      ackJson = await res.json();
    } catch {
      pushSubscribeEvent(request.requestId, "error", "ack/parse");
      return { kind: "error", reason: "ack/parse" };
    }
    const parsed = PushSubscribeAckSchema.safeParse(ackJson);
    if (!parsed.success) {
      pushSubscribeEvent(request.requestId, "error", "ack/schema");
      return { kind: "error", reason: "ack/schema" };
    }
    pushSubscribeEvent(request.requestId, "granted");
    return { kind: "granted", storedAt: parsed.data.storedAt };
  } catch (e) {
    const reason = errorReason(e);
    pushSubscribeEvent(request.requestId, "error", reason);
    return { kind: "error", reason };
  }
}

// ---------- Serialisation helpers --------------------------------

/**
 * Build the wire payload from a live `PushSubscription`. Kept as a
 * pure function so unit tests can feed it a plain object without a
 * browser environment.
 */
export function toPayload(
  request: VerificationRequest,
  subscription: PushSubscriptionLike,
): PushSubscribePayload {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    // `PushSubscription.toJSON()` always returns these in practice,
    // but the types allow undefined. A missing value here is an
    // infrastructure bug; throw so the caller catches + classifies.
    throw new Error("subscription missing endpoint or keys");
  }
  return {
    version: "v1",
    requestId: request.requestId,
    workId: request.workId,
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh, auth },
    subscribedAt: new Date().toISOString(),
  };
}

/**
 * Structural slice of `PushSubscription` so `toPayload` can be unit-
 * tested without a browser. The DOM `PushSubscription` satisfies
 * this shape at runtime.
 */
export interface PushSubscriptionLike {
  toJSON(): {
    endpoint?: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
}

// ---------- Internal utilities -----------------------------------

/**
 * Convert a base64url-encoded VAPID public key into the Uint8Array
 * the Push API expects for `applicationServerKey`. Pure; unit-tested.
 *
 * The view is allocated on a fresh `ArrayBuffer` (not the shared
 * default) so TypeScript 5.7's narrowed `Uint8Array<ArrayBufferLike>`
 * resolves to `Uint8Array<ArrayBuffer>` — the exact shape
 * `PushSubscriptionOptionsInit.applicationServerKey` accepts.
 */
export function urlBase64ToUint8Array(
  base64url: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function errorReason(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "NotAllowedError") return "not-allowed";
    if (e.name === "AbortError") return "abort";
    if (e.name === "InvalidStateError") return "invalid-state";
    return `error/${e.name}`;
  }
  return "error/unknown";
}
