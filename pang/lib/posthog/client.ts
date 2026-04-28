/**
 * PANG — PostHog client.
 *
 * Lazy initialization of posthog-js. Called from the client-side
 * <PostHogProvider>; the SDK is no-op (returns null) when
 * NEXT_PUBLIC_POSTHOG_KEY is missing — useful in dev before .env.local
 * is filled in, and in CI builds where placeholders are fine.
 *
 * Configuration choices (per ADR-001 + privacy posture):
 *   - api_host pinned to NEXT_PUBLIC_POSTHOG_HOST (defaults to
 *     https://eu.posthog.com via lib/env.ts) — EU residency.
 *   - person_profiles: "identified_only" — anonymous visitors don't
 *     accumulate person profiles. Only collectors who go through
 *     the invite flow get an identity.
 *   - autocapture + capture_pageview ON — standard PostHog behaviour.
 *   - session_recording.maskAllInputs ON — every <input>/<textarea>
 *     value is masked in replays by default. Add `data-ph-mask` to
 *     any element whose innerText is sensitive (artwork prices,
 *     document UI). Add `ph-no-capture` to opt elements out entirely.
 *
 * Why direct process.env reads (not lib/env.ts): identical reasoning
 * to lib/supabase/client.ts — lib/env.ts is server-context-aware,
 * importing it from a Client Component pulls in serverEnv validation.
 */

import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): typeof posthog | null {
  if (typeof window === "undefined") return null;
  if (initialized) return posthog;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";

  if (!key) {
    // Fresh clones / CI: NEXT_PUBLIC_POSTHOG_KEY is empty. Stay
    // silent — capturing nothing is a feature here, not a bug.
    return null;
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      // Elements with `data-ph-mask` get their innerText masked in
      // replays. Use this on price labels, document titles, and any
      // copy that might leak collector identity.
      maskTextSelector: "[data-ph-mask]",
    },
    // Opt out of localStorage profiling under DNT — PostHog respects
    // Do-Not-Track by default, but make it explicit.
    respect_dnt: true,
  });

  initialized = true;
  return posthog;
}

/**
 * Returns the live PostHog client if init has completed, else null.
 * Use from places that fire ad-hoc captures (e.g. button handlers).
 */
export function getPostHogClient(): typeof posthog | null {
  if (!initialized || typeof window === "undefined") return null;
  return posthog;
}
