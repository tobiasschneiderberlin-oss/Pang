/**
 * PANG — chapter planner tests.
 *
 * Locks the two shapes of the chapter:
 *
 *   - Full state (artifacts + gallery + context) — every beat present,
 *     in order, 30–45s total, no null-reflection.
 *   - Null state  (nothing extra)                — artifact procession
 *     replaced by null-reflection + second pause, still 30+ seconds.
 *
 * Plus the structural invariants every plan must satisfy (monotonic
 * starts, positive durations, the ready beat last, total matches the
 * cursor).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IntakeOutput } from "@/ai/tools/artwork";
import { planChapter } from "./plan";

// ---- fixtures ----------------------------------------------------

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
      bioMuji:
        "American painter. Second-generation abstract expressionist. Lived in France from 1959.",
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
        fileRef: "docs/coa-1.pdf",
        extractedFields: { "issued by": "Galerie Droste", "dated": "2004-05-12" },
      },
      {
        type: "invoice",
        fileRef: "docs/invoice-1.pdf",
        extractedFields: { "amount": "€48,000", "currency": "EUR" },
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
        medium: 0.2,
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

// ---- structural invariants ----------------------------------------

describe("planChapter — structural invariants", () => {
  for (const [label, input] of [
    ["full", intakeFull()],
    ["null", intakeNull()],
  ] as const) {
    it(`${label}: beats in non-decreasing start order`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      let prev = -1;
      for (const b of plan.beats) {
        assert.ok(
          b.startMs >= prev,
          `beat ${b.id} starts at ${b.startMs} after prev ${prev}`,
        );
        prev = b.startMs;
      }
    });

    it(`${label}: every beat has a positive duration`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      for (const b of plan.beats) {
        if (b.kind === "ready") continue; // effectively unbounded
        assert.ok(b.durationMs > 0, `beat ${b.id} duration ${b.durationMs}`);
      }
    });

    it(`${label}: fadeIn/Out fits within durationMs`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      for (const b of plan.beats) {
        if (b.kind === "ready") continue;
        assert.ok(
          b.fadeInMs >= 0 && b.fadeInMs <= b.durationMs,
          `fadeIn out of range: ${b.id}`,
        );
        assert.ok(
          b.fadeOutMs >= 0 && b.fadeOutMs <= b.durationMs,
          `fadeOut out of range: ${b.id}`,
        );
      }
    });

    it(`${label}: ready is the last beat`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      const last = plan.beats[plan.beats.length - 1]!;
      assert.equal(last.kind, "ready");
    });

    it(`${label}: totalMs equals ready's startMs`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      const ready = plan.beats.find((b) => b.kind === "ready")!;
      assert.equal(plan.totalMs, ready.startMs);
      assert.equal(plan.readyAtMs, ready.startMs);
    });

    it(`${label}: totalMs is within the 30–45s ceiling band`, () => {
      const plan = planChapter(input, "w-1", "blob:test");
      assert.ok(
        plan.totalMs >= 28_000 && plan.totalMs <= 45_000,
        `totalMs out of band: ${plan.totalMs}`,
      );
    });

    it(`${label}: workId + arrivalLine + workImageUrl are plumbed through`, () => {
      const plan = planChapter(input, "w-zed", "blob:abc");
      assert.equal(plan.workId, "w-zed");
      assert.equal(plan.workImageUrl, "blob:abc");
      assert.equal(plan.arrivalLine, input.arrivalLine);
    });
  }
});

// ---- shape selection ----------------------------------------------

describe("planChapter — full state shape", () => {
  it("plans artifact beats for each document up to the cap (3)", () => {
    const input = intakeFull();
    const many = {
      ...input,
      documents: [
        ...input.documents,
        ...input.documents,
        ...input.documents, // 6 docs total; cap is 3
      ],
    };
    const plan = planChapter(many, "w-1", "blob:");
    const artifactBeats = plan.beats.filter((b) => b.kind === "artifact");
    assert.equal(artifactBeats.length, 3);
    assert.equal(plan.shape.artifactCount, 3);
  });

  it("includes attribution beat when galleryName is present", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const attribution = plan.beats.find((b) => b.kind === "attribution");
    assert.ok(attribution, "attribution beat missing");
    const p = attribution!.payload;
    assert.ok(p && p.kind === "attribution");
    if (p.kind === "attribution") {
      assert.equal(p.galleryName, "Galerie Droste, Berlin");
    }
  });

  it("includes context beat when bioMuji is present", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const context = plan.beats.find((b) => b.kind === "context");
    assert.ok(context, "context beat missing");
    assert.equal(plan.shape.hasContext, true);
  });

  it("does not include a null-reflection beat in the full state", () => {
    const plan = planChapter(intakeFull(), "w-1", "blob:");
    const nullRef = plan.beats.find((b) => b.kind === "null-reflection");
    assert.equal(nullRef, undefined);
    assert.equal(plan.shape.hasNullReflection, false);
  });
});

describe("planChapter — null state shape", () => {
  it("has no artifact / attribution / context beats", () => {
    const plan = planChapter(intakeNull(), "w-1", "blob:");
    assert.equal(plan.beats.find((b) => b.kind === "artifact"), undefined);
    assert.equal(plan.beats.find((b) => b.kind === "attribution"), undefined);
    assert.equal(plan.beats.find((b) => b.kind === "context"), undefined);
  });

  it("includes a null-reflection beat", () => {
    const plan = planChapter(intakeNull(), "w-1", "blob:");
    const nullRef = plan.beats.find((b) => b.kind === "null-reflection");
    assert.ok(nullRef, "null-reflection beat missing");
    assert.equal(plan.shape.hasNullReflection, true);
  });

  it("null state still sits at or above the 28s floor", () => {
    const plan = planChapter(intakeNull(), "w-1", "blob:");
    assert.ok(plan.totalMs >= 28_000);
  });

  it("narration beat still carries the arrivalLine", () => {
    const plan = planChapter(intakeNull(), "w-1", "blob:");
    const narration = plan.beats.find((b) => b.kind === "narration")!;
    const p = narration.payload;
    assert.ok(p && p.kind === "text");
    if (p.kind === "text") {
      assert.equal(p.text, "On the wall. Unverified.");
      assert.equal(p.source, "ai");
    }
  });
});

describe("planChapter — partial states", () => {
  it("gallery-only: attribution present, context + null-reflection absent", () => {
    const input = { ...intakeNull() };
    input.galleryOfOrigin = {
      galleryId: "g-1",
      galleryName: "Gallery One",
      detectedFrom: "visual",
      confidence: 0.5,
    };
    const plan = planChapter(input, "w-1", "blob:");
    assert.ok(plan.beats.find((b) => b.kind === "attribution"));
    assert.equal(plan.beats.find((b) => b.kind === "context"), undefined);
    assert.equal(plan.beats.find((b) => b.kind === "null-reflection"), undefined);
  });

  it("context-only: context present, null-reflection absent", () => {
    const input = { ...intakeNull() };
    input.artistContext = {
      ...input.artistContext,
      bioMuji: "Born 1940. Works in acrylic and collage.",
    };
    const plan = planChapter(input, "w-1", "blob:");
    assert.ok(plan.beats.find((b) => b.kind === "context"));
    assert.equal(plan.beats.find((b) => b.kind === "null-reflection"), undefined);
  });

  it("artifact-only: artifact beats present, null-reflection absent", () => {
    const input = { ...intakeNull() };
    input.documents = [
      {
        type: "coa",
        fileRef: "docs/coa.pdf",
        extractedFields: { "issued": "1999" },
      },
    ];
    const plan = planChapter(input, "w-1", "blob:");
    assert.equal(
      plan.beats.filter((b) => b.kind === "artifact").length,
      1,
    );
    assert.equal(plan.beats.find((b) => b.kind === "null-reflection"), undefined);
  });
});
