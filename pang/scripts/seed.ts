/**
 * PANG — seed script.
 *
 * Run:        pnpm db:seed              gallery + artist profiles only
 * Run demo:   pnpm db:seed:demo         + demo collector + all 12 artworks
 *
 * Source of truth: `pang/lib/data.ts` — the v0 export's "Real artworks
 * from Galerie Droste" payload (12 artists + 12 artworks with real
 * Artlogic CDN image URLs, provenance, documents). This script
 * normalises that mock-data shape into the live DB schema.
 *
 * Idempotent — re-runs check by gallery slug, artist (gallery_id, name),
 * artwork (collector_id, title), document (artwork_id, title), and
 * provenance (artwork_id, event_date, event).
 *
 * Caveats:
 *   - Image URLs stay on Artlogic CDN. R2 mirror lands later (ADR-001
 *     Sub-decision 4 phase 2).
 *   - Document `storage_path` is a placeholder (`legacy/artlogic/<id>`)
 *     since we don't have real PDFs yet. Real CoAs / invoices will
 *     replace these via the document upload flow.
 *   - The 4 "other collectors" (c1-c4) in data.ts represent the future
 *     artist-circle social layer and need real auth.users entries.
 *     Not seeded here.
 */

import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  artistProfiles,
  artworks as artworksTbl,
  collectorGalleryMembership,
  collectors,
  galleries,
  provenanceEntries,
} from "../lib/db/schema";
import derivedArtworks from "../lib/db/seed-data.json";
import derivedArtists from "../lib/db/seed-artists.json";
import { SHOWCASE } from "../lib/db/showcase";

type DerivedArtwork = (typeof derivedArtworks)[number];
type DerivedArtist = (typeof derivedArtists)[number];

/** Lookup table: artist name → rich record from seed-artists.json. */
const richByName: Record<string, DerivedArtist> = Object.fromEntries(
  derivedArtists.map((a) => [a.name, a]),
);

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI / Vercel: env already set.
}

// ============================================================
// Galerie Droste fixed identity
// ============================================================

const GALLERY = {
  name: "Galerie Droste",
  slug: "galerie-droste",
  countryCode: "DE",
  dataRegion: "eu-west-1",
} as const;

const DEMO_COLLECTOR = {
  email: "demo@pang.local",
  password: "demo-pang-1234-CHANGE-ME",
  displayName: "Demo Collector",
  location: "Düsseldorf, DE",
  collectingSince: 2018,
} as const;

/** "YYYY", "YYYY-MM", or "YYYY-MM-DD" → Postgres DATE. Anything else → null.
 *
 *  Uses a sentinel day-of-month so the display formatter can re-derive
 *  the source precision later:
 *    "2025"        → 2025-01-01    (year-only — formatter renders "2025")
 *    "2025-09"     → 2025-09-15    (month-only — formatter renders "Sep 2025")
 *    "2025-09-12"  → 2025-09-12    (exact — formatter renders "Sep 12, 2025")
 *  An exact date that lands on the 1st of January or the 15th of a month
 *  will round-trip slightly off; for the showcase use case that's fine. */
function parseShowcaseDate(raw: string): Date | null {
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00Z`);
  if (/^\d{4}-\d{2}$/.test(raw)) return new Date(`${raw}-15T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ============================================================
// Implementation
// ============================================================

async function main() {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const client = postgres(dbUrl, { prepare: false, max: 1 });
  const db = drizzle(client);

  try {
    // 1. Gallery row
    let galleryId: string;
    const existing = await db
      .select({ id: galleries.id })
      .from(galleries)
      .where(eq(galleries.slug, GALLERY.slug));

    if (existing[0]) {
      galleryId = existing[0].id;
      console.log(`  · gallery '${GALLERY.slug}' exists`);
    } else {
      const inserted = await db
        .insert(galleries)
        .values({
          name: GALLERY.name,
          slug: GALLERY.slug,
          countryCode: GALLERY.countryCode,
          dataRegion: GALLERY.dataRegion,
        })
        .returning({ id: galleries.id });
      galleryId = inserted[0].id;
      console.log(`  + gallery '${GALLERY.slug}' inserted`);
    }

    // 2. Artist profiles — rich rows from seed-artists.json + name-only
    //    fallback for any artist that appears in artworks but didn't
    //    have an overview page on the gallery's website.
    const artistIdByName: Record<string, string> = {};
    const allArtistNames = new Set<string>([
      ...derivedArtists.map((a) => a.name),
      ...derivedArtworks.map((d) => d.artistName),
    ]);

    for (const name of allArtistNames) {
      const rich = richByName[name];
      const found = await db
        .select({ id: artistProfiles.id })
        .from(artistProfiles)
        .where(
          and(
            eq(artistProfiles.galleryId, galleryId),
            eq(artistProfiles.name, name),
          ),
        );

      if (found[0]) {
        artistIdByName[name] = found[0].id;
        // Backfill bio + photo + socials if we have richer data than
        // what's in the DB. UPDATE is idempotent on the same content.
        if (rich) {
          await db
            .update(artistProfiles)
            .set({
              bio: rich.bio ?? null,
              imageUrl: rich.imageUrl ?? null,
              website: rich.website ?? null,
              instagram: rich.instagram ?? null,
              updatedAt: new Date(),
            })
            .where(eq(artistProfiles.id, found[0].id));
          console.log(`  · artist '${name}' (refreshed)`);
        } else {
          console.log(`  · artist '${name}'`);
        }
      } else {
        const inserted = await db
          .insert(artistProfiles)
          .values({
            galleryId,
            name,
            bio: rich?.bio ?? null,
            imageUrl: rich?.imageUrl ?? null,
            website: rich?.website ?? null,
            instagram: rich?.instagram ?? null,
          })
          .returning({ id: artistProfiles.id });
        artistIdByName[name] = inserted[0].id;
        console.log(`  + artist '${name}'${rich?.bio ? " (with bio)" : ""}`);
      }
    }

    // 3-7. Demo collector + artworks (opt-in)
    if (process.env["RUN_DEMO"] !== "1") {
      console.log("\n(Skipping demo collector + artworks. Pass RUN_DEMO=1 to seed those.)");
      return;
    }

    const supaUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const sk = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supaUrl || !sk) {
      throw new Error(
        "RUN_DEMO=1 needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const admin = createClient(supaUrl, sk, {
      auth: { persistSession: false },
    });

    // 3. Demo auth user
    let userId: string;
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = list.data.users.find(
      (u) => u.email === DEMO_COLLECTOR.email,
    );
    if (existingUser) {
      userId = existingUser.id;
      console.log(`  · auth user '${DEMO_COLLECTOR.email}'`);
    } else {
      const created = await admin.auth.admin.createUser({
        email: DEMO_COLLECTOR.email,
        password: DEMO_COLLECTOR.password,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      userId = created.data.user!.id;
      console.log(`  + auth user '${DEMO_COLLECTOR.email}'`);
    }

    // 4. Collector row mirroring auth.users.id
    const collectorExists = await db
      .select({ id: collectors.id })
      .from(collectors)
      .where(eq(collectors.id, userId));
    if (!collectorExists[0]) {
      await db.insert(collectors).values({
        id: userId,
        email: DEMO_COLLECTOR.email,
        displayName: DEMO_COLLECTOR.displayName,
        location: DEMO_COLLECTOR.location,
        collectingSince: DEMO_COLLECTOR.collectingSince,
      });
      console.log(`  + collector row`);
    } else {
      console.log(`  · collector row`);
    }

    // 5. Membership in Galerie Droste
    const memberExists = await db
      .select()
      .from(collectorGalleryMembership)
      .where(
        and(
          eq(collectorGalleryMembership.collectorId, userId),
          eq(collectorGalleryMembership.galleryId, galleryId),
        ),
      );
    if (!memberExists[0]) {
      await db.insert(collectorGalleryMembership).values({
        collectorId: userId,
        galleryId,
        status: "active",
        boundAt: new Date(),
      });
      console.log(`  + membership`);
    } else {
      console.log(`  · membership`);
    }

    // 6. Artworks — only from the gallery_reference scrape.
    let dInserted = 0;
    let dSkipped = 0;
    for (const d of derivedArtworks as DerivedArtwork[]) {
      const artistId = artistIdByName[d.artistName] ?? null;

      const found = await db
        .select({ id: artworksTbl.id })
        .from(artworksTbl)
        .where(
          and(
            eq(artworksTbl.collectorId, userId),
            eq(artworksTbl.title, d.title),
          ),
        );

      if (found[0]) {
        dSkipped++;
        continue;
      }

      await db.insert(artworksTbl).values({
        galleryId,
        collectorId: userId,
        artistId,
        artistName: d.artistName,
        title: d.title,
        year: d.year,
        medium: d.medium,
        dimensions: d.dimensions,
        imageUrl: d.imageUrl,
        description: d.blurb,
        visibility: "private",
      });
      dInserted++;
    }
    console.log(`  + ${dInserted} artworks inserted, ${dSkipped} existed (from scrape)`);

    // 7. Showcase — apply hand-curated editorial content (provenance,
    //    verification, descriptions) to the small set of artworks that
    //    demonstrate the full app experience. Idempotent on re-run.
    let showcaseHits = 0;
    let showcaseMisses = 0;
    for (const [key, entry] of Object.entries(SHOWCASE)) {
      const sep = key.indexOf("::");
      if (sep < 0) continue;
      const artistName = key.slice(0, sep);
      const title = key.slice(sep + 2);

      const [art] = await db
        .select({ id: artworksTbl.id })
        .from(artworksTbl)
        .where(
          and(
            eq(artworksTbl.artistName, artistName),
            eq(artworksTbl.title, title),
          ),
        );
      if (!art) {
        console.log(`  ✗ showcase: '${title}' by '${artistName}' not in DB`);
        showcaseMisses++;
        continue;
      }

      // Update artwork-level fields (only those the entry sets).
      // Verification status is intentionally NOT touched here — the
      // verified/verifiedAt columns remain on the row for future use,
      // but no UI surfaces them and nothing in the demo flow sets them.
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (entry.description !== undefined) patch.description = entry.description;
      if (entry.movement !== undefined) patch.movement = entry.movement;
      await db.update(artworksTbl).set(patch).where(eq(artworksTbl.id, art.id));

      // Provenance — replace existing entries idempotently.
      if (entry.provenance) {
        await db
          .delete(provenanceEntries)
          .where(eq(provenanceEntries.artworkId, art.id));
        for (const p of entry.provenance) {
          await db.insert(provenanceEntries).values({
            artworkId: art.id,
            eventDate: parseShowcaseDate(p.date),
            event: p.event,
            location: p.location ?? null,
          });
        }
      }

      console.log(`  ★ showcase: ${title}`);
      showcaseHits++;
    }
    console.log(
      `  + showcase applied to ${showcaseHits} artworks${showcaseMisses ? ` (${showcaseMisses} not found)` : ""}`,
    );

    console.log("\nDone.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
