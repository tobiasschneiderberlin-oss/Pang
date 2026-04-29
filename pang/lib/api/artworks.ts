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

import { asc, eq } from "drizzle-orm";
import { withDb } from "../db";
import { artworks as artworksTbl, provenanceEntries } from "../db/schema";
import type { Artwork, ProvenanceEntry } from "./types";

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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Display-format a stored date, re-deriving precision from the
 *  sentinel-day convention used by the showcase parser:
 *    YYYY-01-01  → "YYYY"               (year only)
 *    YYYY-MM-15  → "Mon YYYY"           (month only)
 *    other       → "Mon D, YYYY"        (exact day) */
function formatProvenanceDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = m[1]!;
  const month = parseInt(m[2]!, 10);
  const day = parseInt(m[3]!, 10);
  if (month === 1 && day === 1) return year;
  if (day === 15) return `${MONTHS[month - 1]} ${year}`;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

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
    // Verification fields exist on the row but are intentionally not
    // surfaced in the API — no UI renders them today.
    verified: false,
    description: row.description ?? undefined,
    movement: row.movement ?? undefined,
  };
}

/** List every artwork visible to the caller. */
export async function listArtworks(): Promise<readonly Artwork[]> {
  const rows = await withDb((db) =>
    db.select().from(artworksTbl).orderBy(artworksTbl.createdAt),
  );
  return rows.map(toArtwork);
}

/** RFC 4122 UUID shape — used to short-circuit before the DB query
 *  so a malformed id (e.g. "aaaa" from a hand-typed URL) returns undefined
 *  instead of letting Postgres throw `invalid input syntax for type uuid`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Find an artwork by id, with provenance timeline if any. Returns
 *  `undefined` when not found / not visible. */
export async function getArtworkById(id: string): Promise<Artwork | undefined> {
  if (!UUID_RE.test(id)) return undefined;
  return withDb(async (db) => {
    const [row] = await db
      .select()
      .from(artworksTbl)
      .where(eq(artworksTbl.id, id))
      .limit(1);
    if (!row) return undefined;

    // Pull provenance entries (oldest → newest reads as the timeline).
    const provenance = await db
      .select()
      .from(provenanceEntries)
      .where(eq(provenanceEntries.artworkId, id))
      .orderBy(asc(provenanceEntries.eventDate));

    const result: Artwork = toArtwork(row);
    if (provenance.length > 0) {
      result.provenance = provenance.map((p): ProvenanceEntry => ({
        date: p.eventDate
          ? formatProvenanceDate(p.eventDate.toISOString().slice(0, 10))
          : "",
        event: p.event,
        location: p.location ?? undefined,
        photos: (p.photos as string[] | null) ?? undefined,
      }));
    }
    return result;
  });
}

/** List artworks attributed to a specific artist (by artist_profile id). */
export async function listArtworksByArtist(
  artistId: string,
): Promise<readonly Artwork[]> {
  if (!UUID_RE.test(artistId)) return [];
  const rows = await withDb((db) =>
    db
      .select()
      .from(artworksTbl)
      .where(eq(artworksTbl.artistId, artistId))
      .orderBy(artworksTbl.createdAt),
  );
  return rows.map(toArtwork);
}
