/**
 * PANG — font loader.
 *
 * Three-register stack per DS Chapter 03:
 *
 *   • Instrument Serif — display + editorial (Laura's first breath,
 *     artwork titles, chapter headers).
 *   • Geist            — UI register (buttons, labels, body).
 *   • Geist Mono       — data + gate IDs (provenance hashes,
 *     confidence bars, file names, CI output).
 *
 * All three are open-source; no commercial licence, no woff2 files
 * to copy on fresh clone.
 *
 * Loading strategy
 * ----------------
 * The DS token file (`src/styles/tokens.css`, read-only) declares
 * the font stacks by their *literal* family names:
 *
 *   --serif: "Instrument Serif", ui-serif, Georgia, serif;
 *   --sans:  "Geist",            ui-sans-serif, system-ui, sans-serif;
 *   --mono:  "Geist Mono",       ui-monospace, "SF Mono", monospace;
 *
 * `next/font/google` generates hashed family names that do not
 * match those literals. To keep tokens.css canonical we register
 * the literal names via a Google Fonts `<link>` in `<head>`
 * (rendered by `app/layout.tsx`). `preconnect` keeps the first
 * paint fast; `display=swap` prevents FOIT.
 *
 * `FONT_FAMILIES` in `locked.ts` is the single SSOT for family
 * names; this module is the runtime binding.
 */

import { FONT_FAMILIES } from "./locked";

/** Google Fonts preconnect origin. */
export const FONT_PRECONNECT_ORIGIN = "https://fonts.gstatic.com";

/**
 * Google Fonts stylesheet URL, subset to the weights/styles
 * declared in `locked.ts`. `display=swap` matches the DS motion
 * contract (a paused first frame is preferable to a blank one).
 */
export const FONT_STYLESHEET_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Instrument+Serif:ital@0;1",
    "family=Geist:wght@400;500;700",
    "family=Geist+Mono:wght@400;500",
  ].join("&") +
  "&display=swap";

// Re-export the family-name registry for consumers that need the
// literal strings (e.g. canvas-rendered text, where CSS variables
// aren't available).
export { FONT_FAMILIES };
