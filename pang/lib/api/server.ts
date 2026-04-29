/**
 * PANG — server-side API barrel.
 *
 * Marked `server-only` — any Client Component that imports from here
 * fails at build time with a clear error. Use this barrel from
 * Server Components / Server Actions / Route Handlers when fetching
 * Drizzle-backed data.
 *
 * The browser-safe surface (types + mock-data legacy) lives at
 * `@/lib/api`. The split is the price of having a real Postgres
 * driver in the dependency graph: postgres-js is Node-only, and any
 * code path that reaches it must stay server-side.
 */

import "server-only";

export { getArtworkById, listArtworks, listArtworksByArtist } from "./artworks";
export { getArtistById, listArtists } from "./artists";
export { listArtistCircle, listCollectors } from "./collectors";
export { getDocumentById, listDocumentsForArtwork } from "./documents";
export type * from "./types";
