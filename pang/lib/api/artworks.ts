/**
 * PANG — artworks API.
 *
 * Server-side reads against Drizzle. Today these queries run via the
 * service-role connection (`lib/db/index.ts`) which bypasses RLS —
 * fine while there's no authenticated session yet. When Supabase Auth
 * lands, the client switches to the authenticated context and RLS
 * gates every read by `auth.uid()`.
 *
 * Shape contract: returns the existing `Artwork` type from
 * `lib/data.ts` (which the v0 UI was built against). Fields the DB
 * doesn't store (e.g. `gradient`) are derived deterministically from
 * the artwork id so re-renders are stable.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { artworks as artworksTbl } from "../db/schema";
import type { Artwork } from "./types";

const GRADIENTS = [
  "sage",
  "warm",
  "sunset",
  "pink-purple",
  "lime-dark",
] as const;

/** Deterministic hash → gradient bucket so cards keep the same colour
 *  across renders without storing a value in the DB. */
function gradientFor(id: string): Artwork["gradient"] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]!;
}

type DbArtwork = typeof artworksTbl.$inferSelect;

function toArtwork(row: DbArtwork): Artwork {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artistId ?? "",
    artistName: row.artistName,
    year: row.year ?? 0,
    medium: row.medium ?? "",
    dimensions: row.dimensions ?? "",
    imageUrl: row.imageUrl ?? "/placeholder.svg",
    gradient: gradientFor(row.id),
    visibility:
      (row.visibility as "private" | "shared" | "public" | undefined) ??
      "private",
    verified: row.verified,
    verifiedDate: row.verifiedAt
      ? row.verifiedAt.toISOString().slice(0, 10)
      : undefined,
    description: row.description ?? undefined,
    movement: row.movement ?? undefined,
  };
}

/** List every artwork visible to the caller. */
export async function listArtworks(): Promise<readonly Artwork[]> {
  const rows = await db.select().from(artworksTbl).orderBy(artworksTbl.createdAt);
  return rows.map(toArtwork);
}

/** RFC 4122 UUID shape — used to short-circuit before the DB query
 *  so a malformed id (e.g. "aaaa" from a hand-typed URL) returns undefined
 *  instead of letting Postgres throw `invalid input syntax for type uuid`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Find an artwork by id. Returns `undefined` when not found / not visible. */
export async function getArtworkById(id: string): Promise<Artwork | undefined> {
  if (!UUID_RE.test(id)) return undefined;
  const rows = await db
    .select()
    .from(artworksTbl)
    .where(eq(artworksTbl.id, id))
    .limit(1);
  return rows[0] ? toArtwork(rows[0]) : undefined;
}

/** List artworks attributed to a specific artist (by artist_profile id). */
export async function listArtworksByArtist(
  artistId: string,
): Promise<readonly Artwork[]> {
  if (!UUID_RE.test(artistId)) return [];
  const rows = await db
    .select()
    .from(artworksTbl)
    .where(eq(artworksTbl.artistId, artistId))
    .orderBy(artworksTbl.createdAt);
  return rows.map(toArtwork);
}
