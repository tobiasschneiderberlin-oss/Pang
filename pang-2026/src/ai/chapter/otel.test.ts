/**
 * PANG — chapter otel tests (iter #11 outcome additions).
 *
 * The outcome chapter's telemetry is load-bearing for the fifth
 * failure-mode declaration — "a regression must be visible *before* a
 * Laura-hands complaint." Each event kind is tested for attribute
 * shape; the frame-time summariser is tested for percentile
 * determinism across typical and edge-case sample shapes.
 *
 * The emitter writes to `console.debug` so tests swap it for a sink
 * and inspect the emitted payload directly.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  chapterOutcomePlanEvent,
  chapterOutcomeBeatEnterEvent,
  chapterOutcomeBeatExitEvent,
  chapterOutcomeReadyEvent,
  chapterOutcomeDismissEvent,
  chapterOutcomeSkippedEvent,
  chapterOutcomeFrameTimeEvent,
  summariseSamples,
} from "./otel";

type Payload = {
  readonly event: string;
  readonly t: number;
  readonly tChapterMs?: number;
  readonly attrs: Record<string, string | number | boolean | readonly string[]>;
};

const sink: Payload[] = [];
let originalDebug: typeof console.debug;

beforeEach(() => {
  sink.length = 0;
  originalDebug = console.debug;
  console.debug = (line: string) => {
    try {
      sink.push(JSON.parse(line) as Payload);
    } catch {
      // ignore lines that aren't JSON
    }
  };
});

afterEach(() => {
  console.debug = originalDebug;
});

describe("chapter.outcome.plan", () => {
  it("emits variant, workId, decidedAt, totalMs, beatCount", () => {
    chapterOutcomePlanEvent(
      "confirmation",
      "w-a",
      "2026-04-24T10:00:00.000Z",
      14000,
      6,
    );
    assert.equal(sink.length, 1);
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.plan");
    assert.equal(p.tChapterMs, 0);
    assert.equal(p.attrs["pang.chapter.variant"], "confirmation");
    assert.equal(p.attrs["pang.chapter.work_id"], "w-a");
    assert.equal(
      p.attrs["pang.chapter.decided_at"],
      "2026-04-24T10:00:00.000Z",
    );
    assert.equal(p.attrs["pang.chapter.total_ms"], 14000);
    assert.equal(p.attrs["pang.chapter.beat_count"], 6);
  });

  it("emits decline variant with the same schema", () => {
    chapterOutcomePlanEvent(
      "decline",
      "w-b",
      "2026-04-24T11:00:00.000Z",
      14000,
      5,
    );
    assert.equal(sink[0]!.attrs["pang.chapter.variant"], "decline");
  });
});

describe("chapter.outcome.beat_enter / beat_exit", () => {
  it("emits enter with beat id + kind + tChapterMs", () => {
    chapterOutcomeBeatEnterEvent(
      "confirmation",
      "w-a",
      "narration",
      "confirmation",
      1500,
    );
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.beat_enter");
    assert.equal(p.tChapterMs, 1500);
    assert.equal(p.attrs["pang.chapter.beat_id"], "narration");
    assert.equal(p.attrs["pang.chapter.beat_kind"], "confirmation");
  });

  it("emits exit with matching attribute schema", () => {
    chapterOutcomeBeatExitEvent(
      "decline",
      "w-b",
      "settle",
      "settle",
      14000,
    );
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.beat_exit");
    assert.equal(p.attrs["pang.chapter.variant"], "decline");
    assert.equal(p.attrs["pang.chapter.beat_kind"], "settle");
  });
});

describe("chapter.outcome.ready / dismiss", () => {
  it("emits ready with variant + workId", () => {
    chapterOutcomeReadyEvent("confirmation", "w-a", 14000);
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.ready");
    assert.equal(p.tChapterMs, 14000);
    assert.equal(p.attrs["pang.chapter.variant"], "confirmation");
  });

  it("emits dismiss with the activation modality", () => {
    chapterOutcomeDismissEvent("confirmation", "w-a", 15200, "keyboard");
    assert.equal(sink[0]!.attrs["pang.chapter.dismiss_via"], "keyboard");
  });
});

describe("chapter.outcome.skipped", () => {
  it("emits already-shown reason", () => {
    chapterOutcomeSkippedEvent("confirmation", "w-a", "already-shown");
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.skipped");
    assert.equal(p.attrs["pang.chapter.skip_reason"], "already-shown");
  });

  it("emits surface-not-room reason", () => {
    chapterOutcomeSkippedEvent("decline", "w-b", "surface-not-room");
    assert.equal(sink[0]!.attrs["pang.chapter.skip_reason"], "surface-not-room");
  });
});

describe("chapter.outcome.frame_time_ms", () => {
  it("does not emit for fewer than 2 samples", () => {
    chapterOutcomeFrameTimeEvent("confirmation", "w-a", []);
    chapterOutcomeFrameTimeEvent("confirmation", "w-a", [16.7]);
    assert.equal(sink.length, 0);
  });

  it("emits p50/p95/p99/mean/max for a typical 60fps run", () => {
    const samples = Array.from({ length: 840 }, () => 16.7);
    chapterOutcomeFrameTimeEvent("confirmation", "w-a", samples);
    assert.equal(sink.length, 1);
    const p = sink[0]!;
    assert.equal(p.event, "chapter.outcome.frame_time_ms");
    assert.equal(p.attrs["pang.chapter.frame_count"], 840);
    assert.equal(p.attrs["pang.chapter.frame_p50_ms"], 16.7);
    assert.equal(p.attrs["pang.chapter.frame_p95_ms"], 16.7);
    assert.equal(p.attrs["pang.chapter.frame_p99_ms"], 16.7);
  });

  it("surfaces a long-tail p99 spike", () => {
    // 98 cheap frames, two expensive outliers — with nearest-rank
    // percentile on n=100, p99 resolves to index 98 (ceil(99*100/100)-1);
    // the two outliers sit at indices 98 and 99, so p99 picks the first
    // outlier and `max` picks the second.
    const samples = [
      ...Array.from({ length: 98 }, () => 16.7),
      55,
      60,
    ];
    chapterOutcomeFrameTimeEvent("confirmation", "w-a", samples);
    const p = sink[0]!;
    assert.equal(p.attrs["pang.chapter.frame_p50_ms"], 16.7);
    assert.equal(p.attrs["pang.chapter.frame_max_ms"], 60);
    assert.equal(p.attrs["pang.chapter.frame_p99_ms"], 55);
  });
});

describe("summariseSamples (percentile primitive)", () => {
  it("picks nearest-rank percentiles on a sorted ramp", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    const s = summariseSamples(samples);
    assert.equal(s.p50, 50);
    assert.equal(s.p95, 95);
    assert.equal(s.p99, 99);
    assert.equal(s.max, 100);
    assert.equal(s.mean, 50.5);
  });

  it("is insensitive to input ordering", () => {
    const a = summariseSamples([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const b = summariseSamples([100, 50, 10, 90, 20, 80, 30, 70, 40, 60]);
    assert.deepEqual(a, b);
  });

  it("rounds to one decimal", () => {
    const s = summariseSamples([16.6667, 16.6667, 16.6667]);
    assert.equal(s.p50, 16.7);
    assert.equal(s.mean, 16.7);
  });
});
