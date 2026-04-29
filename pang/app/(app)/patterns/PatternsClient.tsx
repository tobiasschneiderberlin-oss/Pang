"use client";

import { useState } from "react";
import { Settings, Share2, TrendingUp, Palette, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Artist, Artwork } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/share-sheet";
import { CollectorMilestones } from "@/components/collector-milestones";

export default function PatternsClient({
  artworks,
  artists,
}: {
  artworks: readonly Artwork[];
  artists: readonly Artist[];
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "deep-dive" | "milestones">("overview");
  const [isShareOpen, setIsShareOpen] = useState(false);

  const today = new Date();

  const totalWorks = artworks.length;
  const totalArtists = artists.length;

  const movementCounts: Record<string, number> = {};
  artworks.forEach(artwork => {
    const movement = artwork.movement || "Contemporary";
    movementCounts[movement] = (movementCounts[movement] || 0) + 1;
  });
  const topMovements = Object.entries(movementCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const mediumCounts: Record<string, number> = {};
  artworks.forEach(artwork => {
    const medium = artwork.medium.split(",")[0].trim();
    mediumCounts[medium] = (mediumCounts[medium] || 0) + 1;
  });
  const topMediums = Object.entries(mediumCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const years = artworks.map(a => a.year).filter(Boolean).sort();
  const earliestYear = years[0] || "N/A";
  const latestYear = years[years.length - 1] || "N/A";

  const artistWorkCounts: Record<string, number> = {};
  artworks.forEach(artwork => {
    artistWorkCounts[artwork.artistId] = (artistWorkCounts[artwork.artistId] || 0) + 1;
  });
  const topArtistIds = Object.entries(artistWorkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  return (
    <main className="min-h-dvh pb-24 safe-area-inset-top">
      {/* Header */}
      <header className="px-4 pt-12 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Insights</h1>
            <p className="text-sm text-muted-foreground mt-0.5">understand your collection</p>
          </div>
          <Link 
            href="/settings" 
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <Settings size={20} className="text-muted-foreground" />
          </Link>
        </div>
      </header>

      {/* Tab toggle — active tab gets lime pill */}
      <div className="px-4 mt-4">
        <div className="flex bg-muted rounded-full p-1">
          {(["overview", "deep-dive", "milestones"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {tab === "deep-dive" ? "deep dive" : tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="px-4 mt-6 space-y-4">
          {/* Stats grid — lime numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Palette size={14} />
                <span className="text-xs uppercase tracking-wider">works</span>
              </div>
              <p className="text-4xl font-light text-accent">{totalWorks}</p>
              <p className="text-xs text-muted-foreground mt-0.5">in collection</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp size={14} />
                <span className="text-xs uppercase tracking-wider">artists</span>
              </div>
              <p className="text-4xl font-light text-accent">{totalArtists}</p>
              <p className="text-xs text-muted-foreground mt-0.5">represented</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar size={14} />
                <span className="text-xs uppercase tracking-wider">earliest</span>
              </div>
              <p className="text-3xl font-light text-accent">{earliestYear}</p>
              <p className="text-xs text-muted-foreground mt-0.5">year in collection</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin size={14} />
                <span className="text-xs uppercase tracking-wider">movements</span>
              </div>
              <p className="text-4xl font-light text-accent">{Object.keys(movementCounts).length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">art movements</p>
            </div>
          </div>

          {/* Collection focus — lime progress bars */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">collection focus</h3>
            <div className="space-y-4">
              {topMovements.map(([movement, count]) => {
                const pct = Math.round((count / totalWorks) * 100);
                return (
                  <div key={movement}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="lowercase font-medium">{movement}</span>
                      <span className="text-muted-foreground text-xs">{count} works</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share CTA — lime button */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-medium">share your taste</h3>
            <p className="text-sm text-muted-foreground mt-1 text-balance">
              create a beautiful snapshot of your collection to share with fellow collectors
            </p>
            <button 
              onClick={() => setIsShareOpen(true)}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-full text-sm font-semibold"
            >
              <Share2 size={14} />
              generate collection card
            </button>
          </div>
        </div>
      )}

      {activeTab === "deep-dive" && (
        <div className="px-4 mt-6 space-y-4">
          {/* Top Artists */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">top artists in your collection</h3>
            <div className="space-y-4">
              {topArtistIds.map((artistId, i) => {
                const artist = artists.find(a => a.id === artistId);
                const workCount = artistWorkCounts[artistId];
                if (!artist) return null;
                return (
                  <Link key={artistId} href={`/artist/${artistId}`} className="flex items-center gap-4">
                    {/* Rank number in lime */}
                    <span className="text-2xl font-light text-accent w-6 flex-shrink-0">{i + 1}</span>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {artist.imageUrl && (
                        <Image src={artist.imageUrl} alt={artist.name} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{artist.name}</p>
                      <p className="text-xs text-muted-foreground">{workCount} works</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Medium breakdown — lime progress bars */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">by medium</h3>
            <div className="space-y-4">
              {topMediums.map(([medium, count]) => {
                const pct = Math.round((count / totalWorks) * 100);
                return (
                  <div key={medium}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="lowercase">{medium}</span>
                      <span className="text-muted-foreground text-xs">{count} works</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline — lime leading dot */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">collection timeline</h3>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-0 w-px bg-border" />
              <div className="space-y-5 pl-10">
                {artworks.slice(0, 5).map((artwork, i) => (
                  <Link key={artwork.id} href={`/artwork/${artwork.id}`} className="block relative">
                    <div className={cn(
                      "absolute -left-[34px] w-3 h-3 rounded-full border-2 border-background",
                      i === 0 ? "bg-accent" : "bg-border"
                    )} />
                    <p className="text-xs text-muted-foreground">{artwork.year}</p>
                    <p className="font-medium lowercase text-sm">{artwork.title}</p>
                    <p className="text-xs text-muted-foreground">{artwork.artistName}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "milestones" && (
        <div className="px-4 mt-6">
          <CollectorMilestones
            totalWorks={totalWorks}
            totalArtists={totalArtists}
            nationalities={new Set(artists.map(a => a.nationality)).size}
            collectionStartDate={new Date(2024, 0, 1)}
          />
        </div>
      )}

      {/* Share sheet */}
      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title="My Art Collection"
        subtitle={`${totalWorks} works by ${totalArtists} artists`}
      />
    </main>
  );
}
