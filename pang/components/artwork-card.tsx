"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Artwork } from "@/lib/api";

interface ArtworkCardProps {
  artwork: Artwork;
  size?: "sm" | "md" | "lg";
  showDate?: boolean;
  className?: string;
}



const sizeClasses = {
  sm: "h-48",
  md: "h-72",
  lg: "h-96",
};

export function ArtworkCard({ 
  artwork, 
  size = "md", 
  showDate = true,
  className 
}: ArtworkCardProps) {
  const date = new Date(artwork.year, 0, 1);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Title and date header */}
      <div className="flex items-start justify-between px-1">
        <p className="text-sm text-foreground/80 lowercase">{artwork.title}</p>
        {showDate && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase">{month}</p>
            <p className="text-3xl font-light text-foreground/60">{artwork.year % 100}</p>
          </div>
        )}
      </div>
      
      {/* Card with image */}
      <Link href={`/artwork/${artwork.id}`}>
        <div className={cn(
          "relative overflow-hidden transition-transform duration-300",
          "hover:scale-[1.02] active:scale-[0.98]",
          sizeClasses[size]
        )}>
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </Link>
    </div>
  );
}

// Simplified card for grid views
export function ArtworkGridCard({ artwork }: { artwork: Artwork }) {
  return (
    <Link href={`/artwork/${artwork.id}`} className="block">
      <div className={cn(
        "relative aspect-square overflow-hidden",
        "transition-transform duration-300",
        "hover:scale-[1.02] active:scale-[0.98]"
      )}>
        <Image
          src={artwork.imageUrl}
          alt={artwork.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
      </div>
      <div className="mt-2 px-1">
        <p className="text-sm text-foreground truncate lowercase">{artwork.title}</p>
        <p className="text-xs text-muted-foreground truncate">{artwork.artistName}</p>
      </div>
    </Link>
  );
}
