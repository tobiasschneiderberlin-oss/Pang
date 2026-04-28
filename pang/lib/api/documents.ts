/**
 * PANG — documents API.
 *
 * Documents (CoAs, invoices, condition reports, insurance valuations,
 * provenance attestations) are owned by the collector per ADR-001 Q2
 * and tiered per ADR-003. Today the mock data nests documents inside
 * `Artwork.documents`; the future schema lifts them to a top-level
 * `documents` table with `artwork_id` foreign keys and a
 * `sensitivity_tier` column.
 *
 * The functions here normalise that shape: callers always go through
 * `listDocumentsForArtwork(artworkId)` — never `artwork.documents`
 * directly — so the table-extraction migration is invisible.
 */

import { getArtwork as _getArtwork } from "../data";
import type { ArtworkDocument } from "./types";

/** List documents attached to an artwork. */
export function listDocumentsForArtwork(
  artworkId: string,
): readonly ArtworkDocument[] {
  const artwork = _getArtwork(artworkId);
  return artwork?.documents ?? [];
}

/** Find a single document by id, scoped to an artwork. */
export function getDocumentById(
  artworkId: string,
  documentId: string,
): ArtworkDocument | undefined {
  return listDocumentsForArtwork(artworkId).find((d) => d.id === documentId);
}
