/**
 * PANG — chapter driver tests.
 *
 * Locks the contract between the planner and the UI:
 *
 *   - `activeBeats(plan, tMs)` returns the beats whose envelope is
 *     > 0 at `tMs`, each annotated with envelope + progress.
 *   - `findBeatByKind` returns the first beat of a kind, or null.
 *   - `isReady(plan, tMs)` becomes true exactly at the ready beat's
 *     start and stays true.
 *   - `diffActiveBeats` reports the id-set edge deltas between two
 *     ticks — used to emit enter/exit observability events exactly
 *     once per edge.
 *   - `ariaLineForActive` collapses the active set to a single
 *     announceable string (or null for camera/pose-only ticks).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IntakeOutput } from "@/ai/tools/artwork";
import {
  activeBeats,
  ariaLineForActive,
  diffActiveBeats,
  findBeatByKind,
  isReady,
} from "./driver";
import { planChapter } from "./plan";
import type { ActiveBeat, Beat } from "./types";

function intakeFull(): IntakeOutput {
  return {
    artwork: {
      artist: "Joan Mitchell",
      title: "Untitled",
      year: 1973,
      medium: "oil on canvas",
      dimensionsCm: { h: 120, w: 100 },
      confidenceBySource: {
        artist: 0.9,
        title: 0.5,
        year: 0.8,
        medium: 0.85,
        dimensions: 0.6,
      },
    },
    artistContext: {
      nationality: "American",
      birthYear: 1925,
      bioMuji: "American painter. Abstract expressionist.",
      bannedVocabularyDetected: false,
    },
    galleryOfOrigin: {
      galleryId: "droste-berlin",
      galleryName: "Galerie Droste, Berlin",
      detectedFrom: "email",
      confidence: 0.9,
    },
    documents: [
      {
        type: "coa",
        fileRef: "docs/coa.pdf",
        extractedFields: { "issued by": "Galerie Droste" },
      },
    ],
    arrivalLine: "Oil on canvas, 1973. On the wall.",
  };
}

function intakeNull(): IntakeOutput {
  return {
    artwork: {
      artist: null,
      title: null,
      year: null,
      medium: null,
      dimensionsCm: null,
      confidenceBySource: {
        artist: 0.1,
        title: 0.1,
        year: 0,
        medium: 0.1,
        dimensions: 0,
      },
    },
    artistContext: {
      nationality: null,
      birthYear: null,
      bioMuji: null,
      bannedVocabularyDetected: false,
    },
    galleryOfOrigin: {
      galleryId: null,
      galleryName: null,
      detectedFrom: null,
      confidence: 0,
    },
    documents: [],
    arrivalLine: "On the wall. Unverified.",
  };
}

// ---- activeBeats ---------------------------------------------------

describe("activeBeats", () => {
  it("returns only the approach beat at t=0 envelope terms", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    // t=0: approach just started; all other beats are strictly in
    // the future. Envelope at t=0 is 0 for the approach (rate-6 rise
    // starts from 0), so no beats are yet "active" (envelope > 0).
    const active = activeBeats(plan, 0);
    assert.equal(active.length, 0);
  });

  it("approach is active by the time its rise is underway", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const active = activeBeats(plan, 300);
    assert.equal(active.length, 1);
    assert.equal(active[0]!.beat.id, "approach");
    assert.ok(active[0]!.envelope > 0);
    assert.ok(active[0]!.envelope < 1);
  });

  it("reports overlapping beats (narration rides approach)", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    // Narration starts at 2000, approach ends at 3000. Between
    // 2000–3000 both should be active.
    const active = activeBeats(plan, 2500);
    const ids = active.map((a) => a.beat.id).sort();
    assert.ok(ids.includes("approach"));
    assert.ok(ids.includes("narration"));
  });

  it("excludes beats strictly before startMs", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const active = activeBeats(plan, 500);
    for (const a of active) {
      assert.ok(a.beat.startMs <= 500);
    }
  });

  it("excludes beats at or after endMs", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    // Approach ends at 3000 — at that exact ms its envelope is 0.
    const active = activeBeats(plan, 3000);
    assert.ok(!active.some((a) => a.beat.id === "approach"));
  });

  it("includes envelope and progress for each active beat", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const active = activeBeats(plan, 2500);
    for (const a of active) {
      assert.ok(a.envelope > 0 && a.envelope <= 1);
      assert.ok(a.progress >= 0 && a.progress <= 1);
    }
  });

  it("eventually enters the ready beat", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    // A bit past the ready point — ready's fade-in is 900ms, so
    // +500ms gives a partial but positive envelope.
    const active = activeBeats(plan, plan.readyAtMs + 500);
    const ready = active.find((a) => a.beat.kind === "ready");
    assert.ok(ready, "ready beat not active past readyAtMs");
    assert.ok(ready!.envelope > 0);
  });
});

// ---- findBeatByKind -----------------------------------------------

describe("findBeatByKind", () => {
  it("returns the first matching beat", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const narration = findBeatByKind(plan, "narration");
    assert.ok(narration);
    assert.equal(narration!.kind, "narration");
  });

  it("returns null for a kind not present", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    assert.equal(findBeatByKind(plan, "null-reflection"), null);
  });

  it("returns null-reflection beat in null state", () => {
    const plan = planChapter(intakeNull(), "w-1", "blob:");
    const ref = findBeatByKind(plan, "null-reflection");
    assert.ok(ref);
  });
});

// ---- isReady -------------------------------------------------------

describe("isReady", () => {
  it("is false before readyAtMs", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    assert.equal(isReady(plan, 0), false);
    assert.equal(isReady(plan, plan.readyAtMs - 1), false);
  });

  it("is true at and after readyAtMs", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    assert.equal(isReady(plan, plan.readyAtMs), true);
    assert.equal(isReady(plan, plan.readyAtMs + 10_000), true);
  });
});

// ---- diffActiveBeats ----------------------------------------------

describe("diffActiveBeats", () => {
  function makeActive(id: string): ActiveBeat {
    const beat: Beat = {
      id,
      kind: "pause",
      startMs: 0,
      durationMs: 1000,
      fadeInMs: 100,
      fadeOutMs: 100,
    };
    return { beat, envelope: 1, progress: 0.5 };
  }

  it("reports all currently-active ids as entered on the first call", () => {
    const prev = new Set<string>();
    const curr = [makeActive("a"), makeActive("b")];
    const { entered, exited } = diffActiveBeats(prev, curr);
    assert.deepEqual([...entered].sort(), ["a", "b"]);
    assert.deepEqual(exited, []);
  });

  it("reports no change when the set is stable", () => {
    const prev = new Set(["a", "b"]);
    const curr = [makeActive("a"), makeActive("b")];
    const { entered, exited } = diffActiveBeats(prev, curr);
    assert.deepEqual(entered, []);
    assert.deepEqual(exited, []);
  });

  it("reports exactly the id that entered", () => {
    const prev = new Set(["a"]);
    const curr = [makeActive("a"), makeActive("b")];
    const { entered, exited } = diffActiveBeats(prev, curr);
    assert.deepEqual(entered, ["b"]);
    assert.deepEqual(exited, []);
  });

  it("reports exactly the id that exited", () => {
    const prev = new Set(["a", "b"]);
    const curr = [makeActive("b")];
    const { entered, exited } = diffActiveBeats(prev, curr);
    assert.deepEqual(entered, []);
    assert.deepEqual(exited, ["a"]);
  });

  it("reports both sides across a transition", () => {
    const prev = new Set(["a"]);
    const curr = [makeActive("b")];
    const { entered, exited } = diffActiveBeats(prev, curr);
    assert.deepEqual(entered, ["b"]);
    assert.deepEqual(exited, ["a"]);
  });
});

// ---- ariaLineForActive --------------------------------------------

describe("ariaLineForActive", () => {
  function synth(
    id: string,
    payload: Beat["payload"] | undefined,
    envelope = 1,
    progress = 0.5,
    fadeInMs = 200,
    durationMs = 2000,
  ): ActiveBeat {
    // `exactOptionalPropertyTypes` refuses `{ payload: undefined }` —
    // the field must be absent for payload-less beats. Build the
    // beat conditionally so the shape is exact.
    const beat: Beat = payload
      ? {
          id,
          kind: "pause",
          startMs: 0,
          durationMs,
          fadeInMs,
          fadeOutMs: 200,
          payload,
        }
      : {
          id,
          kind: "pause",
          startMs: 0,
          durationMs,
          fadeInMs,
          fadeOutMs: 200,
        };
    return { beat, envelope, progress };
  }

  it("returns null when nothing is active", () => {
    assert.equal(ariaLineForActive([]), null);
  });

  it("returns the text from a text payload", () => {
    const a = synth("x", { kind: "text", text: "hello wall", source: "ai" });
    assert.equal(ariaLineForActive([a]), "hello wall");
  });

  it("renders an artifact payload with its label", () => {
    const a = synth("x", {
      kind: "artifact",
      artifact: {
        id: "coa/0",
        kind: "coa",
        label: "certificate of authenticity",
        fields: [],
        fileRef: null,
        mime: null,
      },
    });
    assert.equal(
      ariaLineForActive([a]),
      "A certificate of authenticity has arrived.",
    );
  });

  it("renders an attribution payload with the gallery name", () => {
    const a = synth("x", { kind: "attribution", galleryName: "Galerie Droste" });
    assert.equal(ariaLineForActive([a]), "Recorded from Galerie Droste.");
  });

  it("renders a context payload's label", () => {
    const a = synth("x", {
      kind: "context",
      label: "About the artist.",
      body: "—",
    });
    assert.equal(ariaLineForActive([a]), "About the artist.");
  });

  it("returns null for a camera-only tick (not announceable)", () => {
    const a = synth("x", { kind: "camera" });
    assert.equal(ariaLineForActive([a]), null);
  });

  it("returns null for a pose-only tick (not announceable)", () => {
    const a = synth("x", { kind: "pose" });
    assert.equal(ariaLineForActive([a]), null);
  });

  it("prefers the rising beat when multiple are active", () => {
    // A rising narration stacked on a held camera beat. The ARIA
    // line should speak the narration, not the silent camera.
    const camera = synth("cam", { kind: "camera" }, 1, 0.5, 200, 3000);
    // Envelope mid-rise, progress < fadeInMs / durationMs → classified
    // as rising.
    const narration = synth(
      "nar",
      { kind: "text", text: "the work lands", source: "ai" },
      0.4,
      0.05, // 100ms into a 2000ms beat with 200ms fade = progress 0.05 < 0.1
      200,
      2000,
    );
    assert.equal(ariaLineForActive([camera, narration]), "the work lands");
  });

  it("falls back to the last active beat when none are rising", () => {
    const camera = synth("cam", { kind: "camera" }, 1, 0.5);
    const narration = synth(
      "nar",
      { kind: "text", text: "settled text", source: "ai" },
      1,
      0.5,
    );
    // Neither is rising (envelope=1). Last wins.
    assert.equal(ariaLineForActive([camera, narration]), "settled text");
  });
});
