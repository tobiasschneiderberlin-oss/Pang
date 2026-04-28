"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Share2, Heart, FileText, Download } from "lucide-react";
import { getArtwork, getArtist, artworks } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ShareSheet } from "@/components/share-sheet";
import { FullscreenViewer } from "@/components/fullscreen-viewer";
import { VoiceNotePlayer, VideoThumbnail, VideoModal, ArtistMessageCard } from "@/components/artist-media";

interface ArtworkPageProps {
  params: Promise<{ id: string }>;
}

export default function ArtworkPage({ params }: ArtworkPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

  const artwork = getArtwork(id);
  const artist = artwork ? getArtist(artwork.artistId) : null;
  const [visibility, setVisibility] = useState<'private' | 'shared'>(artwork?.visibility as 'private' | 'shared' || 'private');

  const currentIndex = artworks.findIndex(a => a.id === id);
  const prevArtwork = currentIndex > 0 ? artworks[currentIndex - 1] : null;
  const nextArtwork = currentIndex < artworks.length - 1 ? artworks[currentIndex + 1] : null;

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && nextArtwork) router.push(`/artwork/${nextArtwork.id}`);
    if (distance < -minSwipeDistance && prevArtwork) router.push(`/artwork/${prevArtwork.id}`);
  };

  const handleBack = () => {
    router.push('/collection');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevArtwork) router.push(`/artwork/${prevArtwork.id}`);
      else if (e.key === "ArrowRight" && nextArtwork) router.push(`/artwork/${nextArtwork.id}`);
      else if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevArtwork, nextArtwork, router]);

  if (!artwork) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Artwork not found</p>
      </div>
    );
  }

  const visibilityLabel = {
    private: 'Private',
    shared: 'Shared',
    public: 'Public',
  };

  return (
    <main className="min-h-dvh bg-background pb-6">

      {/* Artwork image — dominant, full-width */}
      <div
        className="relative w-full bg-muted cursor-zoom-in"
        style={{ height: "65dvh" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => setIsFullscreen(true)}
      >
        <Image
          src={artwork.imageUrl}
          alt={artwork.title}
          fill
          className="object-contain"
          priority
          sizes="100vw"
        />

        {/* Back button - minimal semi-transparent chevron, top-left */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 safe-area-inset-top z-10 w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
          style={{
            background: "rgba(46, 46, 46, 0.6)",
            backdropFilter: "blur(12px)"
          }}
        >
          <ChevronLeft size={24} className="text-background" />
        </button>

        {/* Prev/next arrows — desktop */}
        {prevArtwork && (
          <Link
            href={`/artwork/${prevArtwork.id}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-background/60 backdrop-blur-sm rounded-full items-center justify-center hidden md:flex"
          >
            <ChevronLeft size={24} />
          </Link>
        )}
        {nextArtwork && (
          <Link
            href={`/artwork/${nextArtwork.id}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-background/60 backdrop-blur-sm rounded-full items-center justify-center hidden md:flex"
          >
            <ChevronRight size={24} />
          </Link>
        )}
      </div>

      {/* Title block — museum label style */}
      <div className="px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold lowercase tracking-tight leading-snug">{artwork.title}</h1>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setLiked(!liked)}
              className="p-1.5"
              aria-label={liked ? "Unlike artwork" : "Like artwork"}
            >
              <Heart
                size={20}
                className={cn(
                  "transition-colors",
                  liked ? "fill-accent text-accent" : "text-muted-foreground/50"
                )}
              />
            </button>
            <button
              onClick={() => setIsShareOpen(true)}
              className="p-1.5"
              aria-label="Share artwork"
            >
              <Share2 size={20} className="text-muted-foreground/50" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-foreground font-medium">{artwork.artistName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{artwork.year}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {artwork.medium}
        </p>
        <p className="text-sm text-muted-foreground">
          {artwork.dimensions}
        </p>

        {/* Artist row - tappable entry to artist page */}
        {artist && (
          <Link
            href={`/artist/${artist.id}`}
            className="flex items-center gap-2.5 bg-muted/30 hover:bg-muted/50 rounded-xl p-3 mt-4 transition-colors"
          >
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">
              {artist.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{artist.name}</p>
              <p className="text-xs text-muted-foreground">{artist.nationality}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          </Link>
        )}
        
        {/* Description integrated into title block */}
        {artwork.description && (
          <p className="text-sm text-foreground/70 leading-relaxed mt-4 border-t border-border pt-4">
            {artwork.description}
          </p>
        )}
      </div>


      {/* Content sections */}
      <div className="px-4 space-y-8 mt-6">

        {/* Description removed from here - now in title block */}

        {/* Artist notes about this work */}
        {artwork.artistNotes && artwork.artistNotes.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">From the Artist</h3>
            <div className="space-y-3">
              {artwork.artistNotes.map((note, index) => (
                <ArtistMessageCard key={index} message={note} />
              ))}
            </div>
          </div>
        )}

        {/* Artist voice notes / videos for this work */}
        {/* Note: wrap in Boolean(...) — `0 && X` evaluates to `0`, which React */}
        {/* would render as the literal text "0" if both arrays are empty. */}
        {artist && Boolean((artist.voiceNotes?.length ?? 0) || (artist.videos?.length ?? 0)) && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Artist Media</h3>
            <div className="space-y-3">
              {artist.voiceNotes?.map((note, index) => (
                <VoiceNotePlayer key={`voice-${index}`} note={note} />
              ))}
              {artist.videos?.map((video, index) => (
                <VideoThumbnail 
                  key={`video-${index}`} 
                  video={video} 
                  onPlay={() => setActiveVideo(index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {artwork.documents && artwork.documents.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Documents</h3>
            <div className="space-y-2">
              {artwork.documents.map((doc) => (
                <button
                  key={doc.id}
                  className="w-full flex items-center gap-3 bg-muted rounded-xl px-4 py-3 text-left"
                >
                  <FileText size={18} className="text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    {doc.date && (
                      <p className="text-xs text-muted-foreground">{doc.date}</p>
                    )}
                  </div>
                  <Download size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Edit button */}
        <button className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm">
          edit artwork
        </button>
      </div>

      {/* Collector Circle modal */}
      {isPrivacyModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsPrivacyModalOpen(false)}
        >
          <div 
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-muted rounded-full" />
            </div>

            {/* Content */}
            <div className="px-6 pb-8 pt-4">
              {/* PANG logo mark + headline */}
              <div className="flex flex-col items-center text-center mb-6">
                <img
                  src="/pang-logo.svg"
                  alt="PANG"
                  width={48}
                  height={48}
                  className="mb-4"
                />
                <h2 className="text-xl font-semibold">
                  {visibility === 'shared' ? 'In the Collector Circle' : 'Join the Collector Circle'}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {visibility === 'shared' 
                    ? `You're connected with other ${artist?.name.split(' ')[1] || artist?.name || "this artist's"} collectors.`
                    : `Share that you own this work with other verified ${artist?.name.split(' ')[1] || artist?.name || "this artist's"} collectors.`
                  }
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {visibility !== 'shared' ? (
                  <>
                    <button
                      onClick={() => {
                        setVisibility('shared');
                        setIsPrivacyModalOpen(false);
                      }}
                      className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm"
                    >
                      Join Circle
                    </button>
                    <button
                      onClick={() => setIsPrivacyModalOpen(false)}
                      className="w-full py-3.5 text-muted-foreground rounded-full font-medium text-sm"
                    >
                      Keep Private
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsPrivacyModalOpen(false)}
                      className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => {
                        setVisibility('private');
                        setIsPrivacyModalOpen(false);
                      }}
                      className="w-full py-3.5 text-muted-foreground rounded-full font-medium text-sm"
                    >
                      Leave Circle
                    </button>
                  </>
                )}
              </div>

              {/* Safe area */}
              <div className="safe-area-inset-bottom" />
            </div>
          </div>
        </div>
      )}

      <FullscreenViewer
        src={artwork.imageUrl}
        alt={artwork.title}
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
      />

      {/* Video modal */}
      {activeVideo !== null && artist?.videos?.[activeVideo] && (
        <VideoModal
          video={artist.videos[activeVideo]}
          isOpen={true}
          onClose={() => setActiveVideo(null)}
        />
      )}

      <ShareSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={artwork.title}
        subtitle={`${artwork.artistName} · ${artwork.year}`}
      />
    </main>
  );
}

// Mock data for other public collectors of the same artist
// Map artist IDs to collectors who also collect that artist
const artistCollectorMap: Record<string, string[]> = {
  'willehad-eilers': ['c1', 'c2'],
  'heiko-zahlmann': ['c2', 'c3'],
  'tatjana-doll': ['c3', 'c4'],
  'james-jean': ['c1'],
  'hilary-pecis': ['c2', 'c4'],
  'brian-lotti': ['c1', 'c3'],
};

// Contextual insights component
function ArtworkInsights({ 
  artwork, 
  currentIndex, 
  totalArtworks 
}: { 
  artwork: NonNullable<ReturnType<typeof getArtwork>>; 
  currentIndex: number;
  totalArtworks: number;
}) {
  // Count works by same artist
  const worksByArtist = artworks.filter(a => a.artistId === artwork.artistId).length;
  
  // Get acquisition info from provenance
  const acquisitionDate = artwork.provenance?.[0]?.date;
  
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {worksByArtist > 1 && (
        <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
          1 of {worksByArtist} by {artwork.artistName.split(' ')[0]}
        </span>
      )}
      {acquisitionDate && (
        <span className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
          Acquired {acquisitionDate}
        </span>
      )}
      {artwork.verified && (
        <span className="text-xs bg-accent/10 px-2.5 py-1 rounded-full text-accent">
          Gallery verified
        </span>
      )}
    </div>
  );
}
