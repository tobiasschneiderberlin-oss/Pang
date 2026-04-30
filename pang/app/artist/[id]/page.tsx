/**
 * Artist detail page — Server Component shell.
 *
 * Fetches the artist + their artworks in parallel, then renders
 * `ArtistClient` for the interactive bits (video modal, circle CTA).
 */

import { notFound } from "next/navigation";
import { getArtistById, listArtworksByArtist, listArtistCircle } from "@/lib/api/server";
import ArtistClient from "./ArtistClient";

export const dynamic = "force-dynamic";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [artist, artistArtworks, circle] = await Promise.all([
    getArtistById(id),
    listArtworksByArtist(id),
    listArtistCircle(id),
  ]);

  if (!artist) notFound();

  return (
    <ArtistClient
      artist={artist}
      artistArtworks={artistArtworks}
      circle={circle}
    />
  );
}
