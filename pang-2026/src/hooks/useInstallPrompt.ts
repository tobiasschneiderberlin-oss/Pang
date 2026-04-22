"use client";

/**
 * PANG — install prompt hook.
 *
 * Branches by platform (Architecture doc § 2):
 *
 *   Chromium  — `beforeinstallprompt` fires; we stash the event and
 *               expose a `prompt()` function the UI calls at the
 *               right moment (after the first arrival ceremony, not
 *               on landing — PANG doctrine).
 *   iOS Safari — no event. We detect standalone via
 *               `matchMedia('(display-mode: standalone)')`. If not
 *               standalone *and* on iOS, the UI renders an
 *               instructional card with the share-sheet steps.
 *
 * This hook does not render; it only exposes state. The UI lives in
 * `src/components/InstallInvitation.tsx` and mounts at the arrival
 * chapter's end (iteration #2 wires the mount).
 */

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallState =
  | { kind: "unavailable" }
  | { kind: "installed" }
  | { kind: "promptable-chromium"; prompt: () => Promise<"accepted" | "dismissed"> }
  | { kind: "ios-instructions" };

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad running iPadOS 13+ reports as "Macintosh"; the touch-point
  // check disambiguates.
  return (
    /iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari legacy flag.
  const legacy = (window.navigator as { standalone?: boolean }).standalone;
  return legacy === true;
}

export function useInstallPrompt(): InstallState {
  // Lazy initializer — reads DOM state once at mount. Safe under SSR
  // because `isStandalone()` short-circuits when `window` is absent,
  // and React's lazy initializer only runs on the client's first
  // render.
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());

  useEffect(() => {
    // Only mount listeners if we aren't already standalone — the
    // state is already "installed" and no further signal matters.
    if (installed) return;

    const onBeforeInstallPrompt = (e: Event): void => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = (): void => {
      setInstalled(true);
      setEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [installed]);

  const prompt = useCallback(async (): Promise<"accepted" | "dismissed"> => {
    if (!event) return "dismissed";
    await event.prompt();
    const choice = await event.userChoice;
    setEvent(null);
    return choice.outcome;
  }, [event]);

  if (installed) return { kind: "installed" };
  if (event) return { kind: "promptable-chromium", prompt };
  if (isIos()) return { kind: "ios-instructions" };
  return { kind: "unavailable" };
}
