/**
 * Artwork detail page — Server Component shell.
 *
 * Fetches the artwork + the matching artist + prev/next neighbours for
 * keyboard / swipe navigation, then renders the existing v0 UI in
 * `ArtworkClient` which keeps share sheets, fullscreen, video, and
 * touch handlers.
 */

import { notFound } from "next/navigation";
import {
  getArtistById,
  getArtworkById,
  listArtworks,
} from "@/lib/api/server";
import ArtworkClient from "./ArtworkClient";

// Per-request render — RLS will eventually scope visibility per user.
export const dynamic = "force-dynamic";

export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [artwork, allArtworks] = await Promise.all([
    getArtworkById(id),
    listArtworks(),
  ]);

  if (!artwork) notFound();

  const artist = artwork.artistId
    ? (await getArtistById(artwork.artistId)) ?? null
    : null;

  // Prev/next within the current visible set (sorted by created_at).
  const idx = allArtworks.findIndex((a) => a.id === id);
  const prev = idx > 0 ? { id: allArtworks[idx - 1]!.id } : null;
  const next =
    idx >= 0 && idx < allArtworks.length - 1
      ? { id: allArtworks[idx + 1]!.id }
      : null;

  return (
    <ArtworkClient
      artwork={artwork}
      artist={artist}
      prev={prev}
      next={next}
    />
  );
}
