"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Animation timing — keep these two in sync.
const ANIMATION_MS = 2400;
const NAV_DELAY_MS = ANIMATION_MS;

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const hasOnboarded =
      typeof window !== "undefined" &&
      window.localStorage.getItem("pang-onboarded");

    const navTimer = setTimeout(() => {
      router.replace(hasOnboarded ? "/collection" : "/onboarding");
    }, NAV_DELAY_MS);

    return () => clearTimeout(navTimer);
  }, [router]);

  return (
    <main className="min-h-dvh w-screen overflow-hidden flex items-center justify-center bg-background">
      <img
        src="/pang-logo.svg"
        alt="PANG"
        width={320}
        height={320}
        className="splash-logo"
        // Hint to the browser: this layer is animated; promote to its
        // own composite layer for jank-free transforms on mobile Safari.
        style={{ willChange: "transform, opacity, filter" }}
      />

      <style>{`
        .splash-logo {
          /* Single curve for the whole arc — Material standard easing —
             so the inhale (zoom in) and exhale (zoom out) feel like one
             breath instead of two abrupt phases. */
          animation: splashBreath 2.4s cubic-bezier(0.65, 0, 0.35, 1) both;
        }

        @keyframes splashBreath {
          /* Inhale: small + soft → full size + sharp.  Logo arrives. */
          0% {
            opacity: 0;
            transform: scale(0.72);
            filter: blur(10px);
          }
          22% {
            opacity: 1;
            filter: blur(0);
          }
          38% {
            transform: scale(1);
          }
          /* Hold: full size, fully visible.  Reading beat. */
          62% {
            transform: scale(1);
            opacity: 1;
            filter: blur(0);
          }
          /* Exhale: gentle scale-down + fade. Never overshoots past 1
             so the full word stays readable on the way out. */
          100% {
            opacity: 0;
            transform: scale(0.94);
            filter: blur(3px);
          }
        }

        /* Honour the OS-level reduce-motion preference — show the logo
           at rest with a simple fade. Some users get nauseous from
           zoom animations. */
        @media (prefers-reduced-motion: reduce) {
          .splash-logo {
            animation: splashFade 2.4s ease-out both;
          }
          @keyframes splashFade {
            0% { opacity: 0; }
            12% { opacity: 1; }
            88% { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </main>
  );
}
