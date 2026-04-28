"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/use-haptic";

interface ArrivalMomentProps {
  artwork: {
    title: string;
    artistName: string;
    imageUrl: string;
  };
  type: "added" | "verified";
  isOpen: boolean;
  onClose: () => void;
}

export function ArrivalMoment({ artwork, type, isOpen, onClose }: ArrivalMomentProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");
  const { triggerSuccess } = useHaptic();

  useEffect(() => {
    if (!isOpen) {
      setPhase("enter");
      return;
    }

    // Haptic on open
    triggerSuccess();

    // Phase timeline: enter (0.5s) -> hold (2s) -> exit (0.5s) -> close
    const holdTimer = setTimeout(() => setPhase("hold"), 100);
    const exitTimer = setTimeout(() => setPhase("exit"), 2500);
    const closeTimer = setTimeout(() => onClose(), 3000);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [isOpen, onClose, triggerSuccess]);

  if (!isOpen) return null;

  const messages = {
    added: "Welcome to your collection",
    verified: "Gallery verified",
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500",
        phase === "enter" && "opacity-0",
        phase === "hold" && "opacity-100",
        phase === "exit" && "opacity-0"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex flex-col items-center text-center px-8 transition-all duration-700",
          phase === "enter" && "scale-95 opacity-0",
          phase === "hold" && "scale-100 opacity-100",
          phase === "exit" && "scale-105 opacity-0"
        )}
      >
        {/* Artwork image */}
        <div className="relative w-64 h-64 mb-8 shadow-2xl">
          <Image
            src={artwork.imageUrl}
            alt={artwork.title}
            fill
            className="object-cover"
          />
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground mb-2">{messages[type]}</p>

        {/* Artwork info */}
        <h2 className="text-xl font-medium lowercase">{artwork.title}</h2>
        <p className="text-muted-foreground mt-1">{artwork.artistName}</p>
      </div>
    </div>
  );
}
