"use client";

import { useEffect } from "react";

const ACCENT_COLORS: Record<string, { value: string; foreground: string }> = {
  'charcoal': { value: 'oklch(0.35 0.02 260)', foreground: 'oklch(1 0 0)' },
  'terracotta': { value: 'oklch(0.55 0.15 35)', foreground: 'oklch(1 0 0)' },
  'olive': { value: 'oklch(0.50 0.10 140)', foreground: 'oklch(1 0 0)' },
  'sand': { value: 'oklch(0.70 0.08 80)', foreground: 'oklch(0.15 0 0)' },
  'navy': { value: 'oklch(0.35 0.12 260)', foreground: 'oklch(1 0 0)' },
  'burgundy': { value: 'oklch(0.40 0.18 15)', foreground: 'oklch(1 0 0)' },
  'forest': { value: 'oklch(0.40 0.12 155)', foreground: 'oklch(1 0 0)' },
  'electric-pink': { value: 'oklch(0.70 0.25 350)', foreground: 'oklch(0.15 0 0)' },
  'acid-lime': { value: 'oklch(0.85 0.30 125)', foreground: 'oklch(0.15 0 0)' },
  'electric-blue': { value: 'oklch(0.60 0.20 250)', foreground: 'oklch(1 0 0)' },
  'chrome': { value: 'oklch(0.75 0.02 260)', foreground: 'oklch(0.15 0 0)' },
  'lavender': { value: 'oklch(0.73 0.16 310)', foreground: 'oklch(1 0 0)' },
};

export function AccentProvider() {
  useEffect(() => {
    const saved = localStorage.getItem('pang-accent-color');
    if (saved && ACCENT_COLORS[saved]) {
      const color = ACCENT_COLORS[saved];
      document.documentElement.style.setProperty('--accent', color.value);
      document.documentElement.style.setProperty('--accent-foreground', color.foreground);
    }
  }, []);

  return null;
}
