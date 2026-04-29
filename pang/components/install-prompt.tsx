"use client";

/**
 * PANG — install prompt.
 *
 * Chrome fires `beforeinstallprompt` when its installability heuristic
 * passes (engagement + valid manifest + PNG icons + HTTPS). The browser
 * would normally surface its own mini-infobar; we suppress that by
 * preventing the default and instead expose a discreet floating button
 * that calls `prompt()` when tapped. This guarantees the install entry
 * point is one tap away rather than buried in the three-dot menu.
 *
 * Hidden when:
 *   - already running standalone (the PWA is installed)
 *   - the user dismisses or accepts the prompt this session
 *   - the browser never fires `beforeinstallprompt` (iOS Safari, etc.)
 */

import { useEffect, useState } from "react";

// Subset of the BeforeInstallPromptEvent interface we actually use.
// Not yet in lib.dom.d.ts as a stable type, so we hand-roll it.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed — never show the button.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setHidden(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !deferred) return null;

  const onClick = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // Some browsers throw if `prompt()` is invoked outside a user
      // gesture window or twice. Either way, fall through and hide.
    }
    setDeferred(null);
    setHidden(true);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Install PANG"
      className="fixed bottom-4 right-4 z-40 rounded-full bg-foreground/85 px-4 py-2 text-xs font-medium text-background shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-200 hover:bg-foreground active:scale-95 safe-area-inset-bottom"
    >
      Install
    </button>
  );
}
