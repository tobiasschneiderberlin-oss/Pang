/**
 * PANG — artists API.
 *
 * See `lib/api/artworks.ts` for the seam contract. Drizzle-backed,
 * async, returns the existing `Artist` type so the v0 UI components
 * compile unchanged.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { artistProfiles } from "../db/schema";
import type { Artist } from "./types";

type DbArtistProfile = typeof artistProfiles.$inferSelect;

function toArtist(row: DbArtistProfile): Artist {
  const media = row.media as DbArtistProfile["media"];
  return {
    id: row.id,
    name: row.name,
    bio: row.bio ?? "",
    nationality: row.nationality ?? "",
    birthYear: row.birthYear ?? 0,
    imageUrl: row.imageUrl ?? undefined,
    studioPhotos: media?.studioPhotos,
    voiceNotes: media?.voiceNotes?.map((v) => ({
      type: "voice-note",
      url: v.url,
      title: v.title,
      duration: v.duration,
    })),
    videos: media?.videos?.map((v) => ({
      type: "video",
      url: v.url,
      title: v.title,
      duration: v.duration,
      thumbnail: v.thumbnail,
    })),
    personalMessages: media?.personalMessages,
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
  };
}

/** List every artist profile in the gallery. */
export async function listArtists(): Promise<readonly Artist[]> {
  const rows = await db.select().from(artistProfiles).orderBy(artistProfiles.name);
  return rows.map(toArtist);
}

/** Find an artist by id. Returns `undefined` when not found. */
export async function getArtistById(id: string): Promise<Artist | undefined> {
  const rows = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.id, id))
    .limit(1);
  return rows[0] ? toArtist(rows[0]) : undefined;
}
