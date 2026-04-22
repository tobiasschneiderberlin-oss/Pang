"use client";
/**
 * PANG — room scaffold smoke client.
 *
 * Client half of the disposable smoke route. Carries a tiny HUD —
 * tier badge + frame counter — so the screenshot shows *which*
 * renderer produced the pixels. The HUD is plain DOM (P9 is not in
 * play here; the primary surface is still the canvas).
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { TheRoomCanvas } from "@/room/dom/TheRoomCanvas";
import type { Tier, Work } from "@/room/types";

// Three stub works on the back wall. Positions in metres, Y-up,
// back wall at z = -3. Sizes chosen to echo typical small/medium
// works (0.6×0.9m, 1.0×0.7m, 0.5×0.6m). Smoke-test spacing is
// compressed (±1.0m) so a portrait phone aspect still frames all
// three without gesture-driven pan — real wall spacing (±1.8m+)
// relies on the gesture controller landing next step.
const STUB_WORKS: readonly Work[] = [
  {
    id: "smoke-1",
    imageUrl: "",
    position: [-1.0, 1.5, -2.99],
    size: [0.6, 0.9],
    status: "verified",
  },
  {
    id: "smoke-2",
    imageUrl: "",
    position: [0, 1.5, -2.99],
    size: [1.0, 0.7],
    status: "verified",
  },
  {
    id: "smoke-3",
    imageUrl: "",
    position: [1.0, 1.5, -2.99],
    size: [0.5, 0.6],
    status: "unverified",
  },
];

export function RoomSmokeClient(): ReactElement {
  const [tier, setTier] = useState<Tier | "detecting">("detecting");
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <div className="relative h-full w-full">
      <TheRoomCanvas
        works={STUB_WORKS}
        onReady={() => {
          setReady(true);
          const canvas = document.querySelector("canvas");
          if (canvas) {
            const gpuCtx = canvas.getContext("webgpu");
            if (gpuCtx) setTier("gpu");
            else setTier("gl2");
          }
        }}
        onNoCapability={() => setTier("none")}
        onFocusChange={(workId) => setFocus(workId)}
      />

      {/* HUD — dispose with the route. */}
      <div
        className="pointer-events-none absolute left-4 top-4 font-mono text-xs text-ink"
        data-smoke-hud
      >
        <div>tier: {tier}</div>
        <div>ready: {ready ? "yes" : "no"}</div>
        <div>works: {STUB_WORKS.length}</div>
        <div>focus: {focus ?? "(none)"}</div>
      </div>
    </div>
  );
}
