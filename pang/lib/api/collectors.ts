/**
 * PANG — collectors API.
 *
 * Implements the artist-circle visibility rule from ADR-001 Q4: a
 * collector becomes a member of an artist's circle when they own
 * at least one work by that artist. This API will eventually honour
 * the per-collector `discoverable_in_circles` flag and exclude
 * opted-out collectors.
 *
 * See `lib/api/artworks.ts` for the seam contract.
 */

import {
  collectors as _allCollectors,
  getCollectorsForArtist as _getCollectorsForArtist,
  getCollectorById as _getCollectorById,
  collectorIsInCircle as _collectorIsInCircle,
} from "../data";
import type { Collector } from "./types";

/** List every collector visible to the caller. */
export function listCollectors(): readonly Collector[] {
  return _allCollectors;
}

/**
 * List collectors who own at least one work by the given artist —
 * the artist's circle.
 *
 * TODO (post-Supabase): filter by `discoverable_in_circles = true`
 * and gallery-membership scope (a collector should never appear in
 * a circle visible from a gallery they're not a member of).
 */
export function listArtistCircle(artistId: string): readonly Collector[] {
  return _getCollectorsForArtist(artistId);
}

/** Look up a collector by id. Returns undefined when not found. */
export function getCollectorById(id: string): Collector | undefined {
  return _getCollectorById(id);
}

/** True when the collector belongs to the given artist's circle. */
export function isCollectorInArtistCircle(
  collectorId: string,
  artistId: string,
): boolean {
  return _collectorIsInCircle(collectorId, artistId);
}
