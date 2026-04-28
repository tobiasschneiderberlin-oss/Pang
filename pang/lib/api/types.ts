/**
 * PANG — domain types.
 *
 * Re-exports the type surface from `lib/data.ts` so that consumers
 * can stop importing from the mock-data module directly. New code
 * MUST import types from `@/lib/api/types`, not `@/lib/data`.
 *
 * When the Supabase + Drizzle layer lands, types will move here and
 * be derived from the schema (`pgTable(...)`-style inference). The
 * external surface won't change.
 */

export type {
  Artist,
  ArtistMedia,
  ArtistMessage,
  Artwork,
  ArtworkDocument,
  Collector,
  CollectorContact,
  ProvenanceEntry,
} from "../data";
