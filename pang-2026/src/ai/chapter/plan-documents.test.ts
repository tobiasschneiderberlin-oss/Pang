/**
 * PANG — documents chapter planner tests.
 *
 * Covers the iteration-#6 chapter variant. Locks the budget
 * invariant (totalMs in [6000, 12000] across document counts) and
 * the beat-shape invariants that keep the renderer branch-free.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planDocumentsChapter } from "./plan";
import { DOCUMENTS_CONTEXT_LINE } from "./voice";
import type { DocumentRecord } from "@/stores/works";

const FOCUSED_AT = "2026-04-23T12:00:00.000Z";

function doc(n: number): DocumentRecord {
  return {
    type: n % 2 === 0 ? "coa" : "invoice",
    fileRef: `docs/${n}.pdf`,
    mime: "application/pdf",
    extractedFields: { "field-a": `value-${n}` },
  };
}

function docs(count: number): readonly DocumentRecord[] {
  return Array.from({ length: count }, (_, i) => doc(i));
}

describe("planDocumentsChapter — budget", () => {
  it("n=1 lands on the 6000 ms floor (±500 ms)", () => {
    const plan = planDocumentsChapter(docs(1), "w-1", FOCUSED_AT);
    assert.ok(
      plan.totalMs >= 6000 && plan.totalMs <= 6500,
      `n=1 totalMs = ${plan.totalMs}`,
    );
  });

  it("n=8 lands under the 12000 ms ceiling", () => {
    const plan = planDocumentsChapter(docs(8), "w-1", FOCUSED_AT);
    assert.ok(
      plan.totalMs >= 8000 && plan.totalMs < 12000,
      `n=8 totalMs = ${plan.totalMs}`,
    );
  });

  it("caps artifact beats at 8 even for larger inputs", () => {
    const plan = planDocumentsChapter(docs(20), "w-1", FOCUSED_AT);
    const artifacts = plan.beats.filter((b) => b.kind === "artifact");
    assert.equal(artifacts.length, 8);
  });
});

describe("planDocumentsChapter — beat shape", () => {
  it("always has settle → artifacts → context → ready", () => {
    const plan = planDocumentsChapter(docs(3), "w-1", FOCUSED_AT);
    const kinds = plan.beats.map((b) => b.kind);
    assert.deepEqual(kinds, [
      "settle",
      "artifact",
      "artifact",
      "artifact",
      "context",
      "ready",
    ]);
  });

  it("empty documents still yields a valid settle/context/ready plan", () => {
    const plan = planDocumentsChapter([], "w-1", FOCUSED_AT);
    const kinds = plan.beats.map((b) => b.kind);
    assert.deepEqual(kinds, ["settle", "context", "ready"]);
    assert.equal(plan.shape.artifactCount, 0);
    assert.equal(plan.shape.hasArtifacts, false);
  });

  it("context beat carries the voice-corpus line", () => {
    const plan = planDocumentsChapter(docs(1), "w-1", FOCUSED_AT);
    const context = plan.beats.find((b) => b.kind === "context");
    assert.ok(context);
    assert.equal(context!.payload?.kind, "context");
    if (context!.payload?.kind === "context") {
      assert.equal(context!.payload.body, DOCUMENTS_CONTEXT_LINE);
    }
  });

  it("artifact beats carry fileRef + mime", () => {
    const plan = planDocumentsChapter(docs(2), "w-1", FOCUSED_AT);
    const artifacts = plan.beats.filter((b) => b.kind === "artifact");
    for (const b of artifacts) {
      assert.equal(b.payload?.kind, "artifact");
      if (b.payload?.kind === "artifact") {
        assert.ok(b.payload.artifact.fileRef);
        assert.equal(b.payload.artifact.mime, "application/pdf");
      }
    }
  });
});

describe("planDocumentsChapter — structural invariants", () => {
  it("beats are monotonically non-decreasing by start", () => {
    const plan = planDocumentsChapter(docs(4), "w-1", FOCUSED_AT);
    let prev = -1;
    for (const b of plan.beats) {
      assert.ok(b.startMs >= prev, `beat ${b.id} starts ${b.startMs}`);
      prev = b.startMs;
    }
  });

  it("totalMs equals the ready beat's startMs", () => {
    const plan = planDocumentsChapter(docs(5), "w-1", FOCUSED_AT);
    const ready = plan.beats.find((b) => b.kind === "ready");
    assert.ok(ready);
    assert.equal(plan.totalMs, ready!.startMs);
    assert.equal(plan.readyAtMs, ready!.startMs);
  });

  it("planning is pure (same inputs = same output)", () => {
    const a = planDocumentsChapter(docs(3), "w-1", FOCUSED_AT);
    const b = planDocumentsChapter(docs(3), "w-1", FOCUSED_AT);
    assert.equal(a.totalMs, b.totalMs);
    assert.equal(a.beats.length, b.beats.length);
    for (let i = 0; i < a.beats.length; i++) {
      assert.equal(a.beats[i]!.id, b.beats[i]!.id);
      assert.equal(a.beats[i]!.startMs, b.beats[i]!.startMs);
    }
  });
});
