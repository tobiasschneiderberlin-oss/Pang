/**
 * PANG — Narrative agent unit tests.
 *
 * Mocks the Anthropic SDK via `node:test`'s `mock.module`. The
 * mocked client implements `messages.create` with a `script` of
 * canned tool-use responses the test controls per-call, exercising:
 *
 *   - happy path (one paragraph, clean register)
 *   - retry on first-attempt ZodError, success on the second
 *   - evaluative vocabulary → runBannedVocabularyCheck throws, retry
 *   - terminal failure → null
 *   - capability violation short-circuits before any network call
 *
 * The schema's length band is already proven elsewhere — this file
 * covers the runner, not the schema.
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { assembleNarrativeInput } from "@/narrative/input";
import type { NarrativeInput } from "@/narrative/schema";
import type { Trusted } from "@/ai/camel/trust";
import { brand } from "@/ai/camel/trust";

// ---- Mocked Anthropic SDK ---------------------------------------

interface ToolUseBlock {
  type: "tool_use";
  name: string;
  id: string;
  input: { paragraph?: string };
}

interface ScriptedResponse {
  content: ToolUseBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

interface MockState {
  script: ScriptedResponse[];
  cursor: number;
  calls: number;
  throwOnCall: number | null;
  throwKind: string | null;
}

const STATE: MockState = {
  script: [],
  cursor: 0,
  calls: 0,
  throwOnCall: null,
  throwKind: null,
};

function resetMock(): void {
  STATE.script = [];
  STATE.cursor = 0;
  STATE.calls = 0;
  STATE.throwOnCall = null;
  STATE.throwKind = null;
}

function pushResponse(paragraph: string): void {
  STATE.script.push({
    content: [
      {
        type: "tool_use",
        name: "composeMonthlyReading",
        id: `tool-use-${STATE.script.length}`,
        input: { paragraph },
      },
    ],
    usage: { input_tokens: 1200, output_tokens: 80 },
  });
}

function pushBadResponse(bad: { paragraph?: string }): void {
  STATE.script.push({
    content: [
      {
        type: "tool_use",
        name: "composeMonthlyReading",
        id: `tool-use-${STATE.script.length}`,
        input: bad,
      },
    ],
    usage: { input_tokens: 1200, output_tokens: 60 },
  });
}

class MockAnthropic {
  messages = {
    create: async (_req: unknown): Promise<ScriptedResponse> => {
      STATE.calls += 1;
      if (STATE.throwOnCall !== null && STATE.calls === STATE.throwOnCall) {
        throw new Error(STATE.throwKind ?? "mock-throw");
      }
      if (STATE.cursor >= STATE.script.length) {
        throw new Error(
          `MockAnthropic: no scripted response for call #${STATE.calls}`,
        );
      }
      const response = STATE.script[STATE.cursor]!;
      STATE.cursor += 1;
      return response;
    },
  };
}

mock.module("@anthropic-ai/sdk", {
  defaultExport: MockAnthropic,
});

// Dynamic import AFTER the mock is installed.
const { runNarrative } = await import("./narrative");

// ---- Fixtures ---------------------------------------------------

const nominalParagraph =
  "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them is a single Taeuber-Arp from 1935, the only work on paper in this collection. The provenance ledger for both names continues to grow year on year.";

const evaluativeParagraph =
  "Your Hojgaard collection is a striking sequence of four works, the largest acquired in 2019. Next to them is a single Taeuber-Arp, a breathtaking work on paper. The provenance ledger grows year on year.";

function mkInput(): Trusted<NarrativeInput, "P"> {
  const r = assembleNarrativeInput(
    {
      collectorId: "collector-abc",
      verifiedWorks: [
        {
          id: "w-1",
          title: "Abstraktes Bild",
          artistId: "richter",
          artist: "Gerhard Richter",
          year: 1992,
          medium: "oil on canvas",
        },
        {
          id: "w-2",
          title: "Kerze",
          artistId: "richter",
          artist: "Gerhard Richter",
          year: 1982,
          medium: "oil on canvas",
        },
        {
          id: "w-3",
          title: "Composition",
          artistId: "taeuber-arp",
          artist: "Sophie Taeuber-Arp",
          year: 1935,
          medium: "gouache on paper",
        },
      ],
      provenanceEntries: [
        {
          workId: "w-1",
          kind: "acquisition",
          year: 2019,
          summary: "Acquired via Galerie Droste.",
        },
        {
          workId: "w-2",
          kind: "exhibition",
          year: 1983,
          summary: "Shown at Kunsthalle Basel.",
        },
      ],
      bioMujiParagraphs: {
        richter: "A concise factual bio paragraph about Richter.",
        "taeuber-arp": "A concise factual bio paragraph about Taeuber-Arp.",
      },
    },
    new Date(Date.UTC(2026, 3, 24, 12)),
  );
  assert.equal(r.kind, "input");
  if (r.kind !== "input") throw new Error("assembler skipped unexpectedly");
  return r.input;
}

// ---- Tests ------------------------------------------------------

describe("runNarrative — happy path", () => {
  it("returns a branded output on the first attempt", async () => {
    resetMock();
    pushResponse(nominalParagraph);
    const out = await runNarrative(mkInput());
    assert.notEqual(out, null);
    assert.equal(out!.paragraph, nominalParagraph);
    assert.equal(STATE.calls, 1);
  });
});

describe("runNarrative — retry behaviour", () => {
  it("retries on a short paragraph, succeeds on the second attempt", async () => {
    resetMock();
    pushBadResponse({ paragraph: "too short" }); // < 120 chars, schema fail
    pushResponse(nominalParagraph);
    const out = await runNarrative(mkInput());
    assert.notEqual(out, null);
    assert.equal(STATE.calls, 2);
  });

  it("retries on evaluative vocabulary, succeeds on the second attempt", async () => {
    resetMock();
    pushBadResponse({ paragraph: evaluativeParagraph }); // fails schema .refine
    pushResponse(nominalParagraph);
    const out = await runNarrative(mkInput());
    assert.notEqual(out, null);
    assert.equal(STATE.calls, 2);
  });

  it("returns null after three bad attempts", async () => {
    resetMock();
    pushBadResponse({ paragraph: "too short" });
    pushBadResponse({ paragraph: "also too short" });
    pushBadResponse({ paragraph: "still too short" });
    const out = await runNarrative(mkInput());
    assert.equal(out, null);
    assert.equal(STATE.calls, 3);
  });
});

describe("runNarrative — CaMeL", () => {
  it("throws PANGTrustViolation when the input is not 'P'-branded", async () => {
    resetMock();
    pushResponse(nominalParagraph);
    const rawInput = mkInput();
    // Strip the 'P' brand by re-branding 'Q'. Any capability at
    // agent.narrative.pLlm only accepts P | gallery; Q must be
    // rejected before the network call.
    const bad = brand(
      { ...(rawInput as unknown as object) } as object,
      "Q",
    );
    await assert.rejects(
      async () => {
        await runNarrative(
          bad as unknown as Trusted<NarrativeInput, "P">,
        );
      },
      (err: Error) => err.name === "PANGTrustViolation",
    );
    // No HTTP call was made.
    assert.equal(STATE.calls, 0);
  });
});
