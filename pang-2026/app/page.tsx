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
import { TheRoomClient } from "./_the-room/TheRoomClient";

export default function TheRoom(): ReactElement {
  return (
    <main
      className="relative h-dvh w-full bg-paper"
      aria-label="Your collection"
    >
      <TheRoomClient />
    </main>
  );
}
