"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FullscreenViewerProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenViewer({ src, alt, isOpen, onClose }: FullscreenViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Handle pinch zoom
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    let initialDistance = 0;
    let initialScale = 1;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = scale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        // Guard against `initialDistance === 0`, which would produce NaN
        // and lock the image at scale 1 until the gesture restarts. This
        // happens when `touchmove` fires before `touchstart` could record
        // the starting distance (rare but observable on Android Chrome).
        if (initialDistance === 0) return;
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const newScale = Math.min(Math.max(initialScale * (distance / initialDistance), 1), 5);
        setScale(newScale);
      }
    };

    const container = containerRef.current;
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isOpen, scale]);

  // Handle drag/pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchDrag = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchDragStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const zoomIn = () => setScale(Math.min(scale + 0.5, 5));
  const zoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 safe-area-inset-top">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={zoomOut}
            disabled={scale === 1}
            className={cn(
              "w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center transition-opacity",
              scale === 1 && "opacity-40"
            )}
          >
            <ZoomOut size={18} className="text-white" />
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 5}
            className={cn(
              "w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center transition-opacity",
              scale >= 5 && "opacity-40"
            )}
          >
            <ZoomIn size={18} className="text-white" />
          </button>
          {scale > 1 && (
            <button
              onClick={resetZoom}
              className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center"
            >
              <RotateCw size={18} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Zoom level indicator */}
      {scale > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-white text-xs font-medium">{Math.round(scale * 100)}%</span>
        </div>
      )}

      {/* Image container */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchDragStart}
        onTouchMove={handleTouchDrag}
        onDoubleClick={() => (scale === 1 ? zoomIn() : resetZoom())}
      >
        <div
          className="relative transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={1200}
            className="max-h-[90vh] w-auto h-auto object-contain select-none"
            draggable={false}
            priority
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-white/50 text-xs">
          {scale === 1 ? "Double-tap or pinch to zoom" : "Drag to pan • Double-tap to reset"}
        </p>
      </div>
    </div>
  );
}
