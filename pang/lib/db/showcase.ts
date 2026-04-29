/**
 * PANG — showcase content for hand-curated artworks.
 *
 * The catalog crawler (`scripts/scrape-artlogic.ts`) populates basic
 * metadata for every public Galerie Droste work. This file adds the
 * editorial layer — provenance entries, verification timestamp,
 * optional richer description — for the small subset of artworks we
 * use to demonstrate the full app experience.
 *
 * Honest-content rules (from the empty-states discussion):
 *   - Provenance entries describe plausible historical events for a
 *     gallery-acquired work (creation → exhibition → acquisition).
 *     They're constructed for the demo collector but follow the
 *     trajectory any real artwork in this catalog actually had.
 *   - Verified+date is set on every showcase work — the verification
 *     trust-layer is the crown jewel and showcase artworks should
 *     demonstrate it.
 *   - We do NOT add `artistNotes`, `voiceNotes`, or `videos` —
 *     putting words in real artists' mouths is not okay even for
 *     demo. Those sections collapse cleanly when absent.
 *   - Documents are deliberately omitted until the gallery provides
 *     real (sanitized) CoAs / invoices we can attach.
 *
 * Keyed by `<Artist Name>::<Artwork Title>` since DB UUIDs change
 * across re-seeds. Idempotent: re-running the seed replaces the
 * provenance entries for these artworks (others are untouched).
 *
 * To add a new showcase artwork: pick from the 168 in DB, add an
 * entry below, run `pnpm db:seed:demo`. The detail page lights up.
 */

export type ShowcaseProvenance = {
  /** "YYYY" or "YYYY-MM-DD". Coerced to a Postgres DATE at seed time. */
  date: string;
  event: string;
  location?: string;
};

export type ShowcaseEntry = {
  /** ISO date — sets verified=true + verifiedAt on the row. */
  verifiedAt?: string;
  /** Editorial period / movement tag. Free text. */
  movement?: string;
  /** Override the scrape's blurb with a longer curatorial paragraph. */
  description?: string;
  /** Replaces existing provenance entries (idempotent on re-run). */
  provenance?: ShowcaseProvenance[];
};

export const SHOWCASE: Record<string, ShowcaseEntry> = {
  "Laust Højgaard::Turmoil Rising": {
    verifiedAt: "2026-02-04",
    movement: "Contemporary",
    provenance: [
      { date: "2025", event: "Created by artist", location: "Copenhagen studio" },
      { date: "2025-09", event: "Exhibited at Galerie Droste", location: "Düsseldorf" },
      { date: "2026-01", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },

  "Raphael Brunk::Resonant Reverie": {
    verifiedAt: "2024-03-22",
    movement: "Post-digital figuration",
    provenance: [
      { date: "2023", event: "Created by artist", location: "Berlin studio" },
      { date: "2023-11", event: "Exhibited at Galerie Droste", location: "Düsseldorf" },
      { date: "2024-02", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },

  "Conrad Ruiz::Go Go Love (CK One Forever)": {
    verifiedAt: "2025-04-18",
    movement: "Contemporary watercolor",
    provenance: [
      { date: "2024", event: "Created by artist", location: "Los Angeles studio" },
      { date: "2024-10", event: "Exhibited at Galerie Droste", location: "Düsseldorf" },
      { date: "2025-03", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },

  "Willehad Eilers::Das Leben Das Leben": {
    verifiedAt: "2025-12-09",
    movement: "Contemporary figuration",
    provenance: [
      { date: "2025", event: "Created by artist", location: "Berlin studio" },
      { date: "2025-08", event: "Galerie Droste — solo presentation", location: "Düsseldorf" },
      { date: "2025-11", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },

  "Sojeong Lee::Out of Reach": {
    verifiedAt: "2026-03-15",
    movement: "Contemporary",
    provenance: [
      { date: "2026", event: "Created by artist", location: "Seoul studio" },
      { date: "2026-02", event: "Exhibited at Galerie Droste", location: "Düsseldorf" },
      { date: "2026-03", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },

  "Andrew Schoultz::Green Owl With Stained Glass": {
    verifiedAt: "2026-04-22",
    movement: "Contemporary symbolism",
    provenance: [
      { date: "2026", event: "Created by artist", location: "Los Angeles studio" },
      { date: "2026-03", event: "Galerie Droste — solo presentation", location: "Düsseldorf" },
      { date: "2026-04", event: "Acquired from Galerie Droste", location: "Düsseldorf" },
    ],
  },
};
