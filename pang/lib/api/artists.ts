/**
 * PANG — artists API.
 *
 * See `lib/api/artworks.ts` for the seam contract. Same rules apply:
 *   - Sync today; async when Supabase lands.
 *   - Callers import from `@/lib/api/artists`, never from `@/lib/data`.
 */

import { artists as _allArtists, getArtist as _getArtist } from "../data";
import type { Artist } from "./types";

/** List every artist whose works appear in the visible collection set. */
export function listArtists(): readonly Artist[] {
  return _allArtists;
}

/** Find an artist by id. Returns `undefined` when not found. */
export function getArtistById(id: string): Artist | undefined {
  return _getArtist(id);
}
