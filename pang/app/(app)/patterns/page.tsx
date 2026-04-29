/**
 * Patterns / Insights — Server Component shell.
 *
 * Reads the full artwork + artist set so the dashboards (movements,
 * mediums, year range, top artists) reflect the live DB rather than
 * the v0 mock arrays.
 */

import { listArtists, listArtworks } from "@/lib/api/server";
import PatternsClient from "./PatternsClient";

export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const [artworks, artists] = await Promise.all([
    listArtworks(),
    listArtists(),
  ]);
  return <PatternsClient artworks={artworks} artists={artists} />;
}
