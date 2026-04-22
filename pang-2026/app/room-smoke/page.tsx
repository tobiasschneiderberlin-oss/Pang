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
import { RoomSmokeClient } from "./RoomSmokeClient";

export default function RoomSmokePage(): ReactElement {
  return (
    <main className="h-dvh w-full bg-paper">
      <RoomSmokeClient />
    </main>
  );
}
