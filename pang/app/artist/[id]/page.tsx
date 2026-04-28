"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Share2, ExternalLink, Instagram, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getArtist, getArtworksByArtist } from "@/lib/api";
import { ArtworkGridCard } from "@/components/artwork-card";
import { VoiceNotePlayer, VideoThumbnail, VideoModal, ArtistMessageCard, StudioPhotos } from "@/components/artist-media";

interface ArtistPageProps {
  params: Promise<{ id: string }>;
}

export default function ArtistPage({ params }: ArtistPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const artist = getArtist(id);
  const artistArtworks = getArtworksByArtist(id);
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [isCircleOpen, setIsCircleOpen] = useState(false);
  const [inCircle, setInCircle] = useState(false);

  if (!artist) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Artist not found</p>
      </div>
    );
  }

  const featuredImage = artistArtworks[0]?.imageUrl;

  return (
    <main className="min-h-dvh bg-background">
      {/* Header with background */}
      <div className="relative h-64 bg-muted">
        {featuredImage && (
          <Image
            src={featuredImage}
            alt=""
            fill
            className="object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        {/* Navigation */}
        <header className="absolute top-0 left-0 right-0 safe-area-inset-top p-4 pt-12 flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center"
          >
            <ChevronLeft size={24} />
          </button>
          <button className="w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Share2 size={20} />
          </button>
        </header>
      </div>

      {/* Content */}
      <div className="px-4 -mt-20 relative z-10 pb-8">
        {/* Profile card */}
        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/40 rounded-full flex items-center justify-center text-2xl font-medium">
              {artist.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-medium">{artist.name}</h1>
              <p className="text-muted-foreground">
                {artist.nationality}, b. {artist.birthYear}
              </p>
              {/* Social links */}
              {(artist.instagram || artist.website) && (
                <div className="flex items-center gap-3 mt-2">
                  {artist.instagram && (
                    <a 
                      href={`https://instagram.com/${artist.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-accent"
                    >
                      <Instagram size={14} /> {artist.instagram}
                    </a>
                  )}
                  {artist.website && (
                    <a 
                      href={artist.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Globe size={14} /> Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <p className="mt-4 text-foreground/80 leading-relaxed">
            {artist.bio}
          </p>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 py-2.5 bg-muted rounded-full text-sm font-medium flex items-center justify-center gap-2">
              <ExternalLink size={14} />
              Gallery profile
            </button>
          </div>
        </div>

        {/* Collector Circle CTA */}
        <button
          onClick={() => setIsCircleOpen(true)}
          className={cn(
            "w-full p-4 rounded-2xl border transition-colors text-left mt-6",
            inCircle ? "border-accent/20 bg-accent/5 hover:bg-accent/10" : "border-border hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-3">
            <img
              src="/pang-logo.svg"
              alt="PANG"
              width={36}
              height={36}
              className="flex-shrink-0"
            />
            <div className="flex-1">
              <h4 className="font-semibold text-sm">
                {inCircle ? 'In the Collector Circle' : 'Join the Collector Circle'}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {inCircle
                  ? `Connected with fellow ${artist.name} collectors`
                  : `Connect with fellow collectors of ${artist.name}`}
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          </div>
        </button>

        {/* Collector Circle Modal */}
        {isCircleOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsCircleOpen(false)}
          >
            <div
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-muted rounded-full" />
              </div>
              <div className="px-6 pb-8 pt-4">
                <div className="flex flex-col items-center text-center mb-6">
                  <img
                    src="/pang-logo.svg"
                    alt="PANG"
                    width={48}
                    height={48}
                    className="mb-4"
                  />
                  <h2 className="text-xl font-semibold">
                    {inCircle ? 'In the Collector Circle' : 'Join the Collector Circle'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {inCircle
                      ? `You are part of the exclusive ${artist.name} collector community.`
                      : `Become part of an exclusive community of verified ${artist.name} collectors.`}
                  </p>
                </div>
                <div className="space-y-3">
                  {!inCircle ? (
                    <>
                      <button
                        onClick={() => { setInCircle(true); setIsCircleOpen(false); }}
                        className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm"
                      >
                        Join Circle
                      </button>
                      <button
                        onClick={() => setIsCircleOpen(false)}
                        className="w-full py-3.5 text-muted-foreground rounded-full font-medium text-sm"
                      >
                        Keep Private
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsCircleOpen(false)}
                        className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-semibold text-sm"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => { setInCircle(false); setIsCircleOpen(false); }}
                        className="w-full py-3.5 text-muted-foreground rounded-full font-medium text-sm"
                      >
                        Leave Circle
                      </button>
                    </>
                  )}
                </div>
                <div className="safe-area-inset-bottom" />
              </div>
            </div>
          </div>
        )}

        {/* Personal messages from artist */}
        {artist.personalMessages && artist.personalMessages.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Personal Messages
            </h2>
            <div className="space-y-3">
              {artist.personalMessages.map((message, index) => (
                <ArtistMessageCard key={index} message={message} />
              ))}
            </div>
          </section>
        )}

        {/* Voice notes */}
        {artist.voiceNotes && artist.voiceNotes.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Voice Notes
            </h2>
            <div className="space-y-3">
              {artist.voiceNotes.map((note, index) => (
                <VoiceNotePlayer key={index} note={note} />
              ))}
            </div>
          </section>
        )}

        {/* Videos */}
        {artist.videos && artist.videos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Videos
            </h2>
            <div className="space-y-3">
              {artist.videos.map((video, index) => (
                <VideoThumbnail 
                  key={index} 
                  video={video} 
                  onPlay={() => setActiveVideo(index)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Studio photos */}
        {artist.studioPhotos && artist.studioPhotos.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Studio
            </h2>
            <StudioPhotos photos={artist.studioPhotos} />
          </section>
        )}

        {/* Works in collection */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            In your collection ({artistArtworks.length})
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {artistArtworks.map((artwork) => (
              <ArtworkGridCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        </section>
      </div>

      {/* Video modal */}
      {activeVideo !== null && artist.videos?.[activeVideo] && (
        <VideoModal
          video={artist.videos[activeVideo]}
          isOpen={true}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </main>
  );
}
