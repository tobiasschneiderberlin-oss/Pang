/**
 * PANG — verification submit retry policy.
 *
 * The verification submit is a two-node pipeline: outbox write, then
 * network POST. Retry applies only to the network POST — an OPFS
 * write failure is handled in-band by the outbox module (re-throw
 * so the store flip is rolled back).
 *
 * Policy: exponential with jitter, capped. The server-side idempotency
 * key (`requestId`) means retries are safe; the risk of retrying is
 * hammering a temporarily flaky endpoint, not double-submission.
 *
 *   attempt 1 → 0 s      (immediate)
 *   attempt 2 → 2 s  ± 0.25 × 2 s
 *   attempt 3 → 8 s  ± 0.25 × 8 s
 *   attempt 4 → 30 s ± 0.25 × 30 s
 *   attempt 5 → 120 s ± 0.25 × 120 s
 *   cap: 30 minutes (iteration #7 may tune this when real dispatch
 *   is wired — 30 min is a pragmatic ceiling for a flaky cell
 *   connection, short enough that a true dead endpoint is flagged
 *   as `"failed"` rather than sitting forever).
 *
 * The shape matches `src/ai/agents/_shared.ts` `RetryPolicy` so the
 * A21 gate recognises it, even though the A21 gate only audits
 * `src/ai/agents/*` for now. The constant also exports the
 * exponential schedule so the replay path and the tests share one
 * source of truth.
 */

export interface VerificationRetryPolicy {
  readonly maxRetries: number;
  readonly onTerminalFailure: "compensate" | "null" | "throw";
  /** Base delay seeds per attempt index (attempt 0 is the first try). */
  readonly baseDelaysMs: readonly number[];
  /** Jitter as a proportion of the base delay — symmetric. */
  readonly jitterFraction: number;
  /** Absolute cap on the delay between attempts. */
  readonly maxDelayMs: number;
}

/**
 * The policy itself. A constant, exported so `check:gates` (A21
 * shape) can grep for `RETRY_POLICY` and `onTerminalFailure`, and
 * so the outbox / replay paths read one source of truth.
 *
 * `onTerminalFailure: "compensate"` — the terminal state of a
 * verification submit is not a throw that takes the surface down.
 * The store flips to `"failed"` and the ask-affordance re-appears
 * on the focused work so Laura can retry by tapping again.
 */
export const RETRY_POLICY: VerificationRetryPolicy = {
  maxRetries: 4,
  onTerminalFailure: "compensate",
  baseDelaysMs: [0, 2_000, 8_000, 30_000, 120_000],
  jitterFraction: 0.25,
  maxDelayMs: 30 * 60 * 1000,
} as const;

/**
 * Compute the delay before the next attempt. Pure — seeded by a
 * random value so tests can fix the seed and assert the bounds.
 *
 * @param attempt  zero-indexed attempt number (the retry after the
 *                 first submit is attempt 1).
 * @param random01 a [0, 1) value; in production pass `Math.random()`.
 */
export function nextDelayMs(attempt: number, random01: number): number {
  if (attempt < 0) return 0;
  const base =
    attempt < RETRY_POLICY.baseDelaysMs.length
      ? RETRY_POLICY.baseDelaysMs[attempt]!
      : RETRY_POLICY.baseDelaysMs.at(-1)!;
  const jitterRange = base * RETRY_POLICY.jitterFraction;
  // [-jitterRange, +jitterRange]
  const jitter = (random01 * 2 - 1) * jitterRange;
  const raw = base + jitter;
  return Math.min(Math.max(0, raw), RETRY_POLICY.maxDelayMs);
}

/**
 * Should the caller give up? Matches the A21 contract: give up when
 * attempts exceeded.
 */
export function shouldGiveUp(attempt: number): boolean {
  return attempt > RETRY_POLICY.maxRetries;
}
