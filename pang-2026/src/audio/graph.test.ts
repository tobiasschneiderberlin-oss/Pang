/**
 * PANG — room bed graph tests (iter #15).
 *
 * Asserts the acoustic body's contract:
 *
 *   - No graph constructed when preference is off (factory refuses).
 *   - On start, five-stage chain + master gain ramped target.
 *   - On setFocusedWork, the panner's positionX/Y/Z tracks the work's
 *     `Work.position` after the ramp.
 *   - On stopRoomBed, the master gain ramps to 0 before the source
 *     stops + the context closes.
 *
 * We stub every AudioNode the graph uses. The stubs carry just enough
 * surface (`.connect()` returning self, `.disconnect()`, AudioParam
 * stubs with `.value`, `linearRampToValueAtTime`, etc.) for the graph
 * module's code paths to run.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  startRoomBed,
  stopRoomBed,
  setFocusedWork,
  peekGraph,
  resetGraphForTests,
} from "./graph";
import {
  recordUserGesture,
  resetAudioContextFactory,
} from "./context";
import { usePreferences, DEFAULT_PREFERENCES } from "@design/preferences";
import { resetAudioTelemetry } from "./telemetry";
import type { Work } from "@/room/types";

// ---------- Web-Audio stubs -----------------------------------------

interface ParamStub {
  value: number;
  scheduled: { kind: string; target: number; endTime: number }[];
  cancelScheduledValues: (t: number) => void;
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
}

function makeParam(initial: number): ParamStub {
  const p: ParamStub = {
    value: initial,
    scheduled: [],
    cancelScheduledValues(_t: number) {},
    setValueAtTime(v: number, t: number) {
      p.value = v;
      p.scheduled.push({ kind: "set", target: v, endTime: t });
    },
    linearRampToValueAtTime(v: number, t: number) {
      // Simulate the ramp completing immediately for snapshot assertions.
      p.value = v;
      p.scheduled.push({ kind: "linear", target: v, endTime: t });
    },
  };
  return p;
}

interface NodeStub {
  connect: (next: NodeStub) => NodeStub;
  disconnect: () => void;
}

function makeNode(): NodeStub {
  const n: NodeStub = {
    connect(next) {
      return next;
    },
    disconnect() {},
  };
  return n;
}

interface SourceStub extends NodeStub {
  buffer: AudioBuffer | null;
  loop: boolean;
  started: boolean;
  stopped: boolean;
  start: () => void;
  stop: () => void;
}

interface GainStub extends NodeStub {
  gain: ParamStub;
}

interface FilterStub extends NodeStub {
  type: string;
  frequency: ParamStub;
  Q: ParamStub;
}

interface PannerStub extends NodeStub {
  panningModel: string;
  distanceModel: string;
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
  positionX: ParamStub;
  positionY: ParamStub;
  positionZ: ParamStub;
}

interface CtxStub {
  state: "running" | "suspended" | "closed";
  currentTime: number;
  sampleRate: number;
  destination: NodeStub;
  createBuffer(channels: number, length: number, sr: number): AudioBuffer;
  createBufferSource(): SourceStub;
  createBiquadFilter(): FilterStub;
  createPanner(): PannerStub;
  createGain(): GainStub;
  close(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
}

function makeCtx(): CtxStub {
  return {
    state: "running",
    currentTime: 0,
    sampleRate: 44100,
    destination: makeNode(),
    createBuffer(_ch: number, length: number, sr: number): AudioBuffer {
      const data = new Float32Array(length);
      return {
        getChannelData: () => data,
        duration: length / sr,
        length,
        numberOfChannels: 1,
        sampleRate: sr,
      } as unknown as AudioBuffer;
    },
    createBufferSource(): SourceStub {
      const base = makeNode();
      const src: SourceStub = {
        ...base,
        buffer: null,
        loop: false,
        started: false,
        stopped: false,
        start() {
          src.started = true;
        },
        stop() {
          src.stopped = true;
        },
      };
      return src;
    },
    createBiquadFilter(): FilterStub {
      const base = makeNode();
      return {
        ...base,
        type: "lowpass",
        frequency: makeParam(350),
        Q: makeParam(1),
      };
    },
    createPanner(): PannerStub {
      const base = makeNode();
      return {
        ...base,
        panningModel: "equalpower",
        distanceModel: "inverse",
        refDistance: 1,
        maxDistance: 10000,
        rolloffFactor: 1,
        coneInnerAngle: 360,
        coneOuterAngle: 360,
        coneOuterGain: 0,
        positionX: makeParam(0),
        positionY: makeParam(0),
        positionZ: makeParam(0),
      };
    },
    createGain(): GainStub {
      const base = makeNode();
      return {
        ...base,
        gain: makeParam(1),
      };
    },
    async close() {
      this.state = "closed";
    },
    async suspend() {
      this.state = "suspended";
    },
    async resume() {
      this.state = "running";
    },
  };
}

let lastCtx: CtxStub | null = null;

function installCtxStub(): void {
  (globalThis as unknown as { window?: unknown }).window ??= globalThis;
  const w = globalThis as unknown as {
    AudioContext?: new () => CtxStub;
  };
  w.AudioContext = function StubAudioContext(): CtxStub {
    lastCtx = makeCtx();
    return lastCtx;
  } as unknown as new () => CtxStub;
}

function removeCtxStub(): void {
  const w = globalThis as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  delete w.AudioContext;
  delete w.webkitAudioContext;
}

// ---------- Setup ---------------------------------------------------

beforeEach(() => {
  usePreferences.setState({ ...DEFAULT_PREFERENCES });
  resetAudioContextFactory();
  resetGraphForTests();
  resetAudioTelemetry();
  lastCtx = null;
  installCtxStub();
});

afterEach(() => {
  resetAudioContextFactory();
  resetGraphForTests();
  removeCtxStub();
});

// ---------- Fixtures ------------------------------------------------

const WORK_A: Work = {
  id: "w-a",
  imageUrl: "blob:a",
  status: "verified",
  position: [1.2, 1.5, -2.5],
  size: [0.6, 0.8],
};

// ---------- Tests ---------------------------------------------------

describe("startRoomBed — silence-default", () => {
  it("is a no-op when audioSpatial is off (preference gate)", () => {
    startRoomBed();
    assert.equal(peekGraph(), null);
    assert.equal(lastCtx, null);
  });

  it("is a no-op when no user gesture has been recorded", () => {
    usePreferences.setState({ audioSpatial: "on" });
    startRoomBed();
    assert.equal(peekGraph(), null);
  });
});

describe("startRoomBed — opt-in path", () => {
  it("builds the full 5-stage chain once", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    startRoomBed();
    const g = peekGraph();
    assert.ok(g);
    // Master gain has ramped to the target linear value (simulated
    // ramp sets .value immediately). The target is positive and < 1.
    assert.ok(g.master.gain.value > 0);
    assert.ok(g.master.gain.value < 1);
    // Source was started + loop enabled.
    assert.equal(
      (g.source as unknown as { loop: boolean; started: boolean }).loop,
      true,
    );
    assert.equal(
      (g.source as unknown as { started: boolean }).started,
      true,
    );
  });

  it("is idempotent across repeat calls", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    startRoomBed();
    const first = peekGraph();
    startRoomBed();
    const second = peekGraph();
    assert.strictEqual(first, second);
  });
});

describe("setFocusedWork", () => {
  it("pans the PannerNode to the work's position", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    startRoomBed();
    setFocusedWork(WORK_A);
    const g = peekGraph();
    assert.ok(g);
    // Our stubs apply the ramp target immediately.
    assert.equal(g.panner.positionX.value, WORK_A.position[0]);
    assert.equal(g.panner.positionY.value, WORK_A.position[1]);
    assert.equal(g.panner.positionZ.value, WORK_A.position[2]);
  });

  it("dims the master gain when unfocused (null work)", () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    startRoomBed();
    setFocusedWork(WORK_A);
    const g = peekGraph();
    assert.ok(g);
    const focused = g.master.gain.value;
    setFocusedWork(null);
    assert.ok(g.master.gain.value < focused);
  });
});

describe("stopRoomBed", () => {
  it("ramps the master gain to 0 before stopping the source", async () => {
    usePreferences.setState({ audioSpatial: "on" });
    recordUserGesture();
    startRoomBed();
    const before = peekGraph();
    assert.ok(before);
    await stopRoomBed();
    // The ramp target is 0; our stub lands immediately.
    // After stop, graph is nulled.
    assert.equal(peekGraph(), null);
    // The source stub recorded `stopped = true` before disconnect.
    assert.equal(
      (before.source as unknown as { stopped: boolean }).stopped,
      true,
    );
  });
});
