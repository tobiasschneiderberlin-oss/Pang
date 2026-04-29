/**
 * Collection page — Server Component shell.
 *
 * Fetches the artwork + artist set via the Drizzle-backed `lib/api/*`
 * modules, then renders the existing v0 UI in `CollectionClient`
 * which keeps the zoom / search / filter / favourites interactivity.
 *
 * Auth-scope note: today the queries run via the service-role
 * connection so they return all 26 seeded artworks. When Supabase
 * Auth lands and the page is gated, the queries flip to the
 * authenticated context and RLS returns just the caller's collection.
 */

import { listArtists, listArtworks } from "@/lib/api/server";
import CollectionClient from "./CollectionClient";

// Per-request render — once Supabase Auth gates this page, the view
// is user-specific and must never be cached across collectors.
export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const [artworks, artists] = await Promise.all([
    listArtworks(),
    listArtists(),
  ]);
  return <CollectionClient artworks={artworks} artists={artists} />;
}
