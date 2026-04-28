"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem("pang-onboarded");

    // Start fade-out just before animation ends (1.8s total)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1500);

    // Navigate after fade-out completes
    const navTimer = setTimeout(() => {
      if (hasOnboarded) {
        router.replace("/collection");
      } else {
        router.replace("/onboarding");
      }
    }, 1900);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <main
      className="min-h-dvh w-screen overflow-hidden flex items-center justify-center bg-background"
      style={{
        opacity: isExiting ? 0 : 1,
        transition: isExiting ? "opacity 400ms ease-in-out" : "none",
      }}
    >
      <img
        src="/pang-logo.svg"
        alt="PANG"
        width={800}
        height={800}
        className="splash-logo"
      />

      <style>{`
        .splash-logo {
          animation: splashZoom 1.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes splashZoom {
          0% {
            opacity: 0;
            transform: scale(0.15);
            filter: blur(4px);
          }
          25% {
            opacity: 1;
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(3.2);
            filter: blur(0px);
          }
        }
      `}</style>
    </main>
  );
}
