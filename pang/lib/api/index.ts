/**
 * PANG — API barrel.
 *
 * Convenience re-export so `import { getArtworkById, getArtistById }
 * from "@/lib/api"` works. New code can import from this barrel or
 * from the per-domain modules directly. Either is canonical.
 *
 * `@/lib/data` is the mock-data provider only — pages and components
 * MUST NOT import from it. The seam protects:
 *   - RLS context (every read carries auth)
 *   - the sync→async migration when Supabase lands
 *   - the documents table-extraction when the schema flattens
 */

// Backward-compat surface (mock-data symbols re-exported with stable names).
// When Supabase lands, these become async — callers add `await`, the import
// path stays the same.
export * from "../data";

// Future-shape preferred surface (verb-prefixed; survives the async migration).
export { getArtworkById, listArtworks, listArtworksByArtist } from "./artworks";
export { getArtistById, listArtists } from "./artists";
export { listArtistCircle, listCollectors } from "./collectors";
export { getDocumentById, listDocumentsForArtwork } from "./documents";
export type * from "./types";
