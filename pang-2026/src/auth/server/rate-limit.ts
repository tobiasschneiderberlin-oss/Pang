/**
 * PANG — per-IP token bucket (iter #9).
 *
 * In-memory, process-local. Resets on redeploy. Acceptable at the
 * single-digit-collector load floor iter #9 targets. The span name
 * (`auth.rate_limit.exceeded`) is the contract the edge-KV
 * replacement will honour.
 *
 * Bucket semantics:
 *   - Each (endpoint, ip) pair has an independent bucket.
 *   - Capacity = N requests (fills instantly on first hit).
 *   - Refill rate = N per `windowMs`.
 *   - `consume()` returns `{ allowed: true, remaining }` if a token
 *     is taken, `{ allowed: false, retryAfterMs }` otherwise.
 */

import { withOtelSpan } from "@/lib/otel/span";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

interface BucketPolicy {
  readonly capacity: number;
  readonly windowMs: number;
}

const POLICIES: Readonly<Record<string, BucketPolicy>> = {
  "auth.invite.bind": { capacity: 10, windowMs: 60_000 },
  "auth.passkey.options": { capacity: 30, windowMs: 60_000 },
  "auth.passkey.enroll": { capacity: 10, windowMs: 60_000 },
  "auth.passkey.assert": { capacity: 30, windowMs: 60_000 },
  "auth.session.check": { capacity: 120, windowMs: 60_000 },
  "auth.logout": { capacity: 10, windowMs: 60_000 },
};

const BUCKETS = new Map<string, Bucket>();

function key(endpoint: string, ip: string): string {
  return `${endpoint}|${ip}`;
}

function policyFor(endpoint: string): BucketPolicy {
  return POLICIES[endpoint] ?? { capacity: 30, windowMs: 60_000 };
}

function refill(bucket: Bucket, policy: BucketPolicy, now: number): void {
  const elapsed = now - bucket.lastRefillMs;
  if (elapsed <= 0) return;
  const refilled = (elapsed / policy.windowMs) * policy.capacity;
  bucket.tokens = Math.min(policy.capacity, bucket.tokens + refilled);
  bucket.lastRefillMs = now;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  /** When `allowed === false`. Milliseconds to wait before retrying. */
  readonly retryAfterMs: number;
  readonly remaining: number;
}

/**
 * Consume one token from the bucket for (endpoint, ip). Emits the
 * `auth.rate_limit.exceeded` span on denial.
 */
export async function consumeRateLimit(
  endpoint: string,
  ip: string,
): Promise<RateLimitResult> {
  const policy = policyFor(endpoint);
  const k = key(endpoint, ip);
  const now = Date.now();
  let bucket = BUCKETS.get(k);
  if (!bucket) {
    bucket = { tokens: policy.capacity, lastRefillMs: now };
    BUCKETS.set(k, bucket);
  } else {
    refill(bucket, policy, now);
  }
  if (bucket.tokens < 1) {
    const retryAfterMs = Math.ceil(
      ((1 - bucket.tokens) * policy.windowMs) / policy.capacity,
    );
    await withOtelSpan("auth.rate_limit.exceeded", async (span) => {
      span.setAttribute("pang.auth.endpoint", endpoint);
      span.setAttribute("pang.auth.ip", ip);
      span.setAttribute("pang.auth.retry_after_ms", retryAfterMs);
    });
    return { allowed: false, retryAfterMs, remaining: 0 };
  }
  bucket.tokens -= 1;
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.floor(bucket.tokens),
  };
}

/**
 * Extract the client IP from a standard Next.js request. In dev /
 * behind the Vercel edge the header shape varies; we try a few in
 * priority order.
 */
export function clientIpFromRequest(req: Request): string {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  // Final fallback — same bucket for all callers in dev.
  return "unknown";
}

/** Test helper only. */
export function __resetRateLimitForTests(): void {
  BUCKETS.clear();
}
