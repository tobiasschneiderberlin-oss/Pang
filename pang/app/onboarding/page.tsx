"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    // Mark as onboarded and redirect to collection after 2 seconds
    localStorage.setItem("pang-onboarded", "true");
    const timer = setTimeout(() => {
      router.replace("/collection");
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-8 bg-background">
      {/* PANG Logo SVG */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1500 1500"
        width={200}
        height={200}
        className="drop-shadow-sm"
      >
        <g fill="#2e2e2e">
          <g transform="translate(-15.535176, 536.22944)">
            <path d="M 28.59375 0 L 28.59375 -379.953125 L 225.21875 -379.953125 C 271.851562 -379.953125 308.875 -368.289062 336.28125 -344.96875 C 363.6875 -321.644531 377.390625 -287.003906 377.390625 -241.046875 L 377.390625 -235.9375 C 377.390625 -188.957031 364.195312 -153.207031 337.8125 -128.6875 C 311.425781 -104.175781 275.9375 -91.921875 231.34375 -91.921875 L 159.84375 -91.921875 L 159.84375 0 Z M 159.84375 -187.421875 L 204.28125 -187.421875 C 217.894531 -187.421875 228.445312 -190.992188 235.9375 -198.140625 C 243.425781 -205.296875 247.171875 -217.554688 247.171875 -234.921875 L 247.171875 -238.484375 C 247.171875 -268.785156 233.039062 -283.9375 204.78125 -283.9375 L 159.84375 -283.9375 Z" />
          </g>
          <g transform="translate(335.819691, 536.22944)">
            <path d="M 3.0625 0 L 117.453125 -379.953125 L 298.75 -379.953125 L 414.671875 0 L 276.796875 0 L 261.46875 -62.296875 L 155.765625 -62.296875 L 140.4375 0 Z M 176.703125 -147.59375 L 240.53125 -147.59375 L 219.59375 -233.890625 L 209.375 -289.5625 L 208.359375 -289.5625 L 198.140625 -233.890625 Z" />
          </g>
          <g transform="translate(720.369543, 536.22944)">
            <path d="M 28.59375 0 L 28.59375 -379.953125 L 170.5625 -379.953125 L 264.03125 -202.75 L 279.34375 -168.015625 L 278.828125 -209.375 L 278.828125 -379.953125 L 408.25 -379.953125 L 408.25 0 L 268.125 0 L 179.5 -172.453125 L 165.109375 -205.734375 L 165.625 -164.671875 L 165.625 0 Z" />
          </g>
          <g transform="translate(1131.319603, 536.22944)">
            <path d="M 28.59375 0 L 28.59375 -379.953125 L 409.84375 -379.953125 L 409.84375 -292.359375 L 159.84375 -292.359375 L 159.84375 -218.234375 L 402.9375 -218.234375 L 402.9375 -130.640625 L 159.84375 -130.640625 L 159.84375 0 Z" />
          </g>
        </g>
      </svg>

      {/* Loading indicator */}
      <div className="mt-8 flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#2e2e2e" }} />
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#2e2e2e", animationDelay: "0.2s" }} />
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#2e2e2e", animationDelay: "0.4s" }} />
      </div>
    </main>
  );
}
