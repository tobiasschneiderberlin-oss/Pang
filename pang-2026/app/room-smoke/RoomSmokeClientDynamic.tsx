"use client";
/**
 * PANG — client-only mount for the disposable room-smoke route.
 *
 * Mirror of `src/room/dom/TheRoomClientDynamic.tsx` for the
 * `/room-smoke` scaffold. `RoomSmokeClient` transitively imports
 * `three/webgpu`, which touches `self` at module load and crashes
 * Node; `dynamic({ ssr: false })` keeps the module evaluation on
 * the client. The wrapper is `"use client"` because Next 16 forbids
 * calling `dynamic()` with `ssr: false` from a Server Component.
 *
 * Remove this file when the `/room-smoke` route is deleted — it's
 * disposable scaffolding per its page header.
 */

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

const RoomSmokeClient = dynamic(
  () =>
    import("./RoomSmokeClient").then((m) => ({
      default: m.RoomSmokeClient,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function RoomSmokeClientDynamic(): ReactElement {
  return <RoomSmokeClient />;
}
