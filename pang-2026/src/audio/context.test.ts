/**
 * PANG — AudioContext factory tests (iter #15, primitive 71).
 *
 * "acoustic-body-as-opt-in" — no AudioContext is constructed until
 * (a) the preference is on AND (b) a user gesture has been recorded.
 *
 * The tests run under Node without a real Web Audio implementation;
 * we install a constructor stub on `window.AudioContext` that records
 * every construction call and exposes a tiny `close()` / `suspend()`
 * API. The factory's import of `window` resolves to `globalThis`
 * because we hoist a minimal browser shim in `beforeEach`.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAudioContext,
  peekAudioContext,
  recordUserGesture,
  closeAudioContext,
  resetAudioContextFactory,
} from "./context";
import { usePreferences, DEFAULT_PREFERENCES } from "@design/preferences";
import {
  getAudioCounters,
  resetAudioTelemetry,
} from "./telemetry";

// ---------- AudioContext stub ---------------------------------------

interface StubCtx {
  state: "running" | "suspended" | "closed";
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

interface StubTracker {
  constructions: number;
  closeCalls: number;
  lastInstance: StubCtx | null;
  initialState: "running" | "suspended";
}

const tracker: StubTracker = {
  constructions: 0,
  closeCalls: 0,
  lastInstance: null,
  initialState: "running",
};

function makeCtx(): StubCtx {
  const c: StubCtx = {
    state: tracker.initialState,
    async suspend() {
      c.state = "suspended";
    },
    async resume() {
      c.state = "running";
    },
    async close() {
      c.state = "closed";
      tracker.closeCalls++;
    },
  };
  return c;
}

function installAudioContextStub(): void {
  // Factory checks `typeof window === "undefined"` and resolves
  // `AudioContext` through `window`. In Node we shim `window` to
  // `globalThis`.
  (globalThis as unknown as { window?: unknown }).window ??= globalThis;
  const w = globalThis as unknown as {
    AudioContext?: new () => StubCtx;
  };
  w.AudioContext = function StubAudioContext(): StubCtx {
    tracker.constructions++;
    const c = makeCtx();
    tracker.lastInstance = c;
    return c;
  } as unknown as new () => StubCtx;
}

function removeAudioContextStub(): void {
  const w = globalThis as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  delete w.AudioContext;
  delete w.webkitAudioContext;
}

beforeEach(() => {
  tracker.constructions = 0;
  tracker.closeCalls = 0;
  tracker.lastInstance = null;
  tracker.initialState = "running";
  resetAudioContextFactory();
  resetAudioTelemetry();
  usePreferences.setState({ ...DEFAULT_PREFERENCES });
  installAudioContextStub();
});

afterEach(() => {
  resetAudioContextFactory();
  removeAudioContextStub();
});

// ---------- Tests ---------------------------------------------------

describe("getAudioContext — silence-default", () => {
  it("returns null when audioSpatial is off, even with a gesture", () => {
    // DEFAULT_PREFERENCES.audioSpatial === "off".
    recordUserGesture();
    const ctx = getAudioContext();
    assert.equal(ctx, null);
    assert.equal(tracker.constructions, 0);
  });

  it("returns null when audioSpatial is on without a user gesture", () => {
    usePreferences.setState({ audioSpatial: "on" });
    const ctx = getAudioContext();
    assert.equal(ctx, null);
    assert.equal(tracker.constructions, 0);
  });
});

describe("getAudioContext — opt-in path", () => {
  it("constructs exactly once after preference + gesture; idempotent on repeat", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    const a = getAudioContext();
    const b = getAudioContext();
    assert.ok(a);
    assert.strictEqual(a, b);
    assert.equal(tracker.constructions, 1);
  });

  it("counts a construction that yields state=suspended as blocked", () => {
    tracker.initialState = "suspended";
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    getAudioContext();
    assert.equal(getAudioCounters().blocked, 1);
  });
});

describe("peekAudioContext", () => {
  it("returns null until the factory has constructed", () => {
    assert.equal(peekAudioContext(), null);
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    getAudioContext();
    assert.ok(peekAudioContext());
  });
});

describe("preference flip to off", () => {
  it("closes the context + nulls the module state", async () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    getAudioContext();
    assert.ok(peekAudioContext());

    usePreferences.setState({ audioSpatial: "off" });
    // The subscription fires synchronously; the close is async but
    // we only need peek to be null for the spec.
    // Await a microtask so the .then() chain in the factory runs.
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(peekAudioContext(), null);
    assert.equal(tracker.closeCalls, 1);
  });
});

describe("closeAudioContext — explicit unmount path", () => {
  it("nulls state + calls close on the stubbed context", async () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    getAudioContext();
    assert.ok(peekAudioContext());

    closeAudioContext("unmount");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(peekAudioContext(), null);
    assert.equal(tracker.closeCalls, 1);
  });

  it("is idempotent — no throw when nothing constructed", () => {
    assert.doesNotThrow(() => closeAudioContext("unmount"));
  });
});

describe("platform-missing AudioContext", () => {
  it("returns null and counts blocked if construction throws", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    const w = globalThis as unknown as {
      AudioContext: new () => StubCtx;
    };
    w.AudioContext = function FailingCtor(): StubCtx {
      throw new Error("device busy");
    } as unknown as new () => StubCtx;
    const ctx = getAudioContext();
    assert.equal(ctx, null);
    assert.equal(getAudioCounters().blocked, 1);
  });

  it("returns null when Web Audio is absent entirely", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    removeAudioContextStub();
    assert.equal(getAudioContext(), null);
  });
});
