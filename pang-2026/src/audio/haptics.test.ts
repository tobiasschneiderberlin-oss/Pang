/**
 * PANG — haptic dispatcher tests (iter #15).
 *
 * Suppression-chain coverage. Every path short-circuits in order:
 *
 *   1. vocabulary guard (belt + suspenders for a `(x as any)` escape)
 *   2. preferences.haptics === "off"
 *   3. navigator.vibrate missing
 *   4. prefers-reduced-motion with no motion=full override
 *   5. fire
 *
 * The DOM stubs are minimal — `navigator.vibrate` is a spy, the media
 * query listener is a stub with a live `matches` boolean, and
 * `document.documentElement.dataset` lives on the real DOM because
 * Node's test runner does not provide one. For the motion-override
 * case we reach for a tiny DOM polyfill.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  HAPTIC_PATTERNS,
  hapticsSupported,
  resetHapticsForTests,
  triggerHaptic,
} from "./haptics";
import {
  getHapticCounters,
  resetAudioTelemetry,
} from "./telemetry";
import { usePreferences, DEFAULT_PREFERENCES } from "@design/preferences";

// ---------- DOM stub helpers ----------------------------------------

interface VibrateCall {
  readonly pattern: number | readonly number[];
}

function installVibrateSpy(): VibrateCall[] {
  const calls: VibrateCall[] = [];
  const nav = globalThis.navigator as unknown as {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  nav.vibrate = (pattern: number | number[]): boolean => {
    calls.push({ pattern });
    return true;
  };
  return calls;
}

function removeVibrate(): void {
  const nav = globalThis.navigator as unknown as {
    vibrate?: unknown;
  };
  delete nav.vibrate;
}

function stubMatchMedia(matches: boolean): void {
  (globalThis as unknown as { window?: unknown }).window ??= globalThis;
  (globalThis as unknown as { document?: unknown }).document ??= {
    documentElement: { dataset: {} },
  };
  (globalThis.window as unknown as Window).matchMedia = ((
    _q: string,
  ): MediaQueryList =>
    ({
      matches,
      media: _q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as Window["matchMedia"];
}

function setMotionExplicit(value: "full" | null): void {
  (globalThis as unknown as { document?: unknown }).document ??= {
    documentElement: { dataset: {} },
  };
  const doc = globalThis.document as unknown as {
    documentElement: { dataset: Record<string, string> };
  };
  if (value === null) {
    delete doc.documentElement.dataset["motionExplicit"];
  } else {
    doc.documentElement.dataset["motionExplicit"] = value;
  }
}

// ---------- Setup ---------------------------------------------------

beforeEach(() => {
  usePreferences.setState({ ...DEFAULT_PREFERENCES });
  resetHapticsForTests();
  resetAudioTelemetry();
  removeVibrate();
  stubMatchMedia(false);
  setMotionExplicit(null);
});

// ---------- Vocabulary ----------------------------------------------

describe("HAPTIC_PATTERNS", () => {
  it("is frozen at the module + inner-array level", () => {
    assert.equal(Object.isFrozen(HAPTIC_PATTERNS), true);
    for (const v of Object.values(HAPTIC_PATTERNS)) {
      assert.equal(Object.isFrozen(v), true);
    }
  });

  it("carries exactly four reserved kinds", () => {
    assert.deepEqual(
      Object.keys(HAPTIC_PATTERNS).sort(),
      ["arrive", "capture", "focus", "tap"].sort(),
    );
  });
});

describe("triggerHaptic — runtime vocabulary guard", () => {
  it("returns false for a string not in the vocabulary", () => {
    // Pref "on" + vibrate present → otherwise it would pass.
    usePreferences.setState({ haptics: "on" });
    installVibrateSpy();
    const result = triggerHaptic("nope" as unknown as "tap");
    assert.equal(result, false);
    assert.equal(getHapticCounters().attempted, 0);
  });
});

// ---------- Suppression chain ---------------------------------------

describe("triggerHaptic — preferences off", () => {
  it("returns false and counts off", () => {
    usePreferences.setState({ haptics: "off" });
    installVibrateSpy();
    assert.equal(triggerHaptic("tap"), false);
    assert.equal(getHapticCounters().suppressedByReason.off, 1);
  });
});

describe("triggerHaptic — unsupported platform", () => {
  it("counts unsupported once per session, suppressed-unsupported every call", () => {
    usePreferences.setState({ haptics: "on" });
    removeVibrate();
    assert.equal(triggerHaptic("tap"), false);
    assert.equal(triggerHaptic("focus"), false);
    const c = getHapticCounters();
    assert.equal(c.unsupported, 1);
    assert.equal(c.suppressedByReason.unsupported, 2);
  });
});

describe("triggerHaptic — reduced-motion (no override)", () => {
  it("returns false and counts reduced-motion", () => {
    usePreferences.setState({ haptics: "on" });
    installVibrateSpy();
    stubMatchMedia(true);
    setMotionExplicit(null);
    assert.equal(triggerHaptic("tap"), false);
    assert.equal(
      getHapticCounters().suppressedByReason["reduced-motion"],
      1,
    );
  });

  it("fires when data-motion-explicit=full overrides the media query", () => {
    usePreferences.setState({ haptics: "on" });
    const calls = installVibrateSpy();
    stubMatchMedia(true);
    setMotionExplicit("full");
    assert.equal(triggerHaptic("tap"), true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.pattern, HAPTIC_PATTERNS.tap);
  });
});

describe("triggerHaptic — fire path", () => {
  it("invokes navigator.vibrate with the matching pattern", () => {
    usePreferences.setState({ haptics: "on" });
    stubMatchMedia(false);
    const calls = installVibrateSpy();
    assert.equal(triggerHaptic("capture"), true);
    assert.equal(triggerHaptic("arrive"), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0]!.pattern, HAPTIC_PATTERNS.capture);
    assert.deepEqual(calls[1]!.pattern, HAPTIC_PATTERNS.arrive);
    assert.equal(getHapticCounters().attempted, 2);
  });

  it("swallows a vibrate throw and still counts attempted", () => {
    usePreferences.setState({ haptics: "on" });
    stubMatchMedia(false);
    const nav = globalThis.navigator as unknown as {
      vibrate?: () => boolean;
    };
    nav.vibrate = (): boolean => {
      throw new Error("embedded webview refusal");
    };
    assert.equal(triggerHaptic("focus"), false);
    assert.equal(getHapticCounters().attempted, 1);
  });
});

// ---------- Capability probe ----------------------------------------

describe("hapticsSupported", () => {
  it("returns true when navigator.vibrate is a function", () => {
    installVibrateSpy();
    resetHapticsForTests();
    assert.equal(hapticsSupported(), true);
  });

  it("returns false when navigator.vibrate is absent", () => {
    removeVibrate();
    resetHapticsForTests();
    assert.equal(hapticsSupported(), false);
  });
});
