"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Curated accent colors harmonizing with near-white gallery background
const ACCENT_COLORS = [
  // Neutral (Default)
  { id: 'charcoal', name: 'Charcoal', value: 'oklch(0.30 0.03 260)', foreground: 'oklch(1 0 0)' },
  
  // Earthy - Rich and warm against cream
  { id: 'terracotta', name: 'Terracotta', value: 'oklch(0.52 0.18 42)', foreground: 'oklch(1 0 0)' },
  { id: 'olive', name: 'Olive', value: 'oklch(0.48 0.12 140)', foreground: 'oklch(1 0 0)' },
  { id: 'sand', name: 'Sand', value: 'oklch(0.58 0.12 70)', foreground: 'oklch(0.20 0 0)' },
  
  // Classic - Deep and sophisticated
  { id: 'navy', name: 'Navy', value: 'oklch(0.32 0.14 265)', foreground: 'oklch(1 0 0)' },
  { id: 'burgundy', name: 'Burgundy', value: 'oklch(0.42 0.20 20)', foreground: 'oklch(1 0 0)' },
  { id: 'forest', name: 'Forest', value: 'oklch(0.38 0.14 160)', foreground: 'oklch(1 0 0)' },
  
  // Neon - Vibrant but balanced
  { id: 'electric-pink', name: 'Electric Pink', value: 'oklch(0.65 0.28 345)', foreground: 'oklch(0.18 0 0)' },
  { id: 'acid-lime', name: 'Acid Lime', value: 'oklch(0.78 0.32 128)', foreground: 'oklch(0.18 0 0)' },
  
  // Tech - Modern and clean
  { id: 'electric-blue', name: 'Electric Blue', value: 'oklch(0.55 0.24 255)', foreground: 'oklch(1 0 0)' },
  { id: 'chrome', name: 'Chrome', value: 'oklch(0.70 0.04 265)', foreground: 'oklch(0.18 0 0)' },
  
  // Original
  { id: 'lavender', name: 'Lavender', value: 'oklch(0.68 0.18 310)', foreground: 'oklch(0.18 0 0)' },
];

const DEFAULT_ACCENT = 'charcoal';

export default function AppearancePage() {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = useState(DEFAULT_ACCENT);
  const [mounted, setMounted] = useState(false);

  // Load saved preference
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('pang-accent-color');
    if (saved) {
      setSelectedColor(saved);
    }
  }, []);

  // Apply color to document
  useEffect(() => {
    if (!mounted) return;
    
    const color = ACCENT_COLORS.find(c => c.id === selectedColor);
    if (color) {
      document.documentElement.style.setProperty('--accent', color.value);
      document.documentElement.style.setProperty('--accent-foreground', color.foreground);
      localStorage.setItem('pang-accent-color', selectedColor);
    }
  }, [selectedColor, mounted]);

  const handleSelectColor = (colorId: string) => {
    setSelectedColor(colorId);
  };

  return (
    <main className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="safe-area-inset-top" />
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold lowercase">appearance</h1>
            <p className="text-xs text-muted-foreground">customize your experience</p>
          </div>
        </div>
      </header>

      <div className="p-4 animate-page-enter">
        {/* Accent Color Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Accent Color
          </h2>
          
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="grid grid-cols-6 gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => handleSelectColor(color.id)}
                  className="relative aspect-square rounded-full transition-transform hover:scale-110 active:scale-95"
                  style={{ backgroundColor: color.value }}
                  aria-label={color.name}
                >
                  {selectedColor === color.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check 
                        size={16} 
                        className="drop-shadow-sm"
                        style={{ color: color.foreground }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            {/* Selected color name */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              {ACCENT_COLORS.find(c => c.id === selectedColor)?.name}
            </p>
          </div>
        </section>

        {/* Preview Section */}
        <section className="mt-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Preview
          </h2>
          
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            {/* Sample button */}
            <button className="w-full py-3 px-4 bg-accent text-accent-foreground rounded-xl font-medium text-sm transition-colors">
              Sample Button
            </button>
            
            {/* Sample pills */}
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-full">
                Willehad Eilers
              </span>
              <span className="px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-full">
                Tatjana Doll
              </span>
              <span className="px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-full">
                Heiko Zahlmann
              </span>
            </div>
            
            {/* Sample toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Sample Toggle</span>
              <div className="w-12 h-7 bg-accent rounded-full flex items-center justify-end px-1">
                <div className="w-5 h-5 bg-accent-foreground rounded-full" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
