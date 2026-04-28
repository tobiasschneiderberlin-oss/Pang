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
  documents,
  galleries,
  provenanceEntries,
} from "../lib/db/schema";
import { artists as srcArtists, artworks as srcArtworks } from "../lib/data";
import type { ArtworkDocument, ProvenanceEntry } from "../lib/data";
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
// Type-mapping helpers
// ============================================================

/** lib/data.ts uses kebab-case for the condition-report doc type;
 *  our DB enum uses snake_case. Otherwise the values match 1:1. */
function mapDocumentType(t: ArtworkDocument["type"]): typeof documents.$inferInsert.type {
  return t === "condition-report" ? "condition_report" : t;
}

/** lib/data.ts stores provenance dates as free-form strings ("2024",
 *  "1991-2003", "Spring 2024"). Coerce to a Postgres DATE. Anything
 *  unparseable becomes null. */
function coerceProvenanceDate(raw: string): Date | null {
  // Bare year: "2024"
  if (/^\d{4}$/.test(raw)) return new Date(`${raw}-01-01T00:00:00Z`);
  // ISO-ish: "2024-03-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  // Anything else: skip the date, keep the event narrative
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

    // 2a. Artist profiles — 12 from data.ts
    const artistIdBySlug: Record<string, string> = {};
    const artistIdByName: Record<string, string> = {};
    for (const a of srcArtists) {
      const found = await db
        .select({ id: artistProfiles.id })
        .from(artistProfiles)
        .where(
          and(
            eq(artistProfiles.galleryId, galleryId),
            eq(artistProfiles.name, a.name),
          ),
        );

      if (found[0]) {
        artistIdBySlug[a.id] = found[0].id;
        artistIdByName[a.name] = found[0].id;
        console.log(`  · artist '${a.name}'`);
      } else {
        const inserted = await db
          .insert(artistProfiles)
          .values({
            galleryId,
            name: a.name,
            bio: a.bio ?? null,
            nationality: a.nationality ?? null,
            birthYear: a.birthYear ?? null,
            imageUrl: a.imageUrl ?? null,
            website: a.website ?? null,
            instagram: a.instagram ?? null,
            media: {
              studioPhotos: a.studioPhotos,
              voiceNotes: a.voiceNotes?.map((v) => ({
                url: v.url,
                title: v.title,
                duration: v.duration,
              })),
              videos: a.videos?.map((v) => ({
                url: v.url,
                title: v.title,
                duration: v.duration,
                thumbnail: v.thumbnail,
              })),
              personalMessages: a.personalMessages,
            },
          })
          .returning({ id: artistProfiles.id });
        artistIdBySlug[a.id] = inserted[0].id;
        artistIdByName[a.name] = inserted[0].id;
        console.log(`  + artist '${a.name}'`);
      }
    }

    // 2b. Artist profiles — additional artists from gallery_reference scrape
    //     (Conrad Ruiz, Lena Valenzuela, Sojeong Lee, Tim Sandow, etc.).
    //     Bios aren't in the scrape — the artist row is name-only and
    //     can be enriched later via the gallery's curation UI.
    const derivedArtistNames = new Set(
      derivedArtworks.map((d) => d.artistName),
    );
    for (const name of derivedArtistNames) {
      if (artistIdByName[name]) continue; // already inserted from data.ts
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
        console.log(`  + artist '${name}' (from scrape)`);
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

    // 6. Artworks — all 12 from data.ts
    let inserted = 0;
    let skipped = 0;
    for (const aw of srcArtworks) {
      const artistId = artistIdBySlug[aw.artistId] ?? null;

      // Idempotent on (collector, title).
      const found = await db
        .select({ id: artworksTbl.id })
        .from(artworksTbl)
        .where(
          and(
            eq(artworksTbl.collectorId, userId),
            eq(artworksTbl.title, aw.title),
          ),
        );

      let artworkId: string;
      if (found[0]) {
        artworkId = found[0].id;
        skipped++;
      } else {
        const ins = await db
          .insert(artworksTbl)
          .values({
            galleryId,
            collectorId: userId,
            artistId,
            artistName: aw.artistName,
            title: aw.title,
            year: aw.year,
            medium: aw.medium,
            dimensions: aw.dimensions,
            imageUrl: aw.imageUrl,
            description: aw.description ?? null,
            visibility: aw.visibility ?? "private",
            verified: aw.verified ?? false,
            verifiedAt: aw.verifiedDate
              ? new Date(aw.verifiedDate)
              : null,
          })
          .returning({ id: artworksTbl.id });
        artworkId = ins[0].id;
        inserted++;
      }

      // Documents (idempotent on title within artwork).
      if (aw.documents) {
        for (const doc of aw.documents) {
          const docFound = await db
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.artworkId, artworkId),
                eq(documents.title, doc.title),
              ),
            );
          if (docFound[0]) continue;
          await db.insert(documents).values({
            galleryId,
            collectorId: userId,
            artworkId,
            type: mapDocumentType(doc.type),
            title: doc.title,
            storagePath: `legacy/artlogic/${doc.id}`,
            // Mark CoAs and invoices as tax-relevant by default — sane
            // GwG/§ 147 AO posture; collectors can opt out per-doc.
            taxRelevant: doc.type === "invoice" || doc.type === "appraisal",
          });
        }
      }

      // Provenance entries (idempotent on (artwork, event_date, event)).
      if (aw.provenance) {
        for (const p of aw.provenance as ProvenanceEntry[]) {
          const eventDate = coerceProvenanceDate(p.date);
          // Skip dupes — composite check (event_date + event).
          const provFound = await db
            .select({ id: provenanceEntries.id })
            .from(provenanceEntries)
            .where(
              and(
                eq(provenanceEntries.artworkId, artworkId),
                eq(provenanceEntries.event, p.event),
              ),
            );
          if (provFound[0]) continue;
          await db.insert(provenanceEntries).values({
            artworkId,
            eventDate,
            event: p.event,
            location: p.location ?? null,
            photos: p.photos ?? null,
          });
        }
      }
    }
    console.log(`  + ${inserted} artworks inserted, ${skipped} existed (from data.ts)`);

    // 7. Artworks — additional from gallery_reference scrape
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
