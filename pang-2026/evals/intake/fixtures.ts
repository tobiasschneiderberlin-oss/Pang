/**
 * PANG — intake eval fixtures registry.
 *
 * The fixtures themselves live as image + JSON pairs under
 * `evals/intake/fixtures/`. This module declares the registry; the
 * runner iterates it. Adding a fixture = drop two files + add one
 * entry here.
 *
 * Copyright: commit public-domain images only. Each fixture's
 * README entry must include a source + license line.
 *
 * Tier 3 of the testing discipline upgrade (2026-04-23).
 */

import type { IntakeFixture } from "./types";

export const FIXTURES: readonly IntakeFixture[] = [
  // ---- intake-01 -----------------------------------------------
  // Synthetic label-card fixture. A generated test image with a
  // clear, high-contrast artist/title/year block. Tests that the
  // intake agent (a) handles our actual image format, (b) extracts
  // simple structured text, and (c) emits the tool call + parses.
  //
  // Not a stand-in for real artwork recognition; real fixtures
  // using public-domain works join this list as they're curated.
  {
    id: "intake-01-label-synth",
    description:
      "Synthetic label card — simple artist / title / year / medium block",
    imageFile: "intake-01-label-synth.png",
    imageMime: "image/png",
    expected: {
      artist: "Test Artist",
      title: "Untitled Study",
      year: 2024,
      medium: "graphite on paper",
      dimensionsCm: { h: 21, w: 29.7 },
    },
  },
];
