"use client";

/**
 * PANG — deep-zoom overlay dynamic boundary.
 *
 * `DeepZoomOverlayClient` transitively imports OpenSeadragon, which
 * touches `document` at module top level. `next/dynamic({ ssr: false })`
 * keeps that evaluation on the client — mirrors the Room canvas's
 * dynamic wrapper and the deep-zoom smoke route.
 *
 * The production home route mounts `<DeepZoomOverlay />`. The
 * connector subscribes to `activeDeepZoom` and is a no-op until the
 * Room's second-tap binding writes a composite key — the OSD bundle
 * does not execute until the collector asks for paint depth.
 */

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

const DeepZoomOverlayClient = dynamic(
  () =>
    import("./DeepZoomOverlayClient").then((m) => ({
      default: m.DeepZoomOverlayClient,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export function DeepZoomOverlay(): ReactElement {
  return <DeepZoomOverlayClient />;
}
