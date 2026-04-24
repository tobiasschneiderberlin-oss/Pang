"use client";

/**
 * PANG — shared Room imperative handle (iter #11).
 *
 * Module-singleton `MutableRefObject<TheRoomClientHandle | null>` that
 * siblings of `TheRoomClient` can pull per-frame scene drivers from.
 * Populated by `TheRoomClient` on mount; consumed by
 * `OutcomeChapterMount` so its `<OutcomeChapter>` can drive
 * `setArrivalFactor` during confirmation runs without threading a
 * prop through the route tree.
 *
 * Not a store — the handle is imperative, not reactive. Consumers
 * hold the ref and `.current?.setArrivalFactor(id, t)` on RAF ticks;
 * a null current is a no-op (the Room hasn't mounted yet or just
 * unmounted).
 *
 * Why not a Zustand slice: the handle is an identity, not state.
 * Subscribing to it would trigger re-renders on every tick; the
 * imperative pattern is the right one for per-frame scene drivers.
 * See `ArrivalChapter.tsx` for the direct-prop pattern (one
 * component owns + uses the ref); `OutcomeChapterMount` is a
 * sibling of `TheRoomClient`, not its parent, so the singleton ref
 * bridges them.
 */

import { type RefObject } from "react";
import type { TheRoomClientHandle } from "./TheRoomClient";

// `RefObject<T | null>` is the shape a React 19 `ref` callback
// assigns into. Module-scoped so both the producer (TheRoomClient's
// mount effect) and consumer (OutcomeChapterMount) see the same
// identity.
export const roomHandleRef: RefObject<TheRoomClientHandle | null> = {
  current: null,
};
