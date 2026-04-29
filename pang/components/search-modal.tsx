"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Image as ImageIcon, User, Mic } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Artist, Artwork } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  artworks: readonly Artwork[];
  artists: readonly Artist[];
}

export function SearchModal({ isOpen, onClose, artworks, artists }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize Web Speech API
  useEffect(() => {
    // `webkitSpeechRecognition` / `SpeechRecognition` are not in the standard
    // lib.dom typings, so cast through `any` to access them.
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event: any) => {
        // `isFinal` lives on each SpeechRecognitionResult, not on the event.
        // The previous check (`event.isFinal`) was always undefined, so the
        // transcript was never committed to `query`. Walk the results in
        // this batch and commit on any final result.
        let transcript = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        if (isFinal) {
          setQuery(transcript.toLowerCase().trim());
        }
      };
    }
  }, []);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setQuery("");
      recognitionRef.current.start();
    }
  };

  const filteredArtworks = query.length >= 2
    ? artworks.filter(a => 
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.artistName.toLowerCase().includes(query.toLowerCase()) ||
        a.medium.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const filteredArtists = query.length >= 2
    ? artists.filter(a => 
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.nationality.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];

  const hasResults = filteredArtworks.length > 0 || filteredArtists.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pt-12 safe-area-inset-top border-b border-border">
        <div className="flex-1 flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search artworks, artists..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="p-1">
              <X size={16} className="text-muted-foreground" />
            </button>
          ) : (
            <button
              onClick={handleVoiceSearch}
              className={cn(
                "p-1 transition-colors",
                isListening ? "text-accent" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="voice search"
            >
              <Mic size={16} className={isListening ? "animate-pulse" : ""} />
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-sm font-medium text-accent">
          cancel
        </button>
      </div>

      {/* Results */}
      <div className="overflow-y-auto" style={{ height: "calc(100dvh - 80px)" }}>
        {query.length < 2 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">type to search your collection</p>
          </div>
        ) : !hasResults ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">no results for &quot;{query}&quot;</p>
          </div>
        ) : (
          <div className="p-4">
            {/* Artists */}
            {filteredArtists.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">artists</p>
                <div className="space-y-2">
                  {filteredArtists.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/artist/${artist.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                    >
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                        {artist.imageUrl ? (
                          <Image src={artist.imageUrl} alt={artist.name} fill className="object-cover rounded-full" />
                        ) : (
                          <User size={18} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{artist.name}</p>
                        <p className="text-xs text-muted-foreground">{artist.nationality}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Artworks */}
            {filteredArtworks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">artworks</p>
                <div className="space-y-2">
                  {filteredArtworks.map((artwork) => (
                    <Link
                      key={artwork.id}
                      href={`/artwork/${artwork.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl"
                    >
                      <div className="relative w-14 h-14 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                        <Image
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate lowercase">{artwork.title}</p>
                        <p className="text-xs text-muted-foreground">{artwork.artistName}</p>
                        <p className="text-xs text-muted-foreground">{artwork.year}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
