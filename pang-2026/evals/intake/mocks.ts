/**
 * PANG — eval mock responses.
 *
 * Per-fixture canned `IntakeOutput`. Used by `run.ts` when
 * `PANG_EVAL_MOCK=1` — lets CI exercise the runner + scorer without
 * an Anthropic round-trip, and lets local development sanity-check
 * the harness before burning credits.
 *
 * The rule: the mock should pass the scorer for its fixture. That's
 * what makes it a *positive* sanity test of the wiring. A mock that
 * fails its own scorer means the scorer or the fixture disagreed
 * with itself, not that the model is wrong.
 */

import type { IntakeOutput } from "@/ai/tools/artwork";

export const MOCK_RESPONSES: Readonly<Record<string, IntakeOutput>> = {
  "intake-01-label-synth": {
    artwork: {
      artist: "Test Artist",
      title: "Untitled Study",
      year: 2024,
      medium: "graphite on paper",
      dimensionsCm: { h: 21, w: 29.7 },
      confidenceBySource: {
        artist: 0.95,
        title: 0.9,
        year: 0.95,
        medium: 0.85,
        dimensions: 0.9,
      },
    },
    artistContext: {
      nationality: null,
      birthYear: null,
      bioMuji: null,
      bannedVocabularyDetected: false,
    },
    galleryOfOrigin: {
      galleryId: "unknown",
      galleryName: "unknown",
      detectedFrom: null,
      confidence: 0,
    },
    documents: [],
    arrivalLine: "graphite on paper, a study.",
  },
};
