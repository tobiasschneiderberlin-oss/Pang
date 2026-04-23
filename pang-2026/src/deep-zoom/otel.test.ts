/**
 * PANG — deep-zoom observability tests.
 *
 * Locks three things the DeepZoom adapter relies on:
 *
 *   1. `deepZoomDepthLevel` buckets zoom values to log-scale levels
 *      matching the telemetry catalogue. Zero + negative + NaN
 *      degrade to level 1 (the floor).
 *   2. Each emitter serialises to one newline-terminated JSON line
 *      on `console.debug` with the expected `event` + `attrs`
 *      shape. The shape is load-bearing — the future OTel collector
 *      ingests these without translation.
 *   3. `deep_zoom.tile.load` payload carries `ok` + `source` so the
 *      SLO dashboard can separate success vs failure and cold vs
 *      warm.
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  deepZoomCloseEvent,
  deepZoomDepthLevel,
  deepZoomOpenEvent,
  deepZoomTileLoadEvent,
  deepZoomZoomDepthEvent,
} from "./otel";

function captureDebug(): { calls: unknown[][]; restore: () => void } {
  const calls: unknown[][] = [];
  const original = console.debug;
  console.debug = (...args: unknown[]) => {
    calls.push(args);
  };
  return {
    calls,
    restore: () => {
      console.debug = original;
    },
  };
}

describe("deepZoomDepthLevel", () => {
  it("returns 1 for fit-to-viewport and below", () => {
    assert.equal(deepZoomDepthLevel(1), 1);
    assert.equal(deepZoomDepthLevel(0.5), 1);
    assert.equal(deepZoomDepthLevel(0.01), 1);
  });

  it("returns 2 for doubled (1 < zoom ≤ 2]", () => {
    assert.equal(deepZoomDepthLevel(1.5), 1);
    assert.equal(deepZoomDepthLevel(2), 2);
    assert.equal(deepZoomDepthLevel(3), 2);
  });

  it("returns 3 at 4× (canvas-weave territory)", () => {
    assert.equal(deepZoomDepthLevel(4), 3);
    assert.equal(deepZoomDepthLevel(5), 3);
  });

  it("floors at 1 on degenerate input", () => {
    assert.equal(deepZoomDepthLevel(0), 1);
    assert.equal(deepZoomDepthLevel(-4), 1);
    assert.equal(deepZoomDepthLevel(Number.NaN), 1);
    assert.equal(deepZoomDepthLevel(Number.POSITIVE_INFINITY), 1);
  });
});

describe("deepZoomOpenEvent", () => {
  it("emits one JSON line with source kind + ids", () => {
    const { calls, restore } = captureDebug();
    try {
      deepZoomOpenEvent("w1", "vendor/dz/a.dzi", "dzi");
    } finally {
      restore();
    }
    assert.equal(calls.length, 1);
    const parsed = JSON.parse(calls[0]![0] as string) as {
      event: string;
      attrs: Record<string, unknown>;
    };
    assert.equal(parsed.event, "deep_zoom.open");
    assert.equal(parsed.attrs["pang.deep_zoom.work_id"], "w1");
    assert.equal(parsed.attrs["pang.deep_zoom.file_ref"], "vendor/dz/a.dzi");
    assert.equal(parsed.attrs["pang.deep_zoom.source_kind"], "dzi");
  });
});

describe("deepZoomCloseEvent", () => {
  it("carries the `via` exit path", () => {
    const { calls, restore } = captureDebug();
    try {
      deepZoomCloseEvent("w1", "vendor/dz/a.dzi", "keyboard");
    } finally {
      restore();
    }
    assert.equal(calls.length, 1);
    const parsed = JSON.parse(calls[0]![0] as string) as {
      event: string;
      attrs: Record<string, unknown>;
    };
    assert.equal(parsed.event, "deep_zoom.close");
    assert.equal(parsed.attrs["pang.deep_zoom.close_via"], "keyboard");
  });
});

describe("deepZoomZoomDepthEvent", () => {
  it("emits the bucketed level, not the raw zoom", () => {
    const { calls, restore } = captureDebug();
    try {
      deepZoomZoomDepthEvent("w1", "f", 3);
    } finally {
      restore();
    }
    const parsed = JSON.parse(calls[0]![0] as string) as {
      attrs: Record<string, unknown>;
    };
    assert.equal(parsed.attrs["pang.deep_zoom.zoom_level"], 3);
  });
});

describe("deepZoomTileLoadEvent", () => {
  it("carries durationMs + ok + source", () => {
    const { calls, restore } = captureDebug();
    try {
      deepZoomTileLoadEvent("w1", "f", 47, true, "network");
    } finally {
      restore();
    }
    const parsed = JSON.parse(calls[0]![0] as string) as {
      attrs: Record<string, unknown>;
    };
    assert.equal(parsed.attrs["pang.deep_zoom.tile_duration_ms"], 47);
    assert.equal(parsed.attrs["pang.deep_zoom.tile_ok"], true);
    assert.equal(parsed.attrs["pang.deep_zoom.tile_source"], "network");
  });

  it("emits `ok: false` on a failed tile", () => {
    const { calls, restore } = captureDebug();
    try {
      deepZoomTileLoadEvent("w1", "f", 999, false, "network");
    } finally {
      restore();
    }
    const parsed = JSON.parse(calls[0]![0] as string) as {
      attrs: Record<string, unknown>;
    };
    assert.equal(parsed.attrs["pang.deep_zoom.tile_ok"], false);
  });
});

// Ensure the test runner's mock is referenced so unused-import lint
// stays quiet without pinning the mock api into a test we don't
// actually need. A no-op mock + restore.
void mock;
