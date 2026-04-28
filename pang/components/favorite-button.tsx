'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useHaptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  isFavorited: boolean;
  onToggle: (favorited: boolean) => void;
  className?: string;
}

export function FavoriteButton({ isFavorited, onToggle, className }: FavoriteButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { triggerSuccess, triggerLight } = useHaptic();

  const handleToggle = () => {
    setIsAnimating(true);
    if (!isFavorited) {
      triggerSuccess();
    } else {
      triggerLight();
    }
    
    // Reset animation
    setTimeout(() => setIsAnimating(false), 600);
    onToggle(!isFavorited);
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "relative w-10 h-10 flex items-center justify-center rounded-full",
        "transition-colors hover:bg-muted/50 active:scale-95",
        className
      )}
    >
      {/* Heart icon with animation */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center",
        "transition-all duration-300",
        isAnimating && isFavorited ? "scale-125 opacity-0" : "scale-100 opacity-100"
      )}>
        <Heart
          size={20}
          className={cn(
            "transition-all duration-200",
            isFavorited ? "fill-accent text-accent" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Burst animation particles when favoriting */}
      {isAnimating && isFavorited && (
        <>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-accent rounded-full"
              style={{
                animation: `burst 0.6s ease-out forwards`,
                animationDelay: `${i * 0.05}s`,
                transformOrigin: 'center',
                transform: `rotate(${(i / 8) * 360}deg) translateY(-30px)`,
              }}
            />
          ))}
          <style>{`
            @keyframes burst {
              0% {
                transform: rotate(${Math.random() * 360}deg) translateY(0px);
                opacity: 1;
              }
              100% {
                transform: rotate(${Math.random() * 360}deg) translateY(30px);
                opacity: 0;
              }
            }
          `}</style>
        </>
      )}
    </button>
  );
}
