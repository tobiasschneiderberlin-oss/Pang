/**
 * PANG — verification push delivery (iter #10).
 *
 * Best-effort fan-out: after the confirm/decline route writes an
 * outcome, it calls `deliverOutcomePush(requestId, kind)`. If a push
 * subscription exists at `.pang/push-subs/<requestId>.json`, we ship
 * the VAPID-signed push payload and delete the subscription record.
 * If no subscription, it's a no-op.
 *
 * Doctrine points:
 *
 *   - Delivery is best-effort. A failure does NOT fail the outcome
 *     write — the outbox's `/api/verification/outcome` GET is the
 *     guaranteed-available rail. Push is the latency optimisation;
 *     the walker is the correctness floor.
 *   - One subscription per requestId. Sending is terminal: after
 *     the push (success or permanent failure), the record is
 *     removed. We never accumulate a long-lived subscription list
 *     per collector — a new ask creates a new subscription.
 *   - The payload carries the three load-bearing fields only:
 *     `requestId`, `workId`, `outcome`. The service worker renders
 *     a museumsschild notification from these; the title + body
 *     live in the SW, not on the wire. Keeps the payload small
 *     and keeps the user-visible strings out of the wire contract.
 *
 * VAPID keys are read from env at first call and cached. Missing
 * keys skip the delivery path silently — a staging environment
 * without VAPID configured must continue to work. The OTel span
 * records the skip so infrastructure ops catches the missing-key
 * case in dashboards.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import webpush from "web-push";
import type { PushSubscribePayload } from "@/push/schema";

const PUSH_SUBS_DIR = path.resolve(process.cwd(), ".pang", "push-subs");

/** The push payload the service worker receives. Small and structured. */
export interface OutcomePushPayload {
  readonly version: "v1";
  readonly kind: "outcome";
  readonly requestId: string;
  readonly workId: string;
  readonly outcome: "confirmed" | "declined" | "expired";
  readonly decidedAt: string;
}

/** Outcome of a delivery attempt. Discriminated for OTel reporting. */
export type DeliveryOutcome =
  | { kind: "sent"; endpoint: string }
  | { kind: "no-subscription" }
  | { kind: "no-vapid" }
  | { kind: "gone"; endpoint: string }
  | { kind: "error"; reason: string };

let vapidConfigured: boolean | null = null;

function ensureVapid(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:ops@pang.app";
  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  } catch {
    vapidConfigured = false;
  }
  return vapidConfigured;
}

/**
 * For tests — reset the cached VAPID config so env changes take
 * effect. Safe to call at any time.
 */
export function __resetVapidForTests(): void {
  vapidConfigured = null;
}

interface StoredPushSub {
  readonly subscription: PushSubscribePayload;
  readonly storedAt: string;
}

async function readSubscription(
  requestId: string,
): Promise<StoredPushSub | null> {
  const target = path.join(PUSH_SUBS_DIR, `${requestId}.json`);
  try {
    const raw = await fs.readFile(target, "utf8");
    return JSON.parse(raw) as StoredPushSub;
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
}

async function removeSubscription(requestId: string): Promise<void> {
  const target = path.join(PUSH_SUBS_DIR, `${requestId}.json`);
  await fs.rm(target, { force: true });
}

/**
 * Ship the outcome push. Idempotent by file removal: the subscription
 * is deleted on success, so a second call (e.g. replay confirm) finds
 * no subscription and returns `no-subscription` without re-pushing.
 *
 * A push service 404/410 response is terminal: the endpoint is gone
 * (subscription revoked, browser uninstalled, etc.). We delete the
 * record the same way we would on success.
 */
export async function deliverOutcomePush(input: {
  readonly requestId: string;
  readonly workId: string;
  readonly outcome: "confirmed" | "declined" | "expired";
  readonly decidedAt: string;
}): Promise<DeliveryOutcome> {
  const sub = await readSubscription(input.requestId);
  if (sub === null) {
    return { kind: "no-subscription" };
  }

  if (!ensureVapid()) {
    // Staging without VAPID — keep the subscription (a later call
    // with VAPID configured will send). The collector's walker
    // still picks up the outcome on visibility.
    return { kind: "no-vapid" };
  }

  const payload: OutcomePushPayload = {
    version: "v1",
    kind: "outcome",
    requestId: input.requestId,
    workId: input.workId,
    outcome: input.outcome,
    decidedAt: input.decidedAt,
  };

  const pushSubscription = {
    endpoint: sub.subscription.endpoint,
    keys: {
      p256dh: sub.subscription.keys.p256dh,
      auth: sub.subscription.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24h — the outcome is perishable
        urgency: "normal",
      },
    );
    // Success: remove the subscription. A second outcome (impossible
    // under the primitive-51 marker, but belt-and-braces) finds no
    // subscription and returns no-subscription.
    await removeSubscription(input.requestId).catch(() => {});
    return { kind: "sent", endpoint: sub.subscription.endpoint };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Endpoint is permanently gone. Remove the record.
      await removeSubscription(input.requestId).catch(() => {});
      return { kind: "gone", endpoint: sub.subscription.endpoint };
    }
    const reason =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
    return { kind: "error", reason: reason.slice(0, 256) };
  }
}
