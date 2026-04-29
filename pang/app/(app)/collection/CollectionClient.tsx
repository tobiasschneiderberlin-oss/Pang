"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Check,
  Settings,
  FileText,
  Download,
  BarChart3,
  X,
  Plus,
  Sliders,
  LogOut
} from "lucide-react";
import Link from "next/link";
import type { Artwork, Artist } from "@/lib/api";
import { cn } from "@/lib/utils";

import { SearchModal } from "@/components/search-modal";

type ZoomLevel = 1 | 2 | 3 | 4 | 6;
type FilterOption = "all" | "favorites" | "recent" | "by-artist" | "by-medium" | "by-year" | "not-documented";

const ZOOM_LEVELS: ZoomLevel[] = [1, 2, 3, 4, 6];

// Mock user data — replaced when Supabase Auth lands.
const user = {
  name: "Tobias",
  initials: "TS",
};

export default function CollectionClient({
  artworks,
  artists,
}: {
  artworks: readonly Artwork[];
  artists: readonly Artist[];
}) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(3);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  // Favorites empty until we wire user-scoped persistence (post-auth).
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/auth/login";
  };
  
  // Pinch-to-zoom state
  const gridRef = useRef<HTMLDivElement>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<ZoomLevel>(3);

  // Get unique mediums and years for stats
  const uniqueArtists = [...new Set(artworks.map(a => a.artistId))];
  const mediums = [...new Set(artworks.map(a => a.medium.split(" ")[0]))];
  const years = [...new Set(artworks.map(a => a.year))].sort((a, b) => b - a);

  // Filter artworks — default sort: recent first, then liked
  let displayedArtworks = [...artworks].sort((a, b) => {
    const aFav = favorites.has(a.id);
    const bFav = favorites.has(b.id);
    // Both same: keep original order (recent = lower index = first)
    if (aFav === bFav) return 0;
    // Liked comes after non-liked (non-liked = recent, appear first)
    return aFav ? 1 : -1;
  });

  if (activeFilter === "favorites") {
    displayedArtworks = artworks.filter(a => favorites.has(a.id));
  } else if (activeFilter === "recent") {
    displayedArtworks = [...artworks].slice(0, 6);
  } else if (activeFilter === "not-documented") {
    displayedArtworks = artworks.filter(a => !a.documents || a.documents.length === 0);
  }

  // Filter counts
  const filterCounts = {
    all: artworks.length,
    favorites: artworks.filter(a => favorites.has(a.id)).length,
    recent: Math.min(artworks.length, 6),
    "by-artist": artists.length,
    "by-medium": mediums.length,
    "by-year": years.length,
    "not-documented": artworks.filter(a => !a.documents || a.documents.length === 0).length,
  };

  const filterLabels: Record<FilterOption, string> = {
    all: "All",
    favorites: "Favorites",
    recent: "Recent",
    "by-artist": "By Artist",
    "by-medium": "By Medium",
    "by-year": "By Year",
    "not-documented": "Not Documented",
  };

  // Pinch-to-zoom handlers
  const getDistance = (touches: TouchList) => {
    const [t1, t2] = [touches[0], touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialPinchDistance(getDistance(e.touches));
      setInitialZoom(zoomLevel);
    }
  }, [zoomLevel]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      const currentDistance = getDistance(e.touches);
      const ratio = currentDistance / initialPinchDistance;
      
      const currentIndex = ZOOM_LEVELS.indexOf(initialZoom);
      let newIndex = currentIndex;
      
      if (ratio > 1.3) {
        newIndex = Math.max(0, currentIndex - 1);
      } else if (ratio < 0.7) {
        newIndex = Math.min(ZOOM_LEVELS.length - 1, currentIndex + 1);
      }
      
      if (ZOOM_LEVELS[newIndex] !== zoomLevel) {
        setZoomLevel(ZOOM_LEVELS[newIndex]);
        setInitialPinchDistance(currentDistance);
        setInitialZoom(ZOOM_LEVELS[newIndex]);
      }
    }
  }, [initialPinchDistance, initialZoom, zoomLevel]);

  const handleTouchEnd = useCallback(() => {
    setInitialPinchDistance(null);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.addEventListener("touchstart", handleTouchStart, { passive: true });
    grid.addEventListener("touchmove", handleTouchMove, { passive: true });
    grid.addEventListener("touchend", handleTouchEnd);

    return () => {
      grid.removeEventListener("touchstart", handleTouchStart);
      grid.removeEventListener("touchmove", handleTouchMove);
      grid.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Show artist + title labels under each artwork only at the most-zoomed-in view.
  const showInfo = zoomLevel === 1;

  // Masonry layout via CSS columns. Artworks keep their native aspect ratio
  // (no cropping ever), and tiles flow into columns whose count matches
  // the zoom level. The eye reads "this is a curated collection" rather
  // than "this is a uniform photo album."
  const masonryClass = (() => {
    switch (zoomLevel) {
      case 1: return "columns-1";
      case 2: return "columns-2 [column-gap:2px]";
      case 3: return "columns-3 [column-gap:1px]";
      case 4: return "columns-4 [column-gap:1px]";
      case 6: return "columns-6 [column-gap:1px]";
    }
  })();

  return (
    <main className="min-h-dvh bg-background">
      {/* Two floating controls: search + filter + avatar */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="safe-area-inset-top" />
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-md shadow-sm"
            >
              <Search size={20} className="text-foreground" />
            </button>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-md shadow-sm"
            >
              <Sliders size={20} className="text-foreground" />
            </button>
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="pointer-events-auto w-10 h-10 bg-accent rounded-full flex items-center justify-center shadow-sm"
          >
            <span className="text-sm font-semibold text-accent-foreground">{user.initials}</span>
          </button>
        </div>
      </div>

      {/* Masonry grid — every artwork shows in full at its native aspect
          ratio. No cropping, no letterboxing. Tap opens the detail page;
          there is no long-press / multi-select / share / delete flow —
          this is a curated collection, not a photo library. */}
      <div
        ref={gridRef}
        className={cn("touch-pan-y", masonryClass)}
      >
        {displayedArtworks.map((artwork) => (
          <Link
            key={artwork.id}
            href={`/artwork/${artwork.id}`}
            className="block break-inside-avoid mb-px"
          >
            {/* Plain <img> so the browser can size the tile to the
                artwork's native aspect ratio. Next/Image needs a known
                width/height up-front, which we don't have until the
                Artlogic feed wires us real metadata. */}
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              loading="lazy"
              decoding="async"
              className="w-full h-auto block"
            />
            {showInfo && (
              <div className="p-3">
                <p className="text-sm font-medium truncate lowercase">{artwork.title}</p>
                <p className="text-xs text-muted-foreground truncate">{artwork.artistName}</p>
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Menu Overlay */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 z-50 animate-in fade-in duration-200" 
            onClick={() => setIsMenuOpen(false)} 
          />
          <div className="fixed inset-x-4 top-12 bg-card rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            {/* Menu header - tap to go to profile */}
            <div className="p-4 flex items-center justify-between border-b border-border">
              <Link 
                href="/profile/me"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 flex-1"
              >
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-accent-foreground">{user.initials}</span>
                </div>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">View profile</p>
                </div>
              </Link>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Menu items */}
            <div className="p-2">
              <Link 
                href="/add" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                <Plus size={20} className="text-muted-foreground" />
                <span>Add Artwork</span>
              </Link>
              <Link 
                href="/patterns" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                <BarChart3 size={20} className="text-muted-foreground" />
                <span>Insights</span>
              </Link>
              <Link 
                href="/documents" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                <FileText size={20} className="text-muted-foreground" />
                <span>Documents</span>
              </Link>
              <Link 
                href="/export" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                <Download size={20} className="text-muted-foreground" />
                <span>Export</span>
              </Link>
              <Link 
                href="/settings" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors"
              >
                <Settings size={20} className="text-muted-foreground" />
                <span>Settings</span>
              </Link>
            </div>

            {/* Logout */}
            <div className="p-2 border-t border-border">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-colors text-destructive"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} artworks={artworks} artists={artists} />

      {/* Filter Bottom Sheet */}
      {isFilterOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsFilterOpen(false)}
        >
          <div 
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-12 h-1 bg-muted rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <h2 className="text-lg font-semibold">Filter Collection</h2>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="p-1 rounded-full hover:bg-muted"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>

            {/* Filter options */}
            <div className="p-4 space-y-4">
              {(Object.keys(filterLabels) as FilterOption[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => { 
                    setActiveFilter(filter); 
                    setIsFilterOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors border",
                    activeFilter === filter
                      ? "bg-accent text-accent-foreground border-accent font-medium"
                      : "bg-muted/30 text-foreground border-border hover:bg-muted/50"
                  )}
                >
                  <span>{filterLabels[filter]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm opacity-70">{filterCounts[filter]}</span>
                    {activeFilter === filter && <Check size={18} />}
                  </div>
                </button>
              ))}
            </div>

            {/* Safe area bottom */}
            <div className="safe-area-inset-bottom" />
          </div>
        </div>
      )}
    </main>
  );
}
