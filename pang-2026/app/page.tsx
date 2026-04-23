/**
 * PANG — The Room (home route).
 *
 * The collector's wall. Empty on fresh install (Laura is the
 * baseline — no seed data, no demo collector); populated as works
 * cross the verification line. The primary surface is a `<canvas>`
 * (Primitive §35) driven by `src/stores/works.ts`; React is the
 * adapter around it.
 *
 * What this page *isn't*:
 *   - A title card. Not "Welcome to PANG."
 *   - A call-to-action screen. Not "Scan your first work."
 *   - A marketing surface. Not anything, really.
 *
 * When empty, it is paper. When it has works, it is a room you are
 * in. The chrome ships elsewhere.
 */

import type { ReactElement } from "react";
// `TheRoomClientDynamic` wraps `TheRoomClient` in
// `next/dynamic({ ssr: false })`. The reason lives in that file's
// header: `src/room/scene.ts` imports `three/webgpu` at module top
// level, which touches `self` and is fatal in Node. `"use client"`
// marks the hydration boundary but not the SSR boundary; `dynamic`
// with `ssr: false` is the SSR boundary. This route is the only
// place `TheRoomClient` is reached from a Server Component.
import { TheRoomClientDynamic } from "@/room/dom/TheRoomClientDynamic";

export default function TheRoom(): ReactElement {
  return (
    <main
      className="relative h-dvh w-full bg-paper"
      aria-label="Your collection"
    >
      <TheRoomClientDynamic />
    </main>
  );
}
