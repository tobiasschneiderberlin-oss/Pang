/**
 * PANG — demo seed data (REMOVABLE; see ./REMOVAL.md).
 *
 * 15 public-domain artworks across eras, media, and fictional
 * gallery owners. Used by `seedDemoCollection()` to populate the
 * works store + OPFS persistence when a collector visits with the
 * `?seed=demo` query parameter.
 *
 * Image strategy: inline SVG data URIs with the artist + title
 * rendered as text on a slug-hashed colour. No external fetches,
 * no CSP / CORS / ORB friction. The user gets visually-distinct
 * tiles with the right metadata flowing through every surface
 * (grid caption, focused-panel plaque, canvas wall plane). Real
 * art images are a follow-up polish iter — they require either
 * a vetted public-domain pipeline (Wikimedia API + commit to
 * `public/demo/`) or a partner gallery's catalogue.
 *
 * Shape: matches `CollectionEntry` from `@/stores/works.ts` exactly,
 * so the existing grid + canvas + focused-panel surfaces consume
 * these without any branch.
 */

import type { CollectionEntry } from "@/stores/works";

function demoId(slug: string): string {
  return `demo-${slug}`;
}

// Stable demo timestamp so the seeded entries don't drift across
// invocations. April 2026 — the iter ship date.
const SEEDED_AT = "2026-04-25T12:00:00.000Z";

/**
 * Generate a placeholder image as an inline SVG data URI. Each
 * work gets a unique deterministic background colour (from the
 * slug hash) plus its artist + title rendered as text. No external
 * fetches, no CORS / ORB / CSP friction; visually distinguishes
 * the works while we wait for a real image-source pipeline.
 *
 * Future polish iter: replace with real art images by mapping each
 * slug to a curated public-domain source committed to public/demo/.
 */
function placeholderImage(args: {
  readonly slug: string;
  readonly artist: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
}): string {
  // Hash the slug to a stable hue (0..360) so each work has its own
  // tone but the palette stays consistent across reloads.
  let hash = 0;
  for (let i = 0; i < args.slug.length; i++) {
    hash = (hash * 31 + args.slug.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const bg = `oklch(0.86 0.04 ${hue})`;
  const fg = `oklch(0.32 0.04 ${hue})`;
  const safeArtist = args.artist
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeTitle = args.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${args.width} ${args.height}" preserveAspectRatio="xMidYMid slice"><rect width="${args.width}" height="${args.height}" fill="${bg}"/><text x="50%" y="44%" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(args.width * 0.06)}" fill="${fg}" font-style="italic">${safeArtist}</text><text x="50%" y="56%" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(args.width * 0.05)}" fill="${fg}">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface DemoSpec {
  readonly slug: string;
  readonly status: "verified" | "unverified";
  readonly size: readonly [number, number];
  readonly artist: string;
  readonly title: string;
  readonly year: number;
  readonly medium: string;
  readonly dimensionsCm: { h: number; w: number };
  readonly galleryName: string;
  readonly galleryId: string;
}

/**
 * The 15 demo works. Each entry expands into a full
 * `CollectionEntry` with a `verificationHint` snapshot the focused
 * panel + grid caption can read.
 */
const SPECS: readonly DemoSpec[] = [
  // ---- Old masters ------------------------------------------------
  {
    slug: "vermeer-pearl-earring",
    status: "verified",
    size: [0.39, 0.44],
    artist: "Johannes Vermeer",
    title: "Girl with a Pearl Earring",
    year: 1665,
    medium: "oil on canvas",
    dimensionsCm: { h: 44.5, w: 39 },
    galleryName: "Mauritshuis",
    galleryId: "mauritshuis-the-hague",
  },
  {
    slug: "rembrandt-self-portrait",
    status: "verified",
    size: [0.84, 1.14],
    artist: "Rembrandt van Rijn",
    title: "Self-Portrait with Two Circles",
    year: 1665,
    medium: "oil on canvas",
    dimensionsCm: { h: 114.3, w: 94 },
    galleryName: "Iveagh Bequest, Kenwood House",
    galleryId: "kenwood-house-london",
  },
  {
    slug: "hokusai-great-wave",
    status: "unverified",
    size: [0.38, 0.26],
    artist: "Katsushika Hokusai",
    title: "The Great Wave off Kanagawa",
    year: 1831,
    medium: "woodblock print",
    dimensionsCm: { h: 25.7, w: 37.9 },
    galleryName: "Tokyo National Museum",
    galleryId: "tokyo-national-museum",
  },
  // ---- 19th century -----------------------------------------------
  {
    slug: "manet-olympia",
    status: "unverified",
    size: [1.9, 1.3],
    artist: "Édouard Manet",
    title: "Olympia",
    year: 1863,
    medium: "oil on canvas",
    dimensionsCm: { h: 130.5, w: 191 },
    galleryName: "Musée d'Orsay",
    galleryId: "musee-dorsay-paris",
  },
  {
    slug: "van-gogh-starry-night",
    status: "verified",
    size: [0.92, 0.74],
    artist: "Vincent van Gogh",
    title: "The Starry Night",
    year: 1889,
    medium: "oil on canvas",
    dimensionsCm: { h: 73.7, w: 92.1 },
    galleryName: "Museum of Modern Art",
    galleryId: "moma-new-york",
  },
  {
    slug: "klimt-the-kiss",
    status: "verified",
    size: [1.8, 1.8],
    artist: "Gustav Klimt",
    title: "The Kiss",
    year: 1908,
    medium: "oil and gold leaf on canvas",
    dimensionsCm: { h: 180, w: 180 },
    galleryName: "Belvedere",
    galleryId: "belvedere-vienna",
  },
  // ---- Modern -----------------------------------------------------
  {
    slug: "picasso-demoiselles",
    status: "verified",
    size: [2.43, 2.33],
    artist: "Pablo Picasso",
    title: "Les Demoiselles d'Avignon",
    year: 1907,
    medium: "oil on canvas",
    dimensionsCm: { h: 243.9, w: 233.7 },
    galleryName: "Museum of Modern Art",
    galleryId: "moma-new-york",
  },
  {
    slug: "mondrian-composition",
    status: "unverified",
    size: [0.96, 0.96],
    artist: "Piet Mondrian",
    title: "Composition with Red, Blue and Yellow",
    year: 1930,
    medium: "oil on canvas",
    dimensionsCm: { h: 96, w: 96 },
    galleryName: "private collection (Zürich)",
    galleryId: "private-collection-zurich",
  },
  {
    slug: "kahlo-self-portrait",
    status: "verified",
    size: [0.62, 0.47],
    artist: "Frida Kahlo",
    title: "Self-Portrait with Thorn Necklace and Hummingbird",
    year: 1940,
    medium: "oil on canvas mounted on board",
    dimensionsCm: { h: 47, w: 61 },
    galleryName: "Harry Ransom Center",
    galleryId: "harry-ransom-center-austin",
  },
  {
    slug: "hopper-nighthawks",
    status: "verified",
    size: [1.52, 0.84],
    artist: "Edward Hopper",
    title: "Nighthawks",
    year: 1942,
    medium: "oil on canvas",
    dimensionsCm: { h: 84.1, w: 152.4 },
    galleryName: "The Art Institute of Chicago",
    galleryId: "art-institute-of-chicago",
  },
  {
    slug: "pollock-no5",
    status: "verified",
    size: [2.43, 1.21],
    artist: "Jackson Pollock",
    title: "No. 5, 1948",
    year: 1948,
    medium: "oil on fiberboard",
    dimensionsCm: { h: 243.8, w: 121.9 },
    galleryName: "private collection (New York)",
    galleryId: "private-collection-new-york",
  },
  // ---- Contemporary -----------------------------------------------
  {
    slug: "rothko-no-14",
    status: "verified",
    size: [2.9, 2.66],
    artist: "Mark Rothko",
    title: "No. 14",
    year: 1960,
    medium: "oil on canvas",
    dimensionsCm: { h: 290.8, w: 268.3 },
    galleryName: "San Francisco Museum of Modern Art",
    galleryId: "sfmoma-san-francisco",
  },
  {
    slug: "riley-movement-in-squares",
    status: "verified",
    size: [1.23, 1.21],
    artist: "Bridget Riley",
    title: "Movement in Squares",
    year: 1961,
    medium: "tempera on hardboard",
    dimensionsCm: { h: 123.2, w: 121.2 },
    galleryName: "Tate Britain",
    galleryId: "tate-britain-london",
  },
  {
    slug: "hockney-bigger-splash",
    status: "verified",
    size: [2.42, 2.43],
    artist: "David Hockney",
    title: "A Bigger Splash",
    year: 1967,
    medium: "acrylic on canvas",
    dimensionsCm: { h: 242.5, w: 243.9 },
    galleryName: "Tate Modern",
    galleryId: "tate-modern-london",
  },
  {
    slug: "basquiat-untitled-1984",
    status: "verified",
    size: [2.4, 2.2],
    artist: "Jean-Michel Basquiat",
    title: "Untitled",
    year: 1984,
    medium: "acrylic and mixed media on canvas",
    dimensionsCm: { h: 220, w: 240 },
    galleryName: "private collection (Tokyo)",
    galleryId: "private-collection-tokyo",
  },
];

function specToEntry(s: DemoSpec): CollectionEntry {
  // Render dimensions follow the work's natural aspect ratio so the
  // placeholder doesn't distort. Width/height in arbitrary SVG units.
  const w = 800;
  const h = Math.round((s.size[1] / s.size[0]) * w);
  return {
    id: demoId(s.slug),
    imageUrl: placeholderImage({
      slug: s.slug,
      artist: s.artist,
      title: s.title,
      width: w,
      height: h,
    }),
    status: s.status,
    size: s.size,
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

/**
 * Quick check used by the seeder to know whether the works store
 * already contains demo entries (idempotent re-seed becomes a no-op).
 */
export function isDemoEntry(id: string): boolean {
  return id.startsWith("demo-");
}
