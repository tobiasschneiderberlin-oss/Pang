/**
 * PANG — Drizzle schema for the public schema.
 *
 * Eight tables that crystallise the resolved ADR-001 questions:
 *   - galleries                       — multi-tenant root (Q3)
 *   - collectors                      — owner of artwork + document rows (Q2)
 *   - collector_gallery_membership    — multi-gallery join (Q3)
 *   - artist_profiles                 — gallery-owned artist data
 *   - artworks                        — collector-owned, gallery-readable
 *   - documents                       — collector-owned, with sensitivity_tier (ADR-003)
 *   - provenance_entries              — append-only artwork history (Q2)
 *   - verification_requests           — gallery-staff trust layer (Q1, future portal)
 *
 * RLS-relevant invariants:
 *   - Every row that's collector-owned has both `collector_id` AND
 *     `gallery_id`. The gallery_id is denormalised so RLS can scope
 *     reads without joining through collector_gallery_membership.
 *   - `collectors.id` mirrors `auth.users.id` 1:1. The FK is added
 *     in the RLS migration (drizzle/0001_rls.sql) since Drizzle
 *     doesn't model Supabase's `auth` schema natively.
 *   - `documents.sensitivity_tier = 'locked'` is forbidden when any
 *     of `tax_relevant | aml_relevant | verification_pending` is true.
 *     Enforced by a CHECK constraint in the RLS migration.
 *   - Provenance entries have NO updated_at — append-only by design.
 *
 * Pgenum naming convention: `<table>_<column>_e` to keep enum names
 * descriptive at the SQL layer. Drizzle exports them as TS unions.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Note: `auth.users` is managed by Supabase, not by Drizzle. We never
// declare it here — declaring it would make drizzle-kit emit a
// `CREATE TABLE "auth"."users"` statement that conflicts with the
// existing one. The FK from `collectors.id` to `auth.users(id)` is
// added in the manually-authored RLS migration (drizzle/0001_rls.sql)
// via raw SQL.

// ---------- enums -------------------------------------------------

export const membershipStatusEnum = pgEnum("membership_status_e", [
  "invited",
  "active",
  "suspended",
]);

export const artworkVisibilityEnum = pgEnum("artwork_visibility_e", [
  "private",
  "shared",
  "public",
]);

export const documentTypeEnum = pgEnum("document_type_e", [
  "certificate",
  "invoice",
  "condition_report",
  "appraisal",
  "insurance",
  "other",
]);

export const sensitivityTierEnum = pgEnum("sensitivity_tier_e", [
  "standard",
  "locked",
]);

export const verificationStatusEnum = pgEnum("verification_status_e", [
  "pending",
  "confirmed",
  "declined",
  "expired",
]);

// ---------- galleries ---------------------------------------------

export const galleries = pgTable("galleries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  /** URL-safe slug — used in invite deep links. */
  slug: text("slug").notNull(),
  countryCode: text("country_code").notNull(), // ISO 3166-1 alpha-2; "DE" for Droste
  /** Data residency hint for the application layer. RLS doesn't read this. */
  dataRegion: text("data_region").notNull().default("eu-west-1"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("galleries_slug_uq").on(t.slug)]);

// ---------- collectors --------------------------------------------
// id mirrors auth.users.id 1:1. The FK + ON DELETE CASCADE is added
// in the RLS migration (auth schema isn't modelled here).

export const collectors = pgTable("collectors", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  location: text("location"),
  /** Year the collector started collecting. Optional pre-onboarding hint. */
  collectingSince: integer("collecting_since"),
  /** Q4 privacy flag — when false, the collector is hidden from artist circles. */
  discoverableInCircles: boolean("discoverable_in_circles")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("collectors_email_uq").on(t.email)]);

// ---------- collector_gallery_membership --------------------------
// Composite PK on (collector_id, gallery_id) — a collector can only
// be a member of a gallery once. Status tracks the invite lifecycle.

export const collectorGalleryMembership = pgTable(
  "collector_gallery_membership",
  {
    collectorId: uuid("collector_id")
      .notNull()
      .references(() => collectors.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    status: membershipStatusEnum("status").notNull().default("invited"),
    /** Q2 privacy flag — when true, the gallery cannot read the collector's rows. */
    hiddenFromGallery: boolean("hidden_from_gallery").notNull().default(false),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the collector first claimed the invite via passkey enrollment. */
    boundAt: timestamp("bound_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.collectorId, t.galleryId] })],
);

// ---------- artist_profiles ---------------------------------------
// Owned by the gallery (the gallery curates the artist's bio,
// website, studio photos, etc.). Read by collectors who own works
// by the artist (RLS).

export const artistProfiles = pgTable("artist_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: uuid("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bio: text("bio"),
  nationality: text("nationality"),
  birthYear: integer("birth_year"),
  imageUrl: text("image_url"),
  website: text("website"),
  instagram: text("instagram"),
  /** Free-form JSON for studio photos, voice notes, videos — preserved
   *  shape for the Artist type in lib/data.ts; will normalise later. */
  media: jsonb("media").$type<{
    studioPhotos?: string[];
    voiceNotes?: Array<{ url: string; title: string; duration?: string }>;
    videos?: Array<{ url: string; title: string; duration?: string; thumbnail?: string }>;
    personalMessages?: Array<{ text: string; date: string; type: "personal" | "about-work"; artworkId?: string }>;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- artworks ----------------------------------------------
// Collector-owned (Q2). gallery_id is denormalised from the
// invite-issuing gallery so RLS doesn't join through membership on
// every read.

export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: uuid("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "restrict" }),
  collectorId: uuid("collector_id")
    .notNull()
    .references(() => collectors.id, { onDelete: "cascade" }),
  artistId: uuid("artist_id").references(() => artistProfiles.id, {
    onDelete: "set null",
  }),
  /** Denormalised artist name — preserved when artistId is null
   *  (the Pipeline-A scan can extract a name without a profile yet). */
  artistName: text("artist_name").notNull(),
  title: text("title").notNull(),
  year: integer("year"),
  medium: text("medium"),
  dimensions: text("dimensions"), // free text; future: jsonb {h,w,d,units}
  imageUrl: text("image_url"),
  description: text("description"),
  /** Optional editorial movement/period tag. NEVER produced by the AI scan. */
  movement: text("movement"),
  visibility: artworkVisibilityEnum("visibility").notNull().default("private"),
  /** True iff a verification_request was confirmed by gallery staff. */
  verified: boolean("verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  /** ADR-002: Pipeline A extraction result. Zod-validated before insert. */
  extractionData: jsonb("extraction_data").$type<{
    visualType: string;
    dominantPalette: string[];
    signaturePresent: boolean;
    signatureLocation: string | null;
    signatureText: string | null;
    inscriptionText: string | null;
    editionMarking: string | null;
    framePresent: boolean;
    frameDescription: string | null;
    confidenceMap: Record<string, number>;
    promptVersion: string;
    requestHash: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- documents ---------------------------------------------
// ADR-003: sensitivity_tier slot at column level; CHECK constraint
// in the RLS migration enforces the lock-out rules for tax / AML /
// verification-pending docs.

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "restrict" }),
    collectorId: uuid("collector_id")
      .notNull()
      .references(() => collectors.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    /** Supabase Storage path or R2 key (for the future R2 store). */
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    sensitivityTier: sensitivityTierEnum("sensitivity_tier")
      .notNull()
      .default("standard"),
    /** ADR-003: reserved for future PRF-derived encryption metadata. */
    lockedMeta: jsonb("locked_meta"),
    /** § 147 AO retrievability flag — locks out the locked tier. */
    taxRelevant: boolean("tax_relevant").notNull().default(false),
    /** GwG retrievability flag — locks out the locked tier. */
    amlRelevant: boolean("aml_relevant").notNull().default(false),
    /** Locks out the locked tier while gallery staff need to read. */
    verificationPending: boolean("verification_pending")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // ADR-003: locked tier requires NONE of the retrievability flags.
    check(
      "documents_locked_excludes_retrievable",
      sql`${t.sensitivityTier} <> 'locked' OR (NOT ${t.taxRelevant} AND NOT ${t.amlRelevant} AND NOT ${t.verificationPending})`,
    ),
  ],
);

// ---------- provenance_entries ------------------------------------
// Append-only by design — no updated_at. Q2 says provenance is
// immutable history; the application layer enforces no UPDATE / DELETE,
// and the RLS migration revokes those grants from the collector role.

export const provenanceEntries = pgTable("provenance_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  artworkId: uuid("artwork_id")
    .notNull()
    .references(() => artworks.id, { onDelete: "cascade" }),
  /** Date the event occurred. Stored as DATE (not TIMESTAMPTZ) since
   *  provenance is rarely time-of-day specific. */
  eventDate: timestamp("event_date", { mode: "date", withTimezone: false }),
  event: text("event").notNull(),
  location: text("location"),
  /** URLs to installation shots / where-it-hung photos. */
  photos: jsonb("photos").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- verification_requests ---------------------------------
// Created by the collector. The status flips when gallery staff
// click the email link (signed JWT — see lib/auth/server/signed-link.ts).
// reviewer_id is the future gallery-portal user who acted; stored as
// UUID without a FK since that auth context lives outside this DB
// (Q1 separate auth).

export const verificationRequests = pgTable("verification_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  galleryId: uuid("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "restrict" }),
  artworkId: uuid("artwork_id")
    .notNull()
    .references(() => artworks.id, { onDelete: "cascade" }),
  collectorId: uuid("collector_id")
    .notNull()
    .references(() => collectors.id, { onDelete: "cascade" }),
  status: verificationStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** When the gallery-confirm / gallery-decline JWT was minted. */
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  /** Future gallery-portal user id. No FK because that auth lives
   *  in a separate Supabase project (Q1). */
  reviewerId: uuid("reviewer_id"),
  reviewerNote: text("reviewer_note"),
});

// ---------- type exports ------------------------------------------
// Drizzle's $inferSelect / $inferInsert give the ergonomic row types
// that callers consume from `@/lib/api/*`.

export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;

export type Collector = typeof collectors.$inferSelect;
export type NewCollector = typeof collectors.$inferInsert;

export type CollectorGalleryMembership =
  typeof collectorGalleryMembership.$inferSelect;
export type NewCollectorGalleryMembership =
  typeof collectorGalleryMembership.$inferInsert;

export type ArtistProfile = typeof artistProfiles.$inferSelect;
export type NewArtistProfile = typeof artistProfiles.$inferInsert;

export type Artwork = typeof artworks.$inferSelect;
export type NewArtwork = typeof artworks.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type ProvenanceEntry = typeof provenanceEntries.$inferSelect;
export type NewProvenanceEntry = typeof provenanceEntries.$inferInsert;

export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type NewVerificationRequest = typeof verificationRequests.$inferInsert;
