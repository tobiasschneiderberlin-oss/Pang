/**
 * PANG — artworks API.
 *
 * The single place pages and components fetch artwork data from. Today
 * this is a synchronous wrapper over `lib/data.ts` (mock data). When
 * Supabase + Drizzle land:
 *   - These functions become async (return Promises).
 *   - The implementation queries Drizzle.
 *   - Callers add `await`. The signatures shift from `T` to `Promise<T>`.
 *
 * The import path (`@/lib/api/artworks`) does not change.
 *
 * RLS-relevant: when async, every read carries the calling user's
 * Supabase auth context, so RLS policies enforce visibility. Bypassing
 * this layer would bypass RLS — that's the lock-in this seam protects.
 */

import {
  artworks as _allArtworks,
  getArtwork as _getArtwork,
  getArtworksByArtist as _getArtworksByArtist,
} from "../data";
import type { Artwork } from "./types";

/** List every artwork visible to the caller. */
export function listArtworks(): readonly Artwork[] {
  return _allArtworks;
}

/** Find an artwork by id. Returns `undefined` when not found / not visible. */
export function getArtworkById(id: string): Artwork | undefined {
  return _getArtwork(id);
}

/** List artworks attributed to a specific artist. */
export function listArtworksByArtist(artistId: string): readonly Artwork[] {
  return _getArtworksByArtist(artistId);
}
