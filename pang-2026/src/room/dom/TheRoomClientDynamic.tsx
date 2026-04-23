"use client";
/**
 * PANG — client-only mount for The Room.
 *
 * Indirection that keeps `app/page.tsx` a Server Component while
 * preventing `three/webgpu` from evaluating during SSR.
 *
 * `src/room/scene.ts` imports `three/webgpu` at module top level by
 * doctrine (the unified bundle keeps `Scene`/`Mesh`/`AmbientLight` and
 * `WebGPURenderer` as a single class identity — see the comment in
 * `scene.ts`). `three/webgpu` touches `self` at module load, which is
 * fine in the browser and fatal in Node. Next.js still evaluates the
 * module graph of `"use client"` components on the server when rendering
 * the RSC payload, so `"use client"` alone is not enough — it marks the
 * hydration boundary, not the SSR boundary.
 *
 * `next/dynamic({ ssr: false })` is the SSR boundary. It can only be
 * called from a Client Component (App Router rule), which is why this
 * tiny wrapper exists. The home route imports this file; the real
 * composition lives in `TheRoomClient.tsx`.
 *
 * Tradeoff: the server sends an empty `<main>` shell and React hydrates
 * the canvas on the client. The Room is a `<canvas>` surface by doctrine
 * (Primitive §35) — it produces zero meaningful SSR output regardless,
 * so the user-visible paint is unchanged.
 */

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

// Lazy import with SSR disabled. The chunk is code-split naturally and
// fetched on client bootstrap. `loading` returns `null` because the
// home route already renders the empty `<main>` shell; flashing a
// different placeholder would disturb the paper baseline.
const TheRoomClient = dynamic(
  () =>
    import("@/room/dom/TheRoomClient").then((m) => ({
      default: m.TheRoomClient,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function TheRoomClientDynamic(): ReactElement {
  return <TheRoomClient />;
}
