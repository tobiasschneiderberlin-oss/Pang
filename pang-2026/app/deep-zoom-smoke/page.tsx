/**
 * PANG — deep-zoom smoke route.
 *
 * Disposable scaffolding behind `NEXT_PUBLIC_PANG_E2E=1` or
 * `NODE_ENV === "development"`. The route 404s in a production
 * bundle so the OSD adapter + its seed PNG never ship to a
 * collector.
 *
 * Purpose: exercise `<DeepZoomConnector>` against a pre-baked
 * simple-image source so Playwright can assert mount, close, and
 * open → close × 10 heap-delta discipline ahead of the
 * tile-generation pipeline (its own iteration). A real DZI joins
 * this smoke once pyramids exist; the connector API is the same —
 * only the `resolve()` return flips from `"simple-image"` to
 * `"dzi"`.
 *
 * Not linked from the app. Not in the sitemap. Access: manual URL
 * or Playwright via `page.goto("/deep-zoom-smoke")`.
 */

import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { DeepZoomSmokeClientDynamic } from "./DeepZoomSmokeClientDynamic";

export default function DeepZoomSmokePage(): ReactElement {
  const e2e = process.env["NEXT_PUBLIC_PANG_E2E"] === "1";
  const dev = process.env["NODE_ENV"] === "development";
  if (!e2e && !dev) notFound();
  return (
    <main className="h-dvh w-full bg-paper">
      <DeepZoomSmokeClientDynamic />
    </main>
  );
}
