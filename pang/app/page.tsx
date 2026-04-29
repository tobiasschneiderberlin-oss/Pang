"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Animation timing (ms). Three beats sharing one continuous motion:
// the pang-logo blasts from tiny → past normal size, peaks at the
// dark flash, and the splash variant catches that peak scale and
// smashes back down to normal.
//
//   0 ─► LOGO_IN (fast accel) ─►│flash│─► SPLASH_LAND (strong ease-out) ─► HOLD ─► OUT
const LOGO_IN_MS = 520;       // small → huge scale, fast accel
const FLASH_MS = 220;         // dark flash that bridges the two logos
const SPLASH_IN_MS = 520;     // huge → normal scale, strong ease-out
const SPLASH_HOLD_MS = 800;   // splash logo dwell time at rest
const OUT_MS = 300;           // final fade to home

// Scale at the cut. Logo1 ends at this scale; logo2 starts at it.
// >2 means past the viewport edge so it reads as "blasting outwards".
const PEAK_SCALE = 2.6;

const FLASH_AT = LOGO_IN_MS;                              // 520
const SPLASH_AT = FLASH_AT + FLASH_MS / 2;                // 630 (mid-flash)
const TOTAL_MS =
  LOGO_IN_MS + FLASH_MS + SPLASH_IN_MS + SPLASH_HOLD_MS + OUT_MS; // 2360

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const hasOnboarded =
      typeof window !== "undefined" &&
      window.localStorage.getItem("pang-onboarded");

    // Dev-only escape hatch: set sessionStorage["pang-splash-hold"] in
    // DevTools to keep the splash open indefinitely (frame inspection,
    // screenshotting). No effect in production.
    const hold =
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("pang-splash-hold");
    if (hold) return;

    const navTimer = setTimeout(() => {
      router.replace(hasOnboarded ? "/collection" : "/onboarding");
    }, TOTAL_MS);

    return () => clearTimeout(navTimer);
  }, [router]);

  return (
    <main className="splash-stage min-h-dvh w-screen overflow-hidden bg-background relative">
      {/* Beat 1 — wordmark zooms in, then fades behind the flash */}
      <img
        src="/pang-logo.svg"
        alt="PANG"
        width={320}
        height={320}
        className="splash-logo splash-logo-1"
        style={{ willChange: "transform, opacity, filter" }}
      />

      {/* Beat 3 — splash variant settles in after the flash */}
      <img
        src="/pang-splash-logo.svg"
        alt="PANG"
        width={320}
        height={320}
        className="splash-logo splash-logo-2"
        style={{ willChange: "transform, opacity, filter" }}
        aria-hidden="true"
      />

      {/* Beat 2 — dark flash overlay covers the cross-fade */}
      <div className="splash-flash" aria-hidden="true" />

      <style>{`
        .splash-stage {
          display: grid;
          place-items: center;
        }

        .splash-logo {
          grid-column: 1;
          grid-row: 1;
          opacity: 0;
        }

        /* Beat 1: tiny → past-normal scale, fast accel (ease-in). The
           logo "blasts outward" toward the viewport edge and disappears
           under the flash at peak scale. */
        .splash-logo-1 {
          animation: splashLogo1 ${LOGO_IN_MS + FLASH_MS}ms cubic-bezier(0.55, 0, 1, 0.45) both;
        }

        /* Beat 3: starts at the same peak scale as logo1's exit, then
           snaps back to normal with a strong ease-out — reads as the
           splash "catching" the logo and smashing it home. fill mode
           is forwards (not both) so the 0% keyframe does not apply
           during the delay; the base .splash-logo opacity:0 rule does,
           keeping the element invisible until the cut. */
        .splash-logo-2 {
          animation: splashLogo2
            ${SPLASH_IN_MS + SPLASH_HOLD_MS + OUT_MS}ms
            cubic-bezier(0.16, 1, 0.3, 1)
            ${SPLASH_AT}ms
            forwards;
        }

        /* Beat 2: dark veil that bridges the two logos at peak scale. */
        .splash-flash {
          position: absolute;
          inset: 0;
          background: #0a0a0a;
          opacity: 0;
          animation: splashFlash ${FLASH_MS}ms ease-in-out ${FLASH_AT}ms both;
          pointer-events: none;
        }

        @keyframes splashLogo1 {
          /* tiny → huge, fast accel. Sharpens as it grows.
             Crucially: opacity drops to 0 exactly when the flash hits
             its midpoint, so the swap to logo2 is fully covered. */
          0%   { opacity: 0; transform: scale(0.18); filter: blur(8px); }
          ${pct(LOGO_IN_MS * 0.30, LOGO_IN_MS + FLASH_MS)} { opacity: 1; filter: blur(2px); }
          ${pct(LOGO_IN_MS, LOGO_IN_MS + FLASH_MS)} { opacity: 1; transform: scale(${PEAK_SCALE}); filter: blur(0); }
          /* T = LOGO_IN_MS + FLASH_MS/2 ─── flash peak. Vanish here. */
          ${pct(LOGO_IN_MS + FLASH_MS / 2, LOGO_IN_MS + FLASH_MS)} { opacity: 0; transform: scale(${PEAK_SCALE}); }
          100% { opacity: 0; transform: scale(${PEAK_SCALE}); }
        }

        @keyframes splashLogo2 {
          /* Visible the instant its delay expires (under the flash).
             Smashed from peak scale back to 1.0 with strong ease-out. */
          0%   { opacity: 1; transform: scale(${PEAK_SCALE}); filter: blur(0); }
          ${pct(SPLASH_IN_MS, SPLASH_IN_MS + SPLASH_HOLD_MS + OUT_MS)} { opacity: 1; transform: scale(1); filter: blur(0); }
          ${pct(SPLASH_IN_MS + SPLASH_HOLD_MS, SPLASH_IN_MS + SPLASH_HOLD_MS + OUT_MS)} { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(0.98); filter: blur(2px); }
        }

        @keyframes splashFlash {
          0%   { opacity: 0; }
          50%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Honour OS-level reduce-motion: skip the choreography, keep
           the splash logo only as a gentle fade. */
        @media (prefers-reduced-motion: reduce) {
          .splash-logo-1, .splash-flash { display: none; }
          .splash-logo-2 {
            animation: splashFade ${TOTAL_MS}ms ease-out both;
          }
          @keyframes splashFade {
            0%   { opacity: 0; }
            12%  { opacity: 1; }
            88%  { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </main>
  );
}

// Helper: emit "NN.NN%" for a CSS keyframe stop. Lets the timing
// constants above stay in milliseconds while the keyframe percentages
// are derived once.
function pct(at: number, total: number) {
  return `${((at / total) * 100).toFixed(2)}%`;
}
