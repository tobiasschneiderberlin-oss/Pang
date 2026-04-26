/**
 * PANG — demo seed data (REMOVABLE; see ./REMOVAL.md).
 *
 * 15 real artworks from Galerie Droste's roster (sourced 2026-04-25
 * from galeriedroste.com/artists/, downloaded via the Artlogic CDN).
 * Each work carries the actual artist, title, year, medium,
 * dimensions, gallery name — and a real image at
 * `public/demo/<slug>.{jpg|png}`.
 *
 * Used by `seedDemoCollection()` when a collector visits with the
 * `?seed=demo` query parameter. Cold install without the parameter
 * remains empty.
 *
 * Image source: the same Artlogic CDN that powers
 * galeriedroste.com. We cache locally (`public/demo/`) so the demo
 * works offline + we don't hot-link the gallery's bandwidth. When
 * the real Artlogic API integration lands, this path becomes
 * `https://static-assets.artlogic.net/...` per-work.
 *
 * Shape: matches `CollectionEntry` from `@/stores/works.ts` exactly.
 */

import type { CollectionEntry } from "@/stores/works";

function demoId(slug: string): string {
  return `demo-${slug}`;
}

// Stable demo timestamp.
const SEEDED_AT = "2026-04-25T12:00:00.000Z";

interface DemoSpec {
  readonly slug: string;
  readonly imageExt: "jpg" | "png";
  readonly status: "verified" | "unverified";
  readonly artist: string;
  readonly title: string;
  readonly year: number | null;
  readonly medium: string;
  readonly dimensionsCm: { h: number; w: number };
  readonly galleryName: string;
  readonly galleryId: string;
}

/**
 * Real Galerie Droste works (sourced from galeriedroste.com).
 * `size` is derived from `dimensionsCm` (h, w in metres).
 */
const SPECS: readonly DemoSpec[] = [
  // ---- Willehad Eilers (DE, b. 1981) ------------------------------
  {
    slug: "eilers-alt-rosa-vi",
    imageExt: "png",
    status: "verified",
    artist: "Willehad Eilers",
    title: "Alt Rosa VI",
    year: null,
    medium: "Acrylic and ink on canvas",
    dimensionsCm: { h: 160, w: 120 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "eilers-army-of-lovers",
    imageExt: "jpg",
    status: "verified",
    artist: "Willehad Eilers",
    title: "Army of lovers",
    year: 2022,
    medium: "Oil on canvas",
    dimensionsCm: { h: 190, w: 275 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "eilers-alt-rosa-i",
    imageExt: "png",
    status: "unverified",
    artist: "Willehad Eilers",
    title: "Alt Rosa I",
    year: 2023,
    medium: "Acrylic and ink on canvas",
    dimensionsCm: { h: 160, w: 120 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  // ---- Tatjana Doll (DE, b. 1970) ---------------------------------
  {
    slug: "doll-freier-eintritt",
    imageExt: "jpg",
    status: "verified",
    artist: "Tatjana Doll",
    title: "Freier Eintritt",
    year: 2001,
    medium: "Mixed media on canvas",
    dimensionsCm: { h: 50, w: 100 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "doll-magic-carpet-2",
    imageExt: "jpg",
    status: "verified",
    artist: "Tatjana Doll",
    title: "AD_Magic Carpet 2",
    year: 2011,
    medium: "Lacquer on canvas",
    dimensionsCm: { h: 150, w: 300 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  // ---- Julius Hofmann (DE, b. 1983) -------------------------------
  {
    slug: "hofmann-1-millionth-happy-customer",
    imageExt: "jpg",
    status: "verified",
    artist: "Julius Hofmann",
    title: "1 Millionth Happy Customer",
    year: 2022,
    medium: "Acrylic on canvas",
    dimensionsCm: { h: 100, w: 100 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "hofmann-foxey",
    imageExt: "jpg",
    status: "unverified",
    artist: "Julius Hofmann",
    title: "Foxey",
    year: 2022,
    medium: "Acrylic on canvas",
    dimensionsCm: { h: 100, w: 80 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  // ---- Sophie Ullrich (German, b. 1990) ---------------------------
  {
    slug: "ullrich-allons-pecher",
    imageExt: "jpg",
    status: "verified",
    artist: "Sophie Ullrich",
    title: "Allons pêcher",
    year: 2025,
    medium: "Oil on canvas",
    dimensionsCm: { h: 100, w: 81 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "ullrich-appeler-fantomes",
    imageExt: "jpg",
    status: "verified",
    artist: "Sophie Ullrich",
    title: "Appeler des fantômes",
    year: 2025,
    medium: "Oil and airbrush on canvas",
    dimensionsCm: { h: 100, w: 81 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  // ---- Raphael Brunk (DE, b. 1987) --------------------------------
  {
    slug: "brunk-garden-gossip",
    imageExt: "jpg",
    status: "verified",
    artist: "Raphael Brunk",
    title: "Garden Gossip",
    year: 2023,
    medium: "Acrylic and oil stick on latex print",
    dimensionsCm: { h: 180, w: 140 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "brunk-laid-back-elegance",
    imageExt: "jpg",
    status: "unverified",
    artist: "Raphael Brunk",
    title: "Laid Back Elegance",
    year: 2023,
    medium: "Acrylic and oil stick on latex print",
    dimensionsCm: { h: 180, w: 140 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  // ---- Andrew Schoultz --------------------------------------------
  {
    slug: "schoultz-holy-mountain",
    imageExt: "jpg",
    status: "verified",
    artist: "Andrew Schoultz",
    title: "Holy Mountain",
    year: 2019,
    medium: "Acrylic on canvas",
    dimensionsCm: { h: 203.2, w: 132.08 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "schoultz-multi-beast-vessels",
    imageExt: "jpg",
    status: "verified",
    artist: "Andrew Schoultz",
    title: "Multi Beast Vessels",
    year: 2022,
    medium: "Acrylic on canvas",
    dimensionsCm: { h: 198, w: 160 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "schoultz-floating-vessels-sunset-sea",
    imageExt: "jpg",
    status: "verified",
    artist: "Andrew Schoultz",
    title: "Floating Vessels at Sunset Sea",
    year: 2023,
    medium: "Acrylic on canvas",
    dimensionsCm: { h: 198.1, w: 160 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
  {
    slug: "schoultz-beast-in-babylon",
    imageExt: "jpg",
    status: "verified",
    artist: "Andrew Schoultz",
    title: "Beast in Babylon (Serpent)",
    year: 2023,
    medium: "Acrylic on collage in antique copper plate etching",
    dimensionsCm: { h: 78.7, w: 81.3 },
    galleryName: "Galerie Droste",
    galleryId: "galerie-droste",
  },
];

function specToEntry(s: DemoSpec): CollectionEntry {
  // size = [width-m, height-m] for the canvas wall plane geometry.
  const size: readonly [number, number] = [
    s.dimensionsCm.w / 100,
    s.dimensionsCm.h / 100,
  ];
  return {
    id: demoId(s.slug),
    imageUrl: `/demo/${s.slug}.${s.imageExt}`,
    status: s.status,
    size,
    verificationHint: {
      galleryIdHint: s.galleryId,
      galleryNameHint: s.galleryName,
      galleryFreeText: null,
      detectedFrom: "manual",
      artworkSnapshot: {
        artist: s.artist,
        title: s.title,
        year: s.year,
        medium: s.medium,
        dimensionsCm: s.dimensionsCm,
      },
      photoRef: `demo/${s.slug}.jpg`,
      capturedAt: SEEDED_AT,
    },
  };
}

export const DEMO_WORKS: readonly CollectionEntry[] = SPECS.map(specToEntry);

export function isDemoEntry(id: string): boolean {
  return id.startsWith("demo-");
}
