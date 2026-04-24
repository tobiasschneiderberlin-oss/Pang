/**
 * PANG — room gestures tap/focus/second-tap tests.
 *
 * The module is small, DOM-shaped, and side-effect-free in a known
 * way: it installs pointer listeners on a canvas, then mutates a
 * plain `GestureState` object in response to synthetic events. We
 * feed it a fake canvas with just the shape it uses
 * (`addEventListener` + `setPointerCapture` + `releasePointerCapture`)
 * and drive events by hand.
 *
 * What we lock here:
 *   - Tap on empty space clears focus.
 *   - Tap on a different work sets focus to that work.
 *   - Tap on the currently-focused work fires `onSecondTap(workId)`
 *     and does NOT clear or change focus (iter #8 second-tap
 *     contract: focused work stays focused while an overlay takes
 *     over).
 *   - Drag > TAP_THRESHOLD does not fire a tap, does not fire
 *     onSecondTap, and clears focus (caller's pan intent).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachGestureController, type GestureBindings } from "./gestures";

interface FakeCanvas {
  addEventListener: (
    type: string,
    listener: (e: PointerEvent) => void,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (e: PointerEvent) => void,
  ) => void;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  /** Drive a listener by type. Synthetic PointerEvent shape is enough — the controller only reads clientX/Y, pointerId. */
  _dispatch: (type: string, event: Partial<PointerEvent>) => void;
}

function makeFakeCanvas(): FakeCanvas {
  const listeners = new Map<string, Set<(e: PointerEvent) => void>>();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    setPointerCapture() {
      /* no-op */
    },
    releasePointerCapture() {
      /* no-op */
    },
    _dispatch(type, event) {
      const set = listeners.get(type);
      if (!set) return;
      for (const listener of set) {
        listener(event as PointerEvent);
      }
    },
  };
}

function mount(bindings: GestureBindings): {
  canvas: FakeCanvas;
  state: ReturnType<typeof attachGestureController>["state"];
  dispose: () => void;
} {
  const canvas = makeFakeCanvas();
  const { state, dispose } = attachGestureController(
    canvas as unknown as HTMLCanvasElement,
    bindings,
  );
  return { canvas, state, dispose };
}

// ---------- single-tap behaviour --------------------------------

describe("attachGestureController — tap on empty space", () => {
  it("clears focus when tap lands on nothing", () => {
    const { canvas, state, dispose } = mount({
      hitTest: () => null,
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.equal(state.focusWorkId, null);
    dispose();
  });
});

describe("attachGestureController — tap on a work", () => {
  it("sets focus to the tapped work when nothing is focused", () => {
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
    });
    assert.equal(state.focusWorkId, null);

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.equal(state.focusWorkId, "work-a");
    dispose();
  });

  it("moves focus to a different work when already focused on another", () => {
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-b",
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.equal(state.focusWorkId, "work-b");
    dispose();
  });
});

// ---------- second-tap behaviour --------------------------------

describe("attachGestureController — second tap on focused work", () => {
  it("fires onSecondTap with the work id, keeps focus", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
      onSecondTap: (id) => secondTapCalls.push(id),
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.deepEqual(secondTapCalls, ["work-a"]);
    assert.equal(
      state.focusWorkId,
      "work-a",
      "focus must survive the second tap — the overlay takes over, Escape returns here",
    );
    dispose();
  });

  it("does not fire onSecondTap when the tap lands on a different work", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-b",
      onSecondTap: (id) => secondTapCalls.push(id),
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.deepEqual(secondTapCalls, []);
    assert.equal(state.focusWorkId, "work-b");
    dispose();
  });

  it("does not fire onSecondTap when the tap lands on empty space", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => null,
      onSecondTap: (id) => secondTapCalls.push(id),
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.deepEqual(secondTapCalls, []);
    assert.equal(state.focusWorkId, null);
    dispose();
  });

  it("does not fire onSecondTap when nothing is focused (first tap always sets focus)", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
      onSecondTap: (id) => secondTapCalls.push(id),
    });

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    assert.deepEqual(secondTapCalls, []);
    assert.equal(state.focusWorkId, "work-a");
    dispose();
  });

  it("is a no-op when onSecondTap is unbound (optional binding survives)", () => {
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 10, clientY: 10 });

    // No throw; focus untouched.
    assert.equal(state.focusWorkId, "work-a");
    dispose();
  });
});

// ---------- drag behaviour --------------------------------------

describe("attachGestureController — drag past tap threshold", () => {
  it("clears focus and does not fire onSecondTap", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
      onSecondTap: (id) => secondTapCalls.push(id),
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    // Move well past TAP_THRESHOLD_PX (=8).
    canvas._dispatch("pointermove", { pointerId: 1, clientX: 100, clientY: 10 });
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 100, clientY: 10 });

    assert.deepEqual(secondTapCalls, []);
    assert.equal(state.focusWorkId, null, "drag clears focus");
    dispose();
  });

  it("small jitter (< threshold) still counts as a tap", () => {
    const secondTapCalls: string[] = [];
    const { canvas, state, dispose } = mount({
      hitTest: () => "work-a",
      onSecondTap: (id) => secondTapCalls.push(id),
    });
    state.focusWorkId = "work-a";

    canvas._dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    canvas._dispatch("pointermove", { pointerId: 1, clientX: 13, clientY: 12 }); // dist ≈ 3.6 < 8
    canvas._dispatch("pointerup", { pointerId: 1, clientX: 13, clientY: 12 });

    assert.deepEqual(secondTapCalls, ["work-a"]);
    assert.equal(state.focusWorkId, "work-a");
    dispose();
  });
});
