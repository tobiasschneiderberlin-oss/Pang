"use client";

/**
 * PANG — deep-zoom smoke client dynamic boundary.
 *
 * `DeepZoomSmokeClient` imports OpenSeadragon, which references
 * `window` at module top level. `next/dynamic({ ssr: false })`
 * keeps that evaluation on the client. Same pattern as the Room
 * smoke route's dynamic wrapper.
 */

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

const DeepZoomSmokeClient = dynamic(
  () =>
    import("./DeepZoomSmokeClient").then((m) => ({
      default: m.DeepZoomSmokeClient,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function DeepZoomSmokeClientDynamic(): ReactElement {
  return <DeepZoomSmokeClient />;
}
