"use client";

/**
 * PANG — PostHog provider.
 *
 * Initializes posthog-js on first client mount. Identifies the
 * current user when the auth state changes, and resets on signout
 * (so a shared device doesn't bleed events between accounts).
 *
 * Renders nothing — this is a side-effect-only provider. Mount it
 * inside <AuthProvider> in app/layout.tsx so useAuth() is available.
 *
 * If NEXT_PUBLIC_POSTHOG_KEY is empty, every call here is a no-op —
 * the SDK never initializes, no network requests fire, no profiles
 * are created. Safe to ship to dev / CI without configuring PostHog.
 */

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { getPostHogClient, initPostHog } from "@/lib/posthog/client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // One-time init on mount.
  useEffect(() => {
    initPostHog();
  }, []);

  // Identify / reset on auth state change.
  const { user } = useAuth();
  useEffect(() => {
    const ph = getPostHogClient();
    if (!ph) return;
    if (user) {
      ph.identify(user.id, {
        email: user.email,
        name: user.name,
      });
    } else {
      ph.reset();
    }
  }, [user]);

  return <>{children}</>;
}
