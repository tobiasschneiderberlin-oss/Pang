"use client";

/**
 * Fullscreen artwork viewer.
 *
 * Gestures only — no buttons, no percentage, no instructions.
 *
 *   • Pinch              free zoom 1× → MAX_SCALE, anchored at the
 *                        midpoint between the two fingers
 *   • Double-tap         toggle 1× ↔ DOUBLE_TAP_SCALE at the tap point
 *   • One-finger drag    pan when zoomed (clamped to image bounds)
 *   • Single tap         toggle the close (×) button
 *   • Escape (desktop)   close
 *
 * The transform model is `translate(tx, ty) scale(s)` with the image
 * centred in the viewport at (tx=0, ty=0, s=1). All gesture maths are
 * derived to keep a chosen viewport point pinned to the same image
 * point across the transform — that's what makes pinch and tap-anchored
 * zoom feel right.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { X } from "lucide-react";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const TAP_MAX_MOVEMENT = 8;        // px — distinguishes tap from drag
const TAP_MAX_DURATION = 250;      // ms
const DOUBLE_TAP_GAP = 280;        // ms — max between two taps

interface FullscreenViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenViewer({ src, alt, isOpen, onClose }: FullscreenViewerProps) {
  // Transform state: translation in CSS pixels, scale unitless.
  // Held in a ref + state so gesture handlers can read the latest
  // values synchronously without stale closures.
  const transform = useRef({ tx: 0, ty: 0, scale: 1 });
  const [, forceRender] = useState(0);
  const setTransform = useCallback((t: { tx: number; ty: number; scale: number }) => {
    transform.current = t;
    forceRender((n) => (n + 1) % 1_000_000);
  }, []);

  const [chromeVisible, setChromeVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      transform.current = { tx: 0, ty: 0, scale: 1 };
      setChromeVisible(true);
      forceRender((n) => (n + 1) % 1_000_000);
    }
  }, [isOpen]);

  // Bounds of the image at scale=1, measured live (varies with the
  // artwork's aspect ratio after object-contain). Read fresh on every
  // gesture because the viewport orientation can change.
  const measureFit = useCallback(() => {
    const img = imageRef.current?.querySelector("img");
    if (!img) return { fitW: 0, fitH: 0 };
    return { fitW: img.clientWidth, fitH: img.clientHeight };
  }, []);

  // Clamp translation so the image can't be panned entirely off-screen.
  // When the scaled image is smaller than the viewport on an axis, the
  // translation on that axis is forced to 0 (image stays centred).
  const clampTranslation = useCallback(
    (tx: number, ty: number, scale: number) => {
      const { fitW, fitH } = measureFit();
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const overflowW = Math.max(0, fitW * scale - vpW) / 2;
      const overflowH = Math.max(0, fitH * scale - vpH) / 2;
      return {
        tx: Math.min(overflowW, Math.max(-overflowW, tx)),
        ty: Math.min(overflowH, Math.max(-overflowH, ty)),
      };
    },
    [measureFit],
  );

  // Re-anchor zoom: pin viewport point (px, py) to the image point
  // it's currently over while the scale changes. Standard pinch-zoom
  // maths, applied identically to both pinch midpoint and double-tap.
  const reanchor = useCallback(
    (px: number, py: number, newScale: number) => {
      const { tx, ty, scale } = transform.current;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      // Image-space coordinates of the pivot, relative to image centre.
      const ix = (px - vpW / 2 - tx) / scale;
      const iy = (py - vpH / 2 - ty) / scale;
      const nextTx = px - vpW / 2 - ix * newScale;
      const nextTy = py - vpH / 2 - iy * newScale;
      const clamped = clampTranslation(nextTx, nextTy, newScale);
      setTransform({ tx: clamped.tx, ty: clamped.ty, scale: newScale });
    },
    [clampTranslation, setTransform],
  );

  // Touch gesture state. Held in refs so the touchmove handler reads
  // the latest values without re-binding on every transform change.
  const gesture = useRef({
    mode: "idle" as "idle" | "pan" | "pinch",
    panStartTx: 0,
    panStartTy: 0,
    panStartX: 0,
    panStartY: 0,
    pinchInitialDistance: 0,
    pinchInitialScale: 1,
    pinchPivotX: 0,
    pinchPivotY: 0,
    // Tap detection
    tapStartX: 0,
    tapStartY: 0,
    tapStartTime: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return;

    const distance = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      const g = gesture.current;
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        g.mode = "pan";
        g.panStartTx = transform.current.tx;
        g.panStartTy = transform.current.ty;
        g.panStartX = t.clientX;
        g.panStartY = t.clientY;
        g.tapStartX = t.clientX;
        g.tapStartY = t.clientY;
        g.tapStartTime = performance.now();
      } else if (e.touches.length === 2) {
        const [t0, t1] = [e.touches[0]!, e.touches[1]!];
        g.mode = "pinch";
        g.pinchInitialDistance = distance(t0, t1);
        g.pinchInitialScale = transform.current.scale;
        g.pinchPivotX = (t0.clientX + t1.clientX) / 2;
        g.pinchPivotY = (t0.clientY + t1.clientY) / 2;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (g.mode === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        if (g.pinchInitialDistance === 0) return;
        const [t0, t1] = [e.touches[0]!, e.touches[1]!];
        const ratio = distance(t0, t1) / g.pinchInitialDistance;
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, g.pinchInitialScale * ratio),
        );
        reanchor(g.pinchPivotX, g.pinchPivotY, nextScale);
      } else if (
        g.mode === "pan" &&
        e.touches.length === 1 &&
        transform.current.scale > MIN_SCALE
      ) {
        e.preventDefault();
        const t = e.touches[0]!;
        const tx = g.panStartTx + (t.clientX - g.panStartX);
        const ty = g.panStartTy + (t.clientY - g.panStartY);
        const clamped = clampTranslation(tx, ty, transform.current.scale);
        setTransform({ ...clamped, scale: transform.current.scale });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gesture.current;
      const wasPan = g.mode === "pan";
      const dx = e.changedTouches[0]
        ? Math.abs(e.changedTouches[0].clientX - g.tapStartX)
        : 0;
      const dy = e.changedTouches[0]
        ? Math.abs(e.changedTouches[0].clientY - g.tapStartY)
        : 0;
      const dt = performance.now() - g.tapStartTime;
      const isTap =
        wasPan &&
        dx <= TAP_MAX_MOVEMENT &&
        dy <= TAP_MAX_MOVEMENT &&
        dt <= TAP_MAX_DURATION;

      if (isTap && e.changedTouches[0]) {
        const t = e.changedTouches[0];
        const now = performance.now();
        const sinceLastTap = now - g.lastTapTime;
        const distFromLastTap = Math.hypot(
          t.clientX - g.lastTapX,
          t.clientY - g.lastTapY,
        );
        if (sinceLastTap < DOUBLE_TAP_GAP && distFromLastTap < 30) {
          // Double tap — toggle zoom anchored at the second tap point.
          const target =
            transform.current.scale > MIN_SCALE * 1.05
              ? MIN_SCALE
              : DOUBLE_TAP_SCALE;
          if (target === MIN_SCALE) {
            setTransform({ tx: 0, ty: 0, scale: MIN_SCALE });
          } else {
            reanchor(t.clientX, t.clientY, target);
          }
          g.lastTapTime = 0; // consume
        } else {
          // Single tap — schedule chrome toggle, may be promoted to a
          // double-tap by a follow-up tap.
          g.lastTapTime = now;
          g.lastTapX = t.clientX;
          g.lastTapY = t.clientY;
          window.setTimeout(() => {
            // Only fire if no second tap landed in the meantime.
            if (gesture.current.lastTapTime === now) {
              setChromeVisible((v) => !v);
              gesture.current.lastTapTime = 0;
            }
          }, DOUBLE_TAP_GAP);
        }
      }

      g.mode = "idle";
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [isOpen, reanchor, clampTranslation, setTransform]);

  // Desktop: double-click (anchored) and Escape to close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const onDoubleClickDesktop = useCallback(
    (e: React.MouseEvent) => {
      const target =
        transform.current.scale > MIN_SCALE * 1.05
          ? MIN_SCALE
          : DOUBLE_TAP_SCALE;
      if (target === MIN_SCALE) {
        setTransform({ tx: 0, ty: 0, scale: MIN_SCALE });
      } else {
        reanchor(e.clientX, e.clientY, target);
      }
    },
    [reanchor, setTransform],
  );

  if (!isOpen) return null;

  const { tx, ty, scale } = transform.current;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black overflow-hidden touch-none">
      {/* Close — single visible affordance. Auto-toggleable via tap.
          aria-hidden when not visible so screen readers don't announce
          a hidden control, but the keyboard Escape shortcut still works. */}
      <button
        onClick={onClose}
        aria-label="Close"
        aria-hidden={!chromeVisible}
        tabIndex={chromeVisible ? 0 : -1}
        className="absolute top-4 left-4 safe-area-inset-top z-10 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center transition-opacity duration-200"
        style={{
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? "auto" : "none",
        }}
      >
        <X size={20} className="text-white" />
      </button>

      {/* Image stage */}
      <div
        ref={imageRef}
        className="w-full h-full flex items-center justify-center select-none"
        onDoubleClick={onDoubleClickDesktop}
      >
        <div
          className="will-change-transform"
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transformOrigin: "center",
            // Soft transition for taps; gestures override with their own
            // continuous updates (no transition delay during pinch / pan).
            transition: gesture.current.mode === "idle" ? "transform 180ms ease-out" : "none",
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={1600}
            className="max-w-[100vw] max-h-[100vh] w-auto h-auto object-contain"
            draggable={false}
            priority
          />
        </div>
      </div>
    </div>
  );
}
