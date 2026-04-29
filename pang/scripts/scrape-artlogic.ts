/**
 * PANG — Artlogic public-site crawler.
 *
 * Run:    pnpm db:scrape          fetches + writes JSON (cached)
 * Run:    pnpm db:scrape --fresh  bypass cache (force re-fetch)
 *
 * Pulls Galerie Droste's public site at galeriedroste.com via its
 * sitemap.xml, walks the artist + works pages, and writes:
 *   - lib/db/seed-data.json     (artworks; replaces the manual scrape)
 *   - lib/db/seed-artists.json  (artists with bio + photo + socials)
 *
 * Why this matters: the same JSON shape is consumed by `seed.ts`,
 * which itself doesn't care where the data came from. When Artlogic
 * API access is granted, we add a parallel `sync-artlogic-api.ts`
 * that produces the same JSON shape from the API — and `seed.ts`
 * keeps working unchanged.
 *
 * Polite-citizen settings:
 *   - 500 ms rate limit between requests
 *   - User-Agent identifies the crawler + project
 *   - Cache every response so re-runs are local-only
 *   - Respect robots.txt (we're not in any of the disallowed bot lists)
 *
 * Cache + scrape live under gallery_reference/cache/; gitignored.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = "https://www.galeriedroste.com";
const SITEMAP_URL = `${ROOT}/sitemap.xml`;
const UA =
  "PangCrawler/1.0 (+collector PWA for Galerie Droste; contact: tobias.schneider.berlin@gmail.com)";
const CACHE_DIR = resolve("gallery_reference/cache");
const RATE_LIMIT_MS = 500;
const FRESH = process.argv.includes("--fresh");

const ARTWORKS_OUT = resolve("lib/db/seed-data.json");
const ARTISTS_OUT = resolve("lib/db/seed-artists.json");

// ---------- types ----------------------------------------------

type DerivedArtwork = {
  slug: string;
  artistName: string;
  title: string;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  imageUrl: string | null;
  blurb: string | null;
};

type DerivedArtist = {
  slug: string; // "30-willehad-eilers" — Artlogic's url segment, stable
  name: string;
  bio: string | null;
  imageUrl: string | null;
  website: string | null;
  instagram: string | null;
};

// ---------- fetch + cache --------------------------------------

function urlToCachePath(url: string): string {
  // Strip the host, replace path slashes with __, append .html
  const u = new URL(url);
  const safe = u.pathname.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, "__") || "index";
  const ext = u.pathname.endsWith(".xml") ? "xml" : "html";
  return resolve(CACHE_DIR, `${safe}.${ext}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cachedFetch(url: string): Promise<string> {
  const file = urlToCachePath(url);
  if (!FRESH && existsSync(file)) return readFileSync(file, "utf8");

  await sleep(RATE_LIMIT_MS);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const body = await res.text();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  return body;
}

// ---------- helpers --------------------------------------------

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1]! : null;
}

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- sitemap parsing ------------------------------------

async function getSitemapUrls(): Promise<string[]> {
  const xml = await cachedFetch(SITEMAP_URL);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

function artistOverviewUrls(all: string[]): string[] {
  return all.filter((u) => /\/artists\/\d+-[a-z0-9-]+\/overview\/?$/.test(u));
}

function worksIndexUrls(all: string[]): string[] {
  return all.filter((u) => /\/artists\/\d+-[a-z0-9-]+\/works\/?$/.test(u));
}

// ---------- artist parser --------------------------------------

function parseArtistOverview(url: string, html: string): DerivedArtist | null {
  // URL slug: /artists/30-willehad-eilers/overview/ → "30-willehad-eilers"
  const slug = firstMatch(url, /\/artists\/(\d+-[a-z0-9-]+)\//);
  if (!slug) return null;

  // Name from og:title — format "Artist Name - Overview"
  const ogTitle = firstMatch(
    html,
    /<meta property="og:title" content="([^"]+)"/,
  );
  if (!ogTitle) return null;
  const name = decodeHtmlEntities(ogTitle.replace(/\s*-\s*Overview\s*$/i, "").trim());

  // og:image is usually the artist's headline artwork — fine as a portrait fallback.
  const imageUrl =
    firstMatch(html, /<meta property="og:image" content="([^"]+)"/) ?? null;

  // Bio — div id="bio" class="bio prose">…</div>
  // Match the inner content; it's HTML so we strip tags after.
  const bioMatch =
    /<div[^>]*id="bio"[^>]*class="[^"]*bio[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(
      html,
    );
  let bio: string | null = null;
  if (bioMatch) {
    bio = decodeHtmlEntities(stripTags(bioMatch[1]!));
    if (bio.length < 30) bio = null; // ignore stub blocks
  }

  // Instagram + website — usually <a href> with class artist_website_link or
  // an href containing instagram.com.
  const instagramHref = firstMatch(
    html,
    /<a[^>]+href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/i,
  );
  const websiteHref = firstMatch(
    html,
    /<a[^>]+class="[^"]*artist_website_link[^"]*"[^>]*href="([^"]+)"/i,
  ) ??
    firstMatch(
      html,
      /<div class="link artist_website_link[^"]*">[\s\S]*?href="([^"]+)"/i,
    );

  return {
    slug,
    name,
    bio,
    imageUrl,
    website: websiteHref,
    instagram: instagramHref,
  };
}

// ---------- works-index parser ---------------------------------

function artworkUrlsFromIndex(html: string): string[] {
  const urls = new Set<string>();
  const re = /href="(\/artists\/\d+-[a-z0-9-]+\/works\/\d+-[^"]+\/)"/g;
  for (const m of html.matchAll(re)) {
    urls.add(`${ROOT}${m[1]}`);
  }
  return [...urls];
}

// ---------- artwork parser (same as parse-gallery-reference) ---

function parseArtworkPage(html: string): DerivedArtwork | null {
  const ogTitleRaw = firstMatch(
    html,
    /<meta property="og:title" content="([^"]+)"/,
  );
  if (!ogTitleRaw) return null;
  const ogTitle = decodeHtmlEntities(ogTitleRaw);

  const parts = ogTitle.split(/,\s*/).map((p) => p.trim());
  if (parts.length < 2) return null;

  let artistName: string;
  let title: string;
  let year: number | null = null;

  const last = parts[parts.length - 1]!;
  if (parts.length >= 3 && /^\d{4}$/.test(last)) {
    year = parseInt(last, 10);
    artistName = parts[0]!;
    title = parts.slice(1, -1).join(", ");
  } else {
    artistName = parts[0]!;
    title = parts.slice(1).join(", ");
  }

  const imageUrl =
    firstMatch(html, /<meta property="og:image" content="([^"]+)"/) ?? null;
  const ogDesc = firstMatch(
    html,
    /<meta property="og:description" content="([^"]+)"/,
  );

  let medium: string | null = null;
  let dimensions: string | null = null;
  let blurb: string | null = null;

  if (ogDesc) {
    const desc = decodeHtmlEntities(ogDesc).trim();
    const prefix = `${artistName} ${title}`;
    let rest = desc;
    if (desc.startsWith(prefix)) {
      rest = desc.slice(prefix.length).replace(/^[,\s]+/, "");
    }
    const skipYear = /^\d{4}\b\s*(.+)$/.exec(rest);
    const mediumAndDims = skipYear ? skipYear[1]! : rest;

    const dimMatch =
      /([\d.,]+(?:\s*[x×]\s*[\d.,]+){1,2}\s*cm)/i.exec(mediumAndDims);
    if (dimMatch) {
      dimensions = dimMatch[1]!
        .replace(/,(\d)/g, ".$1")
        .replace(/\s+/g, " ")
        .trim();
      medium =
        mediumAndDims.slice(0, dimMatch.index).trim().replace(/[,]+$/, "").trim() ||
        null;
    } else {
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

// ---------- main -----------------------------------------------

async function main() {
  console.log(`PangCrawler — fetching ${ROOT}`);
  console.log(`Cache: ${CACHE_DIR}${FRESH ? " (FRESH — bypassing)" : ""}`);

  const all = await getSitemapUrls();
  console.log(`  sitemap: ${all.length} URLs`);

  const artistUrls = artistOverviewUrls(all);
  const indexUrls = worksIndexUrls(all);
  console.log(`  artist overview pages: ${artistUrls.length}`);
  console.log(`  works-index pages: ${indexUrls.length}`);

  // Step 1: artist overviews
  console.log("\nFetching artist overviews…");
  const artists: DerivedArtist[] = [];
  for (const url of artistUrls.sort()) {
    const html = await cachedFetch(url);
    const a = parseArtistOverview(url, html);
    if (a) {
      artists.push(a);
      console.log(`  + ${a.name}${a.bio ? ` (${a.bio.length} chars bio)` : " (no bio)"}`);
    } else {
      console.log(`  ✗ ${url} (parse failed)`);
    }
  }

  // Step 2: works-index → artwork URLs
  console.log("\nWalking works-index pages…");
  const artworkUrls = new Set<string>();
  for (const url of indexUrls.sort()) {
    const html = await cachedFetch(url);
    const found = artworkUrlsFromIndex(html);
    for (const u of found) artworkUrls.add(u);
    console.log(`  ${url.replace(ROOT, "")}: ${found.length} artworks`);
  }
  console.log(`  total unique artwork URLs: ${artworkUrls.size}`);

  // Step 3: each artwork
  console.log("\nFetching artwork pages…");
  const artworks: DerivedArtwork[] = [];
  const seen = new Set<string>();
  let i = 0;
  for (const url of [...artworkUrls].sort()) {
    i++;
    try {
      const html = await cachedFetch(url);
      const aw = parseArtworkPage(html);
      if (!aw) {
        console.log(`  [${i}/${artworkUrls.size}] ✗ ${url} (no og:title)`);
        continue;
      }
      if (seen.has(aw.slug)) continue;
      seen.add(aw.slug);
      artworks.push(aw);
      if (i % 25 === 0) console.log(`  [${i}/${artworkUrls.size}] …${aw.artistName} — ${aw.title}`);
    } catch (e) {
      console.log(`  [${i}/${artworkUrls.size}] ✗ ${url} — ${(e as Error).message}`);
    }
  }

  // Sort and write.
  artists.sort((a, b) => a.name.localeCompare(b.name));
  artworks.sort((a, b) => a.slug.localeCompare(b.slug));

  writeFileSync(ARTISTS_OUT, JSON.stringify(artists, null, 2) + "\n");
  writeFileSync(ARTWORKS_OUT, JSON.stringify(artworks, null, 2) + "\n");

  console.log(`\nWrote:`);
  console.log(`  ${ARTISTS_OUT}  (${artists.length} artists)`);
  console.log(`  ${ARTWORKS_OUT}  (${artworks.length} artworks)`);
}

main().catch((e) => {
  console.error("Crawl failed:", e);
  process.exit(1);
});
