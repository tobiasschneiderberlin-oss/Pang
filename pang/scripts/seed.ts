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
} from "../lib/db/schema";
import derivedArtworks from "../lib/db/seed-data.json";

type DerivedArtwork = (typeof derivedArtworks)[number];

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

    // 2. Artist profiles — derived from the gallery_reference scrape.
    //    Bios aren't in the scrape; rows are name-only and enriched
    //    later via the gallery's curation UI.
    const artistIdByName: Record<string, string> = {};
    const derivedArtistNames = new Set(
      derivedArtworks.map((d) => d.artistName),
    );
    for (const name of derivedArtistNames) {
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
        console.log(`  · artist '${name}'`);
      } else {
        const inserted = await db
          .insert(artistProfiles)
          .values({ galleryId, name })
          .returning({ id: artistProfiles.id });
        artistIdByName[name] = inserted[0].id;
        console.log(`  + artist '${name}'`);
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

    console.log("\nDone.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
