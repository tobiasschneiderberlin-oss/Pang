"use client";

/**
 * PANG — outcome chapter mount point (iter #11).
 *
 * The client island that watches the outcome-chapter queue and
 * renders `<OutcomeChapter>` when the surface is due. Sibling of
 * `RoomSurfaceClaim`; mounted once at the Room route. Renders
 * nothing when no chapter is due.
 *
 * The Room's imperative handle is reached via a module-local ref
 * that `TheRoomClient` sets on mount. The outcome chapter consumes
 * it (optionally — decline has no place beat, so the handle's
 * `setArrivalFactor` is only called during confirmation runs).
 */

import { type ReactElement } from "react";
import {
  dismissOutcomeChapter,
  useOutcomeChapterMount,
} from "@/ai/chapter/outcome-mount";
import { OutcomeChapter } from "./OutcomeChapter";
import { roomHandleRef } from "@/room/dom/roomHandleRef";

export function OutcomeChapterMount(): ReactElement | null {
  const mount = useOutcomeChapterMount();
  if (!mount) return null;
  return (
    <OutcomeChapter
      plan={mount.plan}
      roomRef={roomHandleRef}
      onDone={dismissOutcomeChapter}
    />
  );
}
