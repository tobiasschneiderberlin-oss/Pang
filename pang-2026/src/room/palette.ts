/**
 * PANG — room palette (sRGB).
 *
 * Three.js `Color` wants sRGB input in the 0..1 range; `tokens.css`
 * authors the perceptual OKLCH source of truth. These constants are
 * the **one-way handshake**: a human read each OKLCH token, converted
 * it to sRGB, and pasted the hex here with the OKLCH origin recorded
 * in the comment. When a token in `tokens.css` changes, update this
 * file the same day (Appendix F, doctrine edit).
 *
 * P11 (OKLCH-only) scans CSS files; JS material colours are outside
 * its surface by design (Three.js materials cannot consume CSS
 * colour strings at init without a DOM, and bundling a colour parser
 * is a 2018 default). The `oklch: ...` tag in each comment lets the
 * palette diff against `tokens.css` at review time.
 */

/** Hex triplet (0xRRGGBB) ready for `new THREE.Color(hex)`. */
export const ROOM_PALETTE = {
  /** oklch(0.975 0.004 80) — paper ground. Walls, back wall, floor. */
  paper: 0xf8f6f2,
  /** oklch(0.950 0.005 80) — surface lift. Side walls, ceiling. */
  paperSoft: 0xeee9e2,
  /** oklch(0.140 0.010 80) — user ink. Frame edges on verified works. */
  ink: 0x1f1d18,
  /** oklch(0.74 0.16 38) — warm pigment. Lamp bias on verified works. */
  warm: 0xd97a52,
  /** oklch(0.11 0.008 260) — night surface. Used in dark-scheme only. */
  night: 0x17181c,
} as const;

/**
 * Time-of-day presets. Iteration #2 scaffold ships `day` only; the
 * knob-driven cycle lands with the lighting pass. Named presets here
 * so the scene factory can swap between them without recomputing.
 */
export const LIGHT_PRESETS = {
  day: {
    /** Neutral overhead. Warm tint only on alive works. */
    ambient: 0.55,
    /** Directional (sun-like) from upper front. */
    key: { intensity: 1.1, color: 0xfff6e8, from: [0.4, 2.5, 1.8] as const },
    /** Fill from the opposite side, cool. */
    fill: { intensity: 0.25, color: 0xdde4ee, from: [-1.2, 1.6, 1.0] as const },
  },
  dusk: {
    ambient: 0.35,
    key: { intensity: 0.9, color: 0xffc58a, from: [0.4, 2.0, 1.8] as const },
    fill: { intensity: 0.18, color: 0x3a3a55, from: [-1.2, 1.2, 1.0] as const },
  },
} as const;

export type LightPreset = keyof typeof LIGHT_PRESETS;
