/**
 * PANG — gallery_reference HTML → seed-data.json parser.
 *
 * Run:    pnpm tsx scripts/parse-gallery-reference.ts
 *
 * Reads every `*.html` under `pang/gallery_reference/` (the local-only
 * 73 MB scrape of Galerie Droste pages — gitignored), extracts the
 * featured artwork from each, and writes a normalised JSON file to
 * `pang/lib/db/seed-data.json` for the seed script to consume.
 *
 * Source of truth per page:
 *   - `<meta property="og:title">`        — "Artist Name, Artwork Title"
 *   - `<meta property="og:image">`        — full Artlogic CDN URL
 *   - `<meta property="og:description">`  — "Artist Title, YYYY Medium W x H cm W x H in Edition"
 *
 * The HTML body has many other `title_and_year_title` blocks — those
 * are the gallery's sidebar listings (related works, exhibitions),
 * NOT the page subject. We ignore them.
 *
 * Output: array of records — one per HTML file, sorted by slug.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRAPE_DIR = resolve("gallery_reference");
const OUT = resolve("lib/db/seed-data.json");

type DerivedArtwork = {
  /** Stable identifier across re-parses, used for idempotent seeding. */
  slug: string;
  artistName: string;
  title: string;
  year: number | null;
  medium: string | null;
  dimensions: string | null; // metric only, "W x H cm" or "W x H x D cm"
  imageUrl: string | null;
  /** Optional one-line tagline if og:description had one beyond the structured part. */
  blurb: string | null;
};

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1] : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseFile(html: string): DerivedArtwork | null {
  const ogTitleRaw = firstMatch(
    html,
    /<meta property="og:title" content="([^"]+)"/,
  );
  if (!ogTitleRaw) return null;

  const ogTitle = decodeHtmlEntities(ogTitleRaw);

  // og:title format is one of:
  //   "Artist Name, Artwork Title, YYYY"   (3 comma-separated parts; year last)
  //   "Artist Name, Artwork Title"          (year not in title — pre-2018 pages)
  // Split on commas and detect a trailing year.
  const parts = ogTitle.split(/,\s*/).map((p) => p.trim());
  if (parts.length < 2) return null;

  let artistName: string;
  let title: string;
  let year: number | null = null;

  const last = parts[parts.length - 1]!;
  if (parts.length >= 3 && /^\d{4}$/.test(last)) {
    year = parseInt(last, 10);
    artistName = parts[0]!;
    // Title is everything between artist and year (comma-rejoin in case
    // the title itself had commas — rare, but possible).
    title = parts.slice(1, -1).join(", ");
  } else {
    artistName = parts[0]!;
    title = parts.slice(1).join(", ");
  }

  const imageUrl = firstMatch(
    html,
    /<meta property="og:image" content="([^"]+)"/,
  );
  const ogDesc = firstMatch(
    html,
    /<meta property="og:description" content="([^"]+)"/,
  );

  let medium: string | null = null;
  let dimensions: string | null = null;
  let blurb: string | null = null;

  if (ogDesc) {
    const desc = decodeHtmlEntities(ogDesc).trim();
    // og:description format:
    //   "Artist Title, YYYY Medium W x H cm W x H in Edition"
    // Strip the "Artist Title" prefix (no year — that's after the comma).
    const prefix = `${artistName} ${title}`;
    let rest = desc;
    if (desc.startsWith(prefix)) {
      rest = desc.slice(prefix.length).replace(/^[,\s]+/, "");
    }

    // Skip the year token if present (we already have it from og:title).
    const skipYear = /^\d{4}\b\s*(.+)$/.exec(rest);
    const mediumAndDims = skipYear ? skipYear[1]! : rest;

    // Dimensions in cm: "W x H cm" or "W x H x D cm". Accept comma-
    // decimals and the unicode × character.
    const dimMatch =
      /([\d.,]+(?:\s*[x×]\s*[\d.,]+){1,2}\s*cm)/i.exec(mediumAndDims);
    if (dimMatch) {
      dimensions = dimMatch[1]!
        .replace(/,(\d)/g, ".$1") // 76,2 → 76.2 (German decimals)
        .replace(/\s+/g, " ")
        .trim();
      medium =
        mediumAndDims
          .slice(0, dimMatch.index)
          .trim()
          .replace(/[,]+$/, "")
          .trim() || null;
    } else {
      // No metric dims — keep medium-best-effort, blurb-fallback.
      medium = mediumAndDims.trim() || null;
      if (!medium && desc !== prefix) blurb = desc;
    }
  }

  return {
    slug: slugify(`${artistName}-${title}`),
    artistName,
    title,
    year,
    medium,
    dimensions,
    imageUrl,
    blurb,
  };
}

function main() {
  let files: string[];
  try {
    files = readdirSync(SCRAPE_DIR).filter(
      (f) =>
        f.endsWith(".html") &&
        f !== "Gallery_Needs_PainPoints_JTBD.html",
    );
  } catch {
    console.log(
      `(${SCRAPE_DIR} not present; writing empty array. Add HTML scrapes there to seed more works.)`,
    );
    writeFileSync(OUT, "[]\n");
    return;
  }

  const out: DerivedArtwork[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const html = readFileSync(resolve(SCRAPE_DIR, f), "utf8");
    const r = parseFile(html);
    if (!r) {
      console.log(`  ✗ ${f} — no og:title`);
      continue;
    }
    if (seen.has(r.slug)) {
      console.log(`  · ${r.artistName} — ${r.title} (duplicate slug; skipping)`);
      continue;
    }
    seen.add(r.slug);
    out.push(r);
    console.log(
      `  + ${r.artistName} — ${r.title} (${r.year ?? "?"}) — ${r.medium ?? "?"} ${r.dimensions ?? "?"}`,
    );
  }

  out.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n${out.length} records written to ${OUT}`);
}

main();
