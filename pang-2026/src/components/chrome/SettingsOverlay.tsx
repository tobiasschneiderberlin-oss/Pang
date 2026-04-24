"use client";

/**
 * PANG — the quiet settings overlay (iter #15).
 *
 * A small Popover-API panel (P17) anchored to a chrome affordance in
 * the Room's top-right. v1 carries exactly two toggles — the audio
 * opt-in and the haptic opt-in — plus a short voice-corpus explainer
 * line for each. Not the full DS Chapter 11 Tweaks sheet; that lands
 * later.
 *
 * Visual contract (`docs/PANG_DS.html` Appendix C + iter #15 brief):
 *
 *   - `<dialog popover>` opened imperatively via `showPopover()`; the
 *     native Popover API gives us click-outside-to-close + ESC +
 *     top-layer rendering for free. No portal, no focus-trap shim.
 *   - CSS Anchor Positioning anchors the panel to the trigger; feature-
 *     detected via `CSS.supports("anchor-name: --a")`. Fallback is a
 *     fixed offset from the top-right of the viewport.
 *   - Container border-radius 0 (P9); toggle chrome at `var(--r-chrome)`
 *     2 px. No box-shadow, no backdrop-filter. OKLCH colour only (P11).
 *   - Sentence case across every label (P14). No ALL CAPS inside the
 *     panel; the opener's label is sentence case too.
 *   - Open/close fades via View Transitions when available (P16); a
 *     CSS opacity transition otherwise. Never slides or scales.
 *
 * Accessibility (P23):
 *
 *   - `role="dialog"` + `aria-label` from the voice corpus.
 *   - The trigger is a `<button type="button">` with ≥ 24×24 hit
 *     target and an `aria-expanded` bound to open state. Opening
 *     records a user gesture (required for AudioContext construction
 *     under browser autoplay policy); closing returns focus to the
 *     trigger per P23's floor.
 *   - Each toggle is a `<button role="switch" aria-checked="…">` with
 *     both the label AND the state read out: "the room's voice, off".
 *   - Escape closes the overlay; the browser's native popover handler
 *     fires the "toggle" event which we observe to restore focus.
 *
 * Audio-opt-in flow:
 *
 *   flip on  → recordUserGesture() (same tick, inside the handler)
 *            → usePreferences.set("audioSpatial", "on")
 *            → startRoomBed() reads getAudioContext() and ramps.
 *   flip off → stopRoomBed() fades the master + closes the context.
 *              The factory's own preference subscription closes on
 *              the flip — calling stopRoomBed explicitly lets us
 *              await the ramp for the e2e suite.
 *
 * Haptic-opt-in is a pure preference flip. The dispatcher reads the
 * store on every call; there is no graph to spin up.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { usePreferences } from "@design/preferences";
import {
  recordUserGesture,
  startRoomBed,
  stopRoomBed,
  hapticsSupported,
} from "@/audio";
import { SETTINGS_OVERLAY } from "@/ai/chrome/voice";

// The anchor name is a scope-local CSS identifier. Prefixed so a
// future Tweaks sheet can add its own anchors without clash.
const ANCHOR_NAME = "--pang-settings-trigger";

/**
 * Popover-API typing. TypeScript's lib.dom.d.ts carries the methods
 * only on `HTMLElement` in late-2026 releases but not on older
 * baselines; the narrow extension keeps the component portable.
 */
type PopoverElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
  togglePopover?: () => void;
};

export function SettingsOverlay(): ReactElement {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const audioSpatial = usePreferences((s) => s.audioSpatial);
  const haptics = usePreferences((s) => s.haptics);
  const setPref = usePreferences((s) => s.set);

  // Observe the native `toggle` event so ESC + click-outside close
  // paths update state (and restore focus) just like the imperative
  // close path. Runs once per mount.
  useEffect(() => {
    const el = popoverRef.current as PopoverElement | null;
    if (!el) return;
    const onToggle = (e: Event): void => {
      const event = e as Event & { newState?: "open" | "closed" };
      const nowOpen = event.newState === "open";
      setIsOpen(nowOpen);
      if (!nowOpen) {
        // Return focus to the trigger per P23. Only re-focus if the
        // active element is inside the overlay; otherwise the
        // collector may have tabbed to a legitimate Room affordance.
        const active = document.activeElement;
        if (active && popoverRef.current?.contains(active)) {
          triggerRef.current?.focus();
        }
      }
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  const handleTriggerClick = useCallback((): void => {
    // Record a user gesture on every open. Required for
    // `new AudioContext()` to start in `running` state under the
    // browser autoplay policy; idempotent, cheap.
    recordUserGesture();
    const el = popoverRef.current as PopoverElement | null;
    if (!el) return;
    if (isOpen) {
      el.hidePopover?.();
    } else {
      el.showPopover?.();
    }
  }, [isOpen]);

  const handleAudioToggle = useCallback((): void => {
    // A user gesture needs to occur on the handling stack for the
    // AudioContext to construct in `running`. The opener handler
    // already called recordUserGesture, but the toggle itself is a
    // separate pointer event — re-record here so the flip-on path
    // is sound even if the collector tabbed into the panel.
    recordUserGesture();
    const next = audioSpatial === "on" ? "off" : "on";
    setPref("audioSpatial", next);
    if (next === "on") {
      // Synchronous call in the same tick as the gesture.
      startRoomBed();
    } else {
      // Fade-out before the factory closes. Fire-and-forget; the
      // ramp is audible, the await is test-only.
      void stopRoomBed();
    }
  }, [audioSpatial, setPref]);

  const handleHapticsToggle = useCallback((): void => {
    const next = haptics === "on" ? "off" : "on";
    setPref("haptics", next);
  }, [haptics, setPref]);

  const onToggleKey = (fn: () => void) =>
    (e: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
    };

  // `hapticsSupported()` probes `navigator.vibrate`, which differs
  // between Node (server render → false) and the browser (client
  // render → true on Chromium, false on iOS Safari). Probing inline
  // at render time causes a React SSR hydration mismatch that
  // flashes the toggle from disabled to enabled on every mount +
  // briefly yields an empty `data-state` attribute during React's
  // reconciliation. `useSyncExternalStore` with a stable server
  // snapshot resolves the mismatch: the SSR pass renders the
  // optimistic "supported" state; the client mount re-subscribes
  // and re-renders with the real probe. No mid-render state flip.
  const hapticsSupport = useSyncExternalStore(
    // No external changes to track — probe is idempotent after
    // mount. Return a no-op unsubscribe.
    () => () => {},
    () => hapticsSupported(),
    () => true,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-label={SETTINGS_OVERLAY.trigger}
        aria-expanded={isOpen}
        aria-controls="pang-settings-overlay"
        data-testid="pang-settings-trigger"
        className="pointer-events-auto fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-40 grid h-11 min-w-11 place-items-center border border-hairline bg-paper-5 px-3 text-xs text-ink"
        style={{
          borderRadius: "var(--r-chrome)",
          // Declare the anchor name so the popover can consume it.
          ["anchor-name" as unknown as string]: ANCHOR_NAME,
        }}
      >
        <SettingsGlyph />
      </button>

      <div
        ref={popoverRef}
        id="pang-settings-overlay"
        /* Native Popover API — rendered in the top layer, no portal.
         * React 19 recognises the `popover` attribute natively. */
        popover="auto"
        role="dialog"
        aria-label={SETTINGS_OVERLAY.panelLabel}
        data-testid="pang-settings-panel"
        data-pang-surface="settings-overlay"
        className="m-0 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 border border-hairline bg-paper p-4 text-ink"
        style={{
          borderRadius: 0,
          // Anchor Positioning. Browsers without support fall back to
          // the default popover centering; the `inset-area` clamps to
          // the bottom-left of the trigger.
          ["position-anchor" as unknown as string]: ANCHOR_NAME,
          ["position-area" as unknown as string]: "bottom span-left",
          ["margin-top" as unknown as string]: "0.5rem",
          viewTransitionName: "pang-settings-overlay",
        }}
      >
        <header className="flex items-start justify-between">
          <h2 className="text-sm text-ink">
            {SETTINGS_OVERLAY.panelHeading}
          </h2>
          <button
            type="button"
            onClick={() => {
              (popoverRef.current as PopoverElement | null)?.hidePopover?.();
            }}
            aria-label={SETTINGS_OVERLAY.close}
            data-testid="pang-settings-close"
            className="pointer-events-auto grid h-6 min-w-6 place-items-center bg-paper-5 px-2 text-xs text-ink-muted"
            style={{ borderRadius: "var(--r-chrome)" }}
          >
            {SETTINGS_OVERLAY.close}
          </button>
        </header>

        {/* Audio toggle. The role="switch" pair is what screen readers
            announce ("the room's voice, off" / "...on"). The aria-label
            carries the label so the switch reads without relying on the
            visible label's text-node ordering. */}
        <section className="flex flex-col gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={audioSpatial === "on"}
            aria-label={SETTINGS_OVERLAY.audioLabel}
            onClick={handleAudioToggle}
            onKeyDown={onToggleKey(handleAudioToggle)}
            data-testid="pang-settings-audio-toggle"
            data-state={audioSpatial}
            className="flex items-center justify-between gap-3 border border-hairline bg-paper-5 px-3 py-2 text-left text-sm text-ink"
            style={{ borderRadius: "var(--r-chrome)", minHeight: "2.5rem" }}
          >
            <span>{SETTINGS_OVERLAY.audioLabel}</span>
            <span className="text-xs text-ink-muted" aria-hidden="true">
              {audioSpatial === "on"
                ? SETTINGS_OVERLAY.on
                : SETTINGS_OVERLAY.off}
            </span>
          </button>
          <p className="text-xs text-ink-muted">
            {SETTINGS_OVERLAY.audioHint}
          </p>
        </section>

        {/* Haptic toggle. Disabled when `navigator.vibrate` is absent
            (iOS Safari, some embedded views) with an explainer line
            that keeps the Museumsschild register. */}
        <section className="flex flex-col gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={haptics === "on"}
            aria-label={SETTINGS_OVERLAY.hapticsLabel}
            aria-disabled={!hapticsSupport}
            onClick={hapticsSupport ? handleHapticsToggle : undefined}
            onKeyDown={
              hapticsSupport ? onToggleKey(handleHapticsToggle) : undefined
            }
            data-testid="pang-settings-haptics-toggle"
            data-state={haptics}
            data-supported={hapticsSupport ? "yes" : "no"}
            disabled={!hapticsSupport}
            className="flex items-center justify-between gap-3 border border-hairline bg-paper-5 px-3 py-2 text-left text-sm text-ink disabled:opacity-60"
            style={{ borderRadius: "var(--r-chrome)", minHeight: "2.5rem" }}
          >
            <span>{SETTINGS_OVERLAY.hapticsLabel}</span>
            <span className="text-xs text-ink-muted" aria-hidden="true">
              {haptics === "on"
                ? SETTINGS_OVERLAY.on
                : SETTINGS_OVERLAY.off}
            </span>
          </button>
          <p className="text-xs text-ink-muted">
            {hapticsSupport
              ? SETTINGS_OVERLAY.hapticsHint
              : SETTINGS_OVERLAY.hapticsUnsupported}
          </p>
        </section>
      </div>
    </>
  );
}

/**
 * Minimal chrome glyph — three concentric vertical strokes as a
 * "three small knobs" abstraction. Flat stroke, currentColor, no
 * fill. Aria-hidden because the button already carries the label.
 */
function SettingsGlyph(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" />
      <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" />
      <line x1="12" y1="2" x2="12" y2="14" stroke="currentColor" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}
