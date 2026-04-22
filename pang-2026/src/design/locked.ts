/**
 * PANG — locked design tokens.
 *
 * Compile-time constants. Tree-shaken. The source of truth for every
 * non-tunable design value. Do not add a tunable value here — if a
 * value can vary by collector, it belongs in `knobs.css` + the
 * `preferencesStore`.
 *
 * See `PANG_Architecture_2026.md` § 1.5 and `PANG_Gates.md` § P24.
 */

// --- Geometry ------------------------------------------------------
export const RADIUS = 0; // sharp corners, always (Primitive §22)
export const HAIRLINE = "1px";

// --- Typography ----------------------------------------------------
// Three-register stack (DS Chapter 03). Instrument Serif carries
// display + editorial register; Geist carries the UI register;
// Geist Mono carries data + gate IDs. All three are open-source
// and load from Google Fonts via a preconnect + stylesheet link
// in `app/layout.tsx` (see `fonts.ts` for the origin + href — the
// literal family names are incompatible with `next/font/google`
// hashing).
export const FONT_FAMILIES = {
  serif: "Instrument Serif",
  sans: "Geist",
  mono: "Geist Mono",
} as const;

// Weights we actually use. Do not expose a weight ramp — the
// register doesn't need it.
export const FONT_WEIGHTS = {
  serif: [400] as const, // Instrument Serif ships one optical weight
  sans: [400, 500, 700] as const,
  mono: [400, 500] as const,
} as const;
export const FONT_OPTICAL_SIZE = 14;

// --- OKLCH palette -------------------------------------------------
// Layered: primitives (raw) → semantics (what they mean) → `knobs.css`
// only mutates the knob layer, never these.
//
// The OKLCH values below are *endpoints* for `light-dark()`.
// Hand-tuned; changing any value is a taste decision (a PR, not a knob).
export const OKLCH = {
  // Primitive layer — raw colors
  ink: { light: "oklch(20% 0.01 250)", dark: "oklch(96% 0.005 250)" },
  inkSoft: { light: "oklch(40% 0.01 250)", dark: "oklch(75% 0.005 250)" },
  // AI-ink — the published "PANG-Ambient" gray (warm, hue 250 cool-gray,
  // 92% L in light / 70% in dark). Pair below visually checked.
  inkAi: { light: "oklch(62% 0.01 250)", dark: "oklch(70% 0.008 250)" },
  paper: { light: "oklch(98% 0.003 90)", dark: "oklch(12% 0.005 250)" },
  paperSoft: { light: "oklch(95% 0.004 90)", dark: "oklch(16% 0.005 250)" },
  warmAccent: { light: "oklch(70% 0.13 55)", dark: "oklch(72% 0.11 55)" },
} as const;

// --- Semantic tokens ----------------------------------------------
// Components read these; the Tailwind theme maps them to utilities.
export const SEMANTIC = {
  surface: "paper",
  surfaceSoft: "paperSoft",
  ink: "ink",
  inkSoft: "inkSoft",
  inkAi: "inkAi",
  accent: "warmAccent",
} as const;

// --- Motion --------------------------------------------------------
// Source of truth for spring configs. The compiled `linear()` strings
// live next to each preset (Primitive §36). Consumers import from
// here, never author a raw config.
export const SPRING = {
  snap: { stiffness: 480, damping: 38, mass: 1 },
  ease: { stiffness: 160, damping: 24, mass: 1 },
  heavy: { stiffness: 120, damping: 32, mass: 1.4 },
} as const;

// --- Spacing scale (allow-listed for P24) ------------------------
// Mirrors DS Appendix A.1: --u (8px base), --s-1..--s-32. Values
// outside this set are a gate failure. When a new value is
// genuinely needed, add it here with a named reason in the PR.
export const SPACING_PX = [
  0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128,
] as const;

// --- Icon sizes (allow-listed for P24) ---------------------------
export const ICON_PX = [16, 20, 24, 32, 48] as const;

// --- Capability tier keys ----------------------------------------
export const TIERS = ["A", "B", "C"] as const;
export type Tier = (typeof TIERS)[number];

// --- Knob registry (the declaration the gate reads) --------------
// The DS ships nine knobs — seven numeric (animatable,
// @property-registered in globals.css) and two categorical
// (consumed via string compare or attribute selector). This
// registry is the single source of truth. P24 asserts that every
// `--knob-*` custom property referenced anywhere in the codebase
// matches this set. Adding a tenth knob is a doctrine edit — see
// Appendix F + PANG_Architecture_2026.md § 1.5.
//
// Default values mirror `src/styles/tokens.css` (400 perms, DS
// authority). When the two disagree, tokens.css wins — update this
// file the same day.
export const KNOBS = [
  "time-warmth",
  "warmth-multiplier",
  "wall-gap",
  "density",
  "motion",
  "confidence-visibility",
  "serif-weight",
  "label-case",
  "radii",
] as const;
export type KnobName = (typeof KNOBS)[number];

/** CSS custom-property names — the P24 allow-list reads this set. */
export const KNOB_CSS_VARS = [
  "--knob-time-warmth",
  "--knob-warmth-multiplier",
  "--knob-wall-gap",
  "--knob-density",
  "--knob-motion",
  "--knob-confidence-visibility",
  "--knob-serif-weight",
  "--knob-label-case",
  "--knob-radii",
] as const;

/**
 * Ranges for the seven numeric knobs. The schema in
 * `preferences.ts` asserts each value falls inside its range.
 */
export const KNOB_RANGES = {
  timeWarmth: [0, 1],
  warmthMultiplier: [0, 1],
  /** CSS length in px. Mirrors the three `WALL_GAP_PRESETS`. */
  wallGap: [8, 40],
  density: [0.6, 1.4],
  motion: [0, 1],
  confidenceVisibility: [0, 1],
  serifWeight: [300, 600],
} as const;

/**
 * Defaults mirror `src/styles/tokens.css`. The two categorical
 * knobs (`labelCase`, `radii`) carry their DS initial values.
 */
export const KNOB_DEFAULTS = {
  timeWarmth: 0.5,
  warmthMultiplier: 0.7,
  wallGap: 24,
  density: 1.0,
  motion: 1.0, // OS `prefers-reduced-motion` still overrides at the CSS layer
  confidenceVisibility: 1.0,
  serifWeight: 400,
  labelCase: "upper",
  radii: "on",
} as const;
