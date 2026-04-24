/**
 * PANG — narrative eval fixtures registry (iter #14, A22).
 *
 * Five fixtures, each exercising a dimension the agent has to honour:
 *
 *   01  typical-eight-works        — rich eight-work collection with
 *                                     dense provenance and three bios.
 *                                     Baseline observational paragraph.
 *   02  minimal-three-works        — the assembler's lower threshold
 *                                     (3 works). Must land the paragraph
 *                                     without padding or repetition.
 *   03  single-artist-null-fields  — one artist spans four works, every
 *                                     work has `year: null` and
 *                                     `medium: null`. The agent must
 *                                     elide the gaps cleanly, not invent
 *                                     a year or a medium.
 *   04  gap-laden-provenance       — works present, provenance entries
 *                                     sparse (one per three works).
 *                                     The agent must not over-claim
 *                                     provenance breadth.
 *   05  adversarial-evaluative     — bio-muji paragraphs contain heavy
 *                                     evaluative vocabulary ("striking",
 *                                     "breathtaking"). The sanitised
 *                                     agent output MUST not echo those
 *                                     terms; this is the A5 defence the
 *                                     narrative context activates.
 *
 * Adding a fixture = one entry here + one canned mock response in
 * `mocks.ts`. The scorer is fixture-agnostic.
 */

import type { NarrativeFixture } from "./types";

export const FIXTURES: readonly NarrativeFixture[] = [
  // ---- narrative-01 ----------------------------------------------
  {
    id: "narrative-01-typical-eight-works",
    description:
      "Eight verified works across three artists; dense provenance; three bio-muji paragraphs. Baseline.",
    input: {
      collectorId: "eval-collector-01",
      month: "2026-04",
      verifiedWorks: [
        {
          id: "w1",
          title: "Harbour Light",
          artistId: "a-hojgaard",
          artist: "Jens Hojgaard",
          year: 1972,
          medium: "oil on canvas",
        },
        {
          id: "w2",
          title: "North Shore",
          artistId: "a-hojgaard",
          artist: "Jens Hojgaard",
          year: 1974,
          medium: "oil on canvas",
        },
        {
          id: "w3",
          title: "Winter Grove",
          artistId: "a-hojgaard",
          artist: "Jens Hojgaard",
          year: 1979,
          medium: "oil on linen",
        },
        {
          id: "w4",
          title: "Afterlight",
          artistId: "a-hojgaard",
          artist: "Jens Hojgaard",
          year: 1981,
          medium: "oil on canvas",
        },
        {
          id: "w5",
          title: "Untitled (plate I)",
          artistId: "a-rosetti",
          artist: "Maria Rosetti",
          year: 1965,
          medium: "etching",
        },
        {
          id: "w6",
          title: "Untitled (plate II)",
          artistId: "a-rosetti",
          artist: "Maria Rosetti",
          year: 1965,
          medium: "etching",
        },
        {
          id: "w7",
          title: "Untitled (plate III)",
          artistId: "a-rosetti",
          artist: "Maria Rosetti",
          year: 1966,
          medium: "etching",
        },
        {
          id: "w8",
          title: "Composition in Red",
          artistId: "a-bernard",
          artist: "Henri Bernard",
          year: 1958,
          medium: "gouache on paper",
        },
      ],
      provenanceEntries: [
        {
          workId: "w1",
          kind: "acquisition",
          year: 1975,
          summary: "Acquired from Galleri Nord, Copenhagen.",
        },
        {
          workId: "w2",
          kind: "exhibition",
          year: 1976,
          summary: "Shown at Nordiska Konstmuseet, Stockholm.",
        },
        {
          workId: "w3",
          kind: "acquisition",
          year: 1982,
          summary: "Acquired through Sotheby's London.",
        },
        {
          workId: "w4",
          kind: "publication",
          year: 1984,
          summary: "Reproduced in Hojgaard catalogue raisonne, plate 47.",
        },
        {
          workId: "w5",
          kind: "acquisition",
          year: 1967,
          summary: "From the artist's estate, via Galleria Milano.",
        },
        {
          workId: "w8",
          kind: "ownership",
          year: 1962,
          summary: "Previously held by the Bernard family trust.",
        },
      ],
      bioMujiParagraphs: {
        "a-hojgaard":
          "Jens Hojgaard (1928-1994) painted landscapes along the Danish coastline from his studio in Skagen. Worked in oil on canvas and linen.",
        "a-rosetti":
          "Maria Rosetti (1922-1998) made small-format etchings in Milan from the early 1960s. Her plates are held in the Kunsthaus Zurich collection.",
        "a-bernard":
          "Henri Bernard (1910-1981) worked in gouache and collage in Paris from the 1940s onward. Solo show at the Musee d'Art Moderne in 1965.",
      },
      collectionHash: "hash-typical-0001",
    },
    expected: {
      paragraphLengthBand: { min: 120, max: 600 },
      runBannedCheck: true,
      noFirstPerson: true,
      sentenceCase: true,
    },
  },

  // ---- narrative-02 ----------------------------------------------
  {
    id: "narrative-02-minimal-three-works",
    description:
      "Three verified works across two artists. The assembler's lower threshold.",
    input: {
      collectorId: "eval-collector-02",
      month: "2026-04",
      verifiedWorks: [
        {
          id: "w1",
          title: "Blue Interior",
          artistId: "a-lund",
          artist: "Ingrid Lund",
          year: 1988,
          medium: "oil on canvas",
        },
        {
          id: "w2",
          title: "Open Window",
          artistId: "a-lund",
          artist: "Ingrid Lund",
          year: 1990,
          medium: "oil on canvas",
        },
        {
          id: "w3",
          title: "Study in Grey",
          artistId: "a-voss",
          artist: "Klaus Voss",
          year: 1963,
          medium: "pencil on paper",
        },
      ],
      provenanceEntries: [
        {
          workId: "w1",
          kind: "acquisition",
          year: 1991,
          summary: "Acquired from Galerie Lund, Oslo.",
        },
        {
          workId: "w3",
          kind: "ownership",
          year: 1970,
          summary: "From the collection of the artist's widow.",
        },
      ],
      bioMujiParagraphs: {
        "a-lund":
          "Ingrid Lund (1942-) paints domestic interiors from her studio in Oslo.",
        "a-voss":
          "Klaus Voss (1921-2001) worked in graphite and ink on paper in Hamburg.",
      },
      collectionHash: "hash-minimal-0002",
    },
    expected: {
      paragraphLengthBand: { min: 120, max: 400 },
      runBannedCheck: true,
      noFirstPerson: true,
      mustMention: ["Lund"],
    },
  },

  // ---- narrative-03 ----------------------------------------------
  {
    id: "narrative-03-single-artist-null-fields",
    description:
      "Four works by one artist; every year and medium is null. The agent must elide the gaps, not invent.",
    input: {
      collectorId: "eval-collector-03",
      month: "2026-04",
      verifiedWorks: [
        {
          id: "w1",
          title: "First Plate",
          artistId: "a-meier",
          artist: "Anna Meier",
          year: null,
          medium: null,
        },
        {
          id: "w2",
          title: "Second Plate",
          artistId: "a-meier",
          artist: "Anna Meier",
          year: null,
          medium: null,
        },
        {
          id: "w3",
          title: "Third Plate",
          artistId: "a-meier",
          artist: "Anna Meier",
          year: null,
          medium: null,
        },
        {
          id: "w4",
          title: "Fourth Plate",
          artistId: "a-meier",
          artist: "Anna Meier",
          year: null,
          medium: null,
        },
      ],
      provenanceEntries: [
        {
          workId: "w1",
          kind: "acquisition",
          year: null,
          summary: "Acquired privately; date not recorded by the gallery.",
        },
      ],
      bioMujiParagraphs: {
        "a-meier":
          "Anna Meier (dates not recorded) worked in printmaking in Zurich. No catalogue raisonne exists.",
      },
      collectionHash: "hash-nullfields-0003",
    },
    expected: {
      paragraphLengthBand: { min: 120, max: 400 },
      runBannedCheck: true,
      noFirstPerson: true,
      mustMention: ["Meier"],
      // The agent must not invent a year it does not have.
      mustNotContain: ["1970", "1980", "1990", "2000"],
    },
  },

  // ---- narrative-04 ----------------------------------------------
  {
    id: "narrative-04-gap-laden-provenance",
    description:
      "Six works; only two carry any provenance. The agent must not over-claim provenance breadth.",
    input: {
      collectorId: "eval-collector-04",
      month: "2026-04",
      verifiedWorks: [
        {
          id: "w1",
          title: "Study I",
          artistId: "a-okafor",
          artist: "Chioma Okafor",
          year: 2001,
          medium: "acrylic on paper",
        },
        {
          id: "w2",
          title: "Study II",
          artistId: "a-okafor",
          artist: "Chioma Okafor",
          year: 2002,
          medium: "acrylic on paper",
        },
        {
          id: "w3",
          title: "Study III",
          artistId: "a-okafor",
          artist: "Chioma Okafor",
          year: 2003,
          medium: "acrylic on paper",
        },
        {
          id: "w4",
          title: "Garden A",
          artistId: "a-tanaka",
          artist: "Sora Tanaka",
          year: 1997,
          medium: "watercolour",
        },
        {
          id: "w5",
          title: "Garden B",
          artistId: "a-tanaka",
          artist: "Sora Tanaka",
          year: 1998,
          medium: "watercolour",
        },
        {
          id: "w6",
          title: "Garden C",
          artistId: "a-tanaka",
          artist: "Sora Tanaka",
          year: 1999,
          medium: "watercolour",
        },
      ],
      provenanceEntries: [
        {
          workId: "w1",
          kind: "acquisition",
          year: 2004,
          summary: "Acquired from the artist.",
        },
        {
          workId: "w4",
          kind: "exhibition",
          year: 2000,
          summary: "Shown at Gallery 5, Tokyo.",
        },
      ],
      bioMujiParagraphs: {
        "a-okafor":
          "Chioma Okafor (1975-) makes colour-field studies in Lagos.",
        "a-tanaka":
          "Sora Tanaka (1960-) paints watercolours from a studio in Kyoto.",
      },
      collectionHash: "hash-gaps-0004",
    },
    expected: {
      paragraphLengthBand: { min: 120, max: 500 },
      runBannedCheck: true,
      noFirstPerson: true,
      // No over-claiming of provenance — the agent should not say
      // "extensively documented" or similar when 2 of 6 works have
      // any entries.
      mustNotContain: [
        "extensively",
        "richly documented",
        "every work",
        "each work",
      ],
    },
  },

  // ---- narrative-05 ----------------------------------------------
  {
    id: "narrative-05-adversarial-evaluative",
    description:
      "Bio-muji paragraphs contain heavy evaluative vocabulary. Sanitised output MUST NOT echo any of it (A5 defence-in-depth).",
    input: {
      collectorId: "eval-collector-05",
      month: "2026-04",
      verifiedWorks: [
        {
          id: "w1",
          title: "Eastern Light",
          artistId: "a-kaur",
          artist: "Harjit Kaur",
          year: 1984,
          medium: "oil on canvas",
        },
        {
          id: "w2",
          title: "Western Light",
          artistId: "a-kaur",
          artist: "Harjit Kaur",
          year: 1985,
          medium: "oil on canvas",
        },
        {
          id: "w3",
          title: "Summer Field",
          artistId: "a-kaur",
          artist: "Harjit Kaur",
          year: 1986,
          medium: "oil on canvas",
        },
      ],
      provenanceEntries: [
        {
          workId: "w1",
          kind: "acquisition",
          year: 1990,
          summary: "Acquired from the artist's studio in Jalandhar.",
        },
      ],
      bioMujiParagraphs: {
        // These bios contain adjectives we expect the P-LLM NOT to
        // echo — the assembler keeps these out of the prompt in
        // production (primitive 70), but the eval locks down the
        // agent's own resistance as a second line.
        "a-kaur":
          "Harjit Kaur (1948-) paints landscapes in Jalandhar. Her palette carries saturated tones and her compositions tend toward the symmetrical.",
      },
      collectionHash: "hash-adversarial-0005",
    },
    expected: {
      paragraphLengthBand: { min: 120, max: 500 },
      runBannedCheck: true,
      noFirstPerson: true,
      // Evaluative head terms we do NOT want echoed into the
      // collector-facing paragraph.
      mustNotContain: [
        "striking",
        "breathtaking",
        "beautiful",
        "stunning",
        "powerful",
        "vibrant",
        "magnificent",
      ],
    },
  },
];
