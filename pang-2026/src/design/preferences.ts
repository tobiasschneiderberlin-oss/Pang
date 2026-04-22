/**
 * PANG — preferences store.
 *
 * The nine DS knobs (seven numeric, two categorical) plus two
 * non-knob user preferences (`appearance`, `displayName`), as a
 * Zustand slice. Persisted to OPFS (not localStorage — P24).
 * Mutations write through to `:root` as `--knob-*` custom
 * properties and `data-*` attributes consumed by `knobs.css`.
 *
 * Authority: `src/styles/tokens.css` (DS Appendix A — 400 perms).
 *   See also `PANG_Architecture_2026.md` § 1.5 for the ranges +
 *   defaults table, and `docs/PANG_DS.html` Chapter 11 for the
 *   shipping UI contract.
 *
 * Consumers never read from localStorage; they read from this
 * store or from CSS via `var(--knob-*)`.
 */

import { z } from "zod";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { KNOB_DEFAULTS, KNOB_RANGES } from "./locked";

// --- Schema -------------------------------------------------------
// The nine DS knobs map to concrete primitive types. Ranges are
// enforced here (schema) and re-asserted at the CSS layer through
// @property syntax + tokens.css defaults.
export const PreferencesSchema = z.object({
  // Numeric knobs (animatable; @property-registered in globals.css).
  timeWarmth: z.number().min(KNOB_RANGES.timeWarmth[0]).max(KNOB_RANGES.timeWarmth[1]),
  warmthMultiplier: z
    .number()
    .min(KNOB_RANGES.warmthMultiplier[0])
    .max(KNOB_RANGES.warmthMultiplier[1]),
  wallGap: z
    .number()
    .int()
    .min(KNOB_RANGES.wallGap[0])
    .max(KNOB_RANGES.wallGap[1]),
  density: z.number().min(KNOB_RANGES.density[0]).max(KNOB_RANGES.density[1]),
  motion: z.number().min(KNOB_RANGES.motion[0]).max(KNOB_RANGES.motion[1]),
  confidenceVisibility: z
    .number()
    .min(KNOB_RANGES.confidenceVisibility[0])
    .max(KNOB_RANGES.confidenceVisibility[1]),
  serifWeight: z
    .number()
    .int()
    .min(KNOB_RANGES.serifWeight[0])
    .max(KNOB_RANGES.serifWeight[1]),

  // Categorical knobs (not animatable; consumed via string compare
  // or attribute selector).
  labelCase: z.enum(["upper", "sentence"]),
  radii: z.enum(["on", "off"]),

  // Non-knob preferences.
  appearance: z.enum(["auto", "light", "dark"]),
  displayName: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[\p{L}][\p{L}'\- ]{0,39}$/u, {
      message: "letters, apostrophe, hyphen, space only",
    })
    .or(z.literal("")),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  timeWarmth: KNOB_DEFAULTS.timeWarmth,
  warmthMultiplier: KNOB_DEFAULTS.warmthMultiplier,
  wallGap: KNOB_DEFAULTS.wallGap,
  density: KNOB_DEFAULTS.density,
  motion: KNOB_DEFAULTS.motion,
  confidenceVisibility: KNOB_DEFAULTS.confidenceVisibility,
  serifWeight: KNOB_DEFAULTS.serifWeight,
  labelCase: KNOB_DEFAULTS.labelCase,
  radii: KNOB_DEFAULTS.radii,
  appearance: "auto",
  displayName: "",
};

// --- Named-preset → numeric mapper -------------------------------
// The DS stores numerics; the UI presents named presets. These maps
// are the canonical bridge for preset pickers in the Tweaks sheet.
// A preset picker writes the numeric into the store; a numeric
// that does not match any preset renders as "custom" in the UI.
export const WARMTH_PRESETS = {
  subtle: 0.4,
  balanced: 0.7,
  pronounced: 1.0,
} as const;

export const WALL_GAP_PRESETS = {
  spacious: 32,
  balanced: 24,
  dense: 16,
} as const;

export const DENSITY_PRESETS = {
  intimate: 0.8,
  standard: 1.0,
  grand: 1.2,
} as const;

export const MOTION_PRESETS = {
  full: 1.0,
  reduced: 0.4,
  off: 0,
} as const;

export type WarmthPreset = keyof typeof WARMTH_PRESETS;
export type WallGapPreset = keyof typeof WALL_GAP_PRESETS;
export type DensityPreset = keyof typeof DENSITY_PRESETS;
export type MotionPreset = keyof typeof MOTION_PRESETS;

/** Resolve a numeric to a preset name, or `"custom"` if off-preset. */
export function resolvePreset<M extends Record<string, number>>(
  map: M,
  value: number,
): keyof M | "custom" {
  for (const [k, v] of Object.entries(map)) {
    if (Math.abs(v - value) < 1e-6) return k as keyof M;
  }
  return "custom";
}

// --- Store --------------------------------------------------------
interface PreferencesStore extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
  hydrate: (incoming: Preferences) => void;
}

export const usePreferences = create<PreferencesStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_PREFERENCES,
    set: (key, value) => set({ [key]: value } as Partial<PreferencesStore>),
    reset: () => set({ ...DEFAULT_PREFERENCES }),
    hydrate: (incoming) => set({ ...incoming }),
  })),
);

// --- :root projection --------------------------------------------
// Called once at app mount. Subscribes to store changes and writes
// through to CSS custom properties + data-* attributes. Writes are
// direct numerics / strings — no string interpolation of user input.
export function bindPreferencesToRoot(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;

  const apply = (p: Preferences): void => {
    // Numeric knobs (animatable; @property-registered so View
    // Transitions can interpolate).
    root.style.setProperty("--knob-time-warmth", String(p.timeWarmth));
    root.style.setProperty("--knob-warmth-multiplier", String(p.warmthMultiplier));
    root.style.setProperty("--knob-wall-gap", `${p.wallGap}px`);
    root.style.setProperty("--knob-density", String(p.density));
    root.style.setProperty("--knob-motion", String(p.motion));
    root.style.setProperty(
      "--knob-confidence-visibility",
      String(p.confidenceVisibility),
    );
    root.style.setProperty("--knob-serif-weight", String(p.serifWeight));

    // Categorical knobs (string values; consumed via string compare
    // or attribute selector).
    root.style.setProperty("--knob-label-case", p.labelCase);
    root.style.setProperty("--knob-radii", p.radii);

    // Non-knob preferences via data-* attributes.
    root.dataset["appearance"] = p.appearance;
    // `data-motion-explicit` signals to the OS reduced-motion media
    // query that the collector has made a deliberate choice and the
    // OS override should stand down. Presence, not value, matters.
    if (p.motion === MOTION_PRESETS.full) {
      root.dataset["motionExplicit"] = "full";
    } else {
      delete root.dataset["motionExplicit"];
    }
  };

  // Initial projection
  apply(usePreferences.getState());

  // Subscribe to changes
  const unsub = usePreferences.subscribe(
    (s) => s,
    (p) => apply(p),
  );

  return unsub;
}
