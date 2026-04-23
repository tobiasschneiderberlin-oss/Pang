/**
 * PANG — room scaffold smoke route.
 *
 * **Disposable.** Delete once gestures + wire-up land. This route
 * exists only to get pixels on screen from the tier-picked renderer
 * before the gesture controller starts moving the camera. See
 * `PANG_Aha_Sprint.md` iteration #2 step 1 — "test scaffold in
 * browser before writing gesture layer."
 *
 * Stub works pin three rectangles on the back wall at museum-centre
 * height (1.5m). No image URLs — the paper-coloured fallback proves
 * the material hierarchy and lighting bias (verified/unverified)
 * read correctly before textures complicate the picture.
 */

import type { ReactElement } from "react";
// Client-only mount: `RoomSmokeClient` imports `TheRoomCanvas` which
// transitively pulls `three/webgpu`. The latter touches `self` at
// module load and crashes Node. The intermediate
// `RoomSmokeClientDynamic` wraps the client in
// `next/dynamic({ ssr: false })` — Next 16 forbids that call from a
// Server Component, so the wrapper file is itself `"use client"`.
// Same pattern as the home route's `TheRoomClientDynamic`.
import { RoomSmokeClientDynamic } from "./RoomSmokeClientDynamic";

export default function RoomSmokePage(): ReactElement {
  return (
    <main className="h-dvh w-full bg-paper">
      <RoomSmokeClientDynamic />
    </main>
  );
}
