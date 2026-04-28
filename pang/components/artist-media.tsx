"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Play, Pause, Volume2, Video, Mic, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtistMedia, ArtistMessage } from "@/lib/data";

// Voice note player
export function VoiceNotePlayer({ note }: { note: ArtistMedia }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    // `audio.play()` returns a Promise that rejects under autoplay
    // restrictions or if the source can't be loaded. Without handling
    // the rejection, the UI flips to "playing" while no audio plays
    // and the browser logs an unhandled promise rejection. Only flip
    // state on resolved play.
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(pct);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  return (
    <div className="flex items-center gap-3 bg-muted rounded-2xl p-3">
      <button
        onClick={togglePlay}
        className="w-10 h-10 bg-accent text-accent-foreground rounded-full flex items-center justify-center flex-shrink-0"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Mic size={12} className="text-muted-foreground" />
          <p className="text-sm font-medium truncate">{note.title}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-100" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{note.duration}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={note.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  );
}

// Video thumbnail/player
export function VideoThumbnail({ 
  video, 
  onPlay 
}: { 
  video: ArtistMedia; 
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="relative aspect-video w-full rounded-2xl overflow-hidden bg-muted group"
    >
      {video.thumbnail && (
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
        <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
          <Play size={24} className="text-foreground ml-1" />
        </div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <span className="text-white text-sm font-medium drop-shadow-lg">{video.title}</span>
        <span className="text-white/80 text-xs tabular-nums drop-shadow-lg">{video.duration}</span>
      </div>
    </button>
  );
}

// Video modal
export function VideoModal({
  video,
  isOpen,
  onClose,
}: {
  video: ArtistMedia;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10 safe-area-inset-top"
      >
        <X size={20} className="text-white" />
      </button>
      <div 
        className="w-full max-w-4xl aspect-video"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={video.url}
          className="w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// Personal message card
export function ArtistMessageCard({ message }: { message: ArtistMessage }) {
  const formattedDate = new Date(message.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-muted rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center">
          <span className="text-xs">✉</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {message.type === 'personal' ? 'Personal message' : 'About this work'} · {formattedDate}
        </span>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed italic">
        &ldquo;{message.text}&rdquo;
      </p>
    </div>
  );
}

// Studio photos gallery
export function StudioPhotos({ photos }: { photos: string[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {photos.map((photo, index) => (
          <button
            key={index}
            onClick={() => setSelectedPhoto(photo)}
            className="relative w-32 h-32 rounded-xl overflow-hidden flex-shrink-0"
          >
            <Image
              src={photo}
              alt={`Studio photo ${index + 1}`}
              fill
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10 safe-area-inset-top"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="relative w-full h-full max-w-4xl max-h-[80vh] m-4">
            <Image
              src={selectedPhoto}
              alt="Studio photo"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

// Installation photos for provenance
export function ProvenancePhotos({ photos }: { photos: string[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-2 mt-2">
        {photos.slice(0, 3).map((photo, index) => (
          <button
            key={index}
            onClick={() => setSelectedPhoto(photo)}
            className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
          >
            <Image
              src={photo}
              alt={`Installation photo ${index + 1}`}
              fill
              className="object-cover"
            />
          </button>
        ))}
        {photos.length > 3 && (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-muted-foreground">+{photos.length - 3}</span>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center z-10 safe-area-inset-top"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="relative w-full h-full max-w-4xl max-h-[80vh] m-4">
            <Image
              src={selectedPhoto}
              alt="Installation photo"
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
