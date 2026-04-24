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
import { FocusedWorkPanel } from "@/components/verification/FocusedWorkPanel";
import { DocumentsChapterConnector } from "@/components/documents/DocumentsChapter";
import { DocumentViewerConnector } from "@/components/documents/DocumentViewer";
import { EnrichmentPanel } from "@/components/enrichment/EnrichmentPanel";
import { DeepZoomOverlay } from "@/components/deep-zoom/DeepZoomOverlay";
import { RoomSurfaceClaim } from "@/components/room/RoomSurfaceClaim";
import { NarrativeOverlayConnector } from "@/components/room/NarrativeOverlayConnector";
import { OutcomeChapterMount } from "@/components/intake/OutcomeChapterMount";
import { SettingsOverlay } from "@/components/chrome/SettingsOverlay";
import { ROOM_MAIN_LABEL } from "@/ai/room/voice";

export default function TheRoom(): ReactElement {
  return (
    <main
      className="relative h-dvh w-full bg-paper"
      aria-label={ROOM_MAIN_LABEL}
    >
      {/* Iteration #11 — Claim the active surface for chapter-mount
       *  gating. Renders nothing; subscribes to mount/unmount edges. */}
      <RoomSurfaceClaim />
      <TheRoomClientDynamic />
      {/* Focused-work plaque + ask-gallery affordance. Self-guards
       *  on focusedId; renders nothing when no work is focused. Lives
       *  at the surface level (not inside TheRoomClient) so the
       *  arrival chapter — which uses its own TheRoomClient — owns
       *  its own chrome without fighting this panel. */}
      <FocusedWorkPanel />
      {/* Iteration #6 surfaces — the focused-work surface expands to
       *  include documents as evidence + the enrichment panel beside
       *  it. Each connector self-guards: no documents, no render; no
       *  enrichment payload, no render; no activeViewer, no viewer. */}
      <DocumentsChapterConnector />
      <EnrichmentPanel />
      <DocumentViewerConnector />
      {/* Iteration #8 — Deep zoom overlay. Mounts when
       *  `activeDeepZoom` is non-null. The resolver reads the live
       *  works store for the matching entry's tileSource; a work
       *  with no tile source never lands here because the second-
       *  tap binding is a no-op for those entries. */}
      <DeepZoomOverlay />
      {/* Iteration #11 — Outcome chapter mount. Watches the
       *  verification store for new confirmed / declined entries and
       *  surfaces the ceremony on the Room surface. One chapter at a
       *  time with a 400 ms inter-chapter gap; off-Room transitions
       *  queue until Room is active. */}
      <OutcomeChapterMount />
      {/* Iteration #14 — Narrative overlay. Fires a single GET on
       *  Room-active edge (after a settle delay); fades in a short
       *  observational paragraph when a current-month reading exists
       *  and hasn't been dismissed this session. Passive surface —
       *  silence is the default register. */}
      <NarrativeOverlayConnector />
      {/* Iteration #15 — Quiet settings overlay. A small chrome
       *  affordance in the Room's top-right opens a Popover-API
       *  panel carrying the two silence-default opt-ins (spatial
       *  audio + haptics). Cold install: both off, panel closed. */}
      <SettingsOverlay />
    </main>
  );
}
