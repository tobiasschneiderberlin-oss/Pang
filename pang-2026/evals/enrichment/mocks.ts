/**
 * PANG — enrichment eval mock responses.
 *
 * Canned `EnrichmentOutput` per fixture. Used by `run.ts` when
 * `PANG_EVAL_MOCK=1`. The mocks represent *a correct agent run* —
 * the Q-LLM stripped a poisoned note, the P-LLM authored a clean
 * bio, the timeline landed year-ascending with nulls last. Running
 * the eval in mock mode should pass; a failing mock means the
 * fixture contradicts the scorer (a self-test), not that the model
 * went wrong.
 *
 * Each entry omits `generatedAt` — the runner stamps it at run
 * time so the schema's `datetime()` validator is satisfied.
 */

import type { EnrichmentOutput } from "@/enrichment/schema";
import { FIXTURE_WORK_HASHES } from "./fixtures";

type MockEnrichment = Omit<EnrichmentOutput, "generatedAt">;

export const MOCK_RESPONSES: Readonly<Record<string, MockEnrichment>> = {
  "enrichment-01-gallery-nominal": {
    version: "v1",
    workId: "w-werefkin-red-tree",
    basedOnWorkHash: FIXTURE_WORK_HASHES["enrichment-01-gallery-nominal"]!,
    timeline: [
      {
        year: 1910,
        location: "Munich, Der Blaue Reiter circle",
        context: "studio",
        imageRef: null,
        note: "Completed the winter before the Ascona move.",
        contributorRole: "gallery",
      },
      {
        year: 1924,
        location: "Ascona, Casa Anatta",
        context: "private",
        imageRef: null,
        note: "Hung in the music room.",
        contributorRole: "gallery",
      },
      {
        year: 1960,
        location: "Museo Comunale d'Arte Moderna, Ascona",
        context: "museum",
        imageRef: null,
        note: null,
        contributorRole: "gallery",
      },
    ],
    artistContext: {
      nationality: "Russian",
      birthYear: 1860,
      bioMuji:
        "Russian-born painter who moved between Munich and Ascona. Worked in expressionist and symbolist idioms; co-founded the Blaue Reiter circle's wider orbit.",
      bannedVocabularyDetected: false,
    },
  },

  "enrichment-02-poisoned-note": {
    version: "v1",
    workId: "w-kunz-020",
    basedOnWorkHash: FIXTURE_WORK_HASHES["enrichment-02-poisoned-note"]!,
    timeline: [
      {
        year: 1942,
        location: "Waldstatt studio",
        context: "studio",
        imageRef: null,
        // Poisoned note — Q-LLM dropped it entirely.
        note: null,
        contributorRole: "museum",
      },
      {
        year: 1988,
        location: "Aargauer Kunsthaus, Aarau",
        context: "museum",
        imageRef: null,
        note: "Part of the estate deposit.",
        contributorRole: "museum",
      },
    ],
    artistContext: {
      nationality: "Swiss",
      birthYear: 1892,
      bioMuji:
        "Swiss artist and practitioner of geometric abstraction. Worked on large-format graph paper with a pendulum-guided method; her studio at Waldstatt remains preserved.",
      bannedVocabularyDetected: false,
    },
  },

  "enrichment-03-empty-notes": {
    version: "v1",
    workId: "w-oppenheim-object",
    basedOnWorkHash: FIXTURE_WORK_HASHES["enrichment-03-empty-notes"]!,
    timeline: [
      {
        year: 1936,
        location: "Paris, Galerie Charles Ratton",
        context: "studio",
        imageRef: null,
        note: null,
        contributorRole: "gallery",
      },
      {
        year: 1937,
        location: "New York, Museum of Modern Art",
        context: "museum",
        imageRef: null,
        note: null,
        contributorRole: "gallery",
      },
    ],
    artistContext: {
      nationality: "Swiss",
      birthYear: 1913,
      bioMuji:
        "Swiss-German surrealist whose object-works recast everyday materials. Moved between Berlin, Paris, and Bern; later worked in painting, assemblage, and jewellery.",
      bannedVocabularyDetected: false,
    },
  },

  "enrichment-04-multi-record-sort": {
    version: "v1",
    workId: "w-taeuber-arp-composition",
    basedOnWorkHash:
      FIXTURE_WORK_HASHES["enrichment-04-multi-record-sort"]!,
    timeline: [
      {
        year: 1918,
        location: "Zürich, Galerie Wolfsberg",
        context: "studio",
        imageRef: null,
        note: null,
        contributorRole: "prior-owner",
      },
      {
        year: 1943,
        location: "Zürich estate",
        context: "private",
        imageRef: null,
        note: "After Sophie's death.",
        contributorRole: "prior-owner",
      },
      {
        year: 1960,
        location: "Galerie Denise René, Paris",
        context: "fair",
        imageRef: null,
        note: null,
        contributorRole: "prior-owner",
      },
      {
        year: 1990,
        location: "Kunstmuseum Bern",
        context: "museum",
        imageRef: null,
        note: "Long-term loan.",
        contributorRole: "prior-owner",
      },
    ],
    artistContext: {
      nationality: "Swiss",
      birthYear: 1889,
      bioMuji:
        "Swiss artist, dancer, and designer whose work crossed painting, textile, and stage. A central figure of Dada Zürich; later worked between Paris and Grasse.",
      bannedVocabularyDetected: false,
    },
  },

  "enrichment-05-year-nulls-last": {
    version: "v1",
    workId: "w-bourgeois-spider",
    basedOnWorkHash: FIXTURE_WORK_HASHES["enrichment-05-year-nulls-last"]!,
    timeline: [
      {
        year: 1996,
        location: "New York, Cheim & Read",
        context: "studio",
        imageRef: null,
        note: "Cast at Modern Art Foundry.",
        contributorRole: "gallery",
      },
      {
        year: 2000,
        location: "Tate Modern, London",
        context: "museum",
        imageRef: null,
        note: "Inaugural Turbine Hall commission.",
        contributorRole: "gallery",
      },
      {
        year: null,
        location: "Private collection, Europe",
        context: "private",
        imageRef: null,
        note: null,
        contributorRole: "gallery",
      },
    ],
    artistContext: {
      nationality: "French",
      birthYear: 1911,
      bioMuji:
        "French-American sculptor whose decades of work returned to themes of memory, body, and architecture. Moved to New York in 1938; worked there into her nineties.",
      bannedVocabularyDetected: false,
    },
  },
};
