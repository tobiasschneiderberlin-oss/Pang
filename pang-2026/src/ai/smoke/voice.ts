/**
 * PANG — smoke-route voice corpus.
 *
 * Strings that appear only on dev / Playwright smoke routes
 * (`/deep-zoom-smoke`, `/room-smoke`). Ship outside the PWA in
 * production builds — the routes are gated behind
 * `PANG_ENABLE_SMOKE_ROUTES`. Still routed through corpus so A25's
 * AST sweep has one place to point at, and so that renames on the
 * seams (`cycles:`, `tier:`, `ready:`, `works:`, `focus:`) fail
 * compilation rather than silently drift in a Playwright spec.
 *
 * Register caveat: these are intentionally developer-terse
 * (`open`, `close`, `cycles:`, `tier:`) — *not* museumsschild, not
 * collector-facing. PANG_Voice.md's sentence-case rule does not
 * bind here; the surface is infrastructure chrome. Kept in the
 * bundle because A25 rightly flags every JsxText identically —
 * the surface, not the copy, is what exempts a string from the
 * doctrine.
 */

// ---------- /deep-zoom-smoke --------------------------------------

export const DEEP_ZOOM_SMOKE = Object.freeze({
  /** Surface caption above the open/close buttons. */
  header: "deep-zoom smoke",
  /** Open button. */
  open: "open",
  /** Close button — distinct from `DEEP_ZOOM_CLOSE.action`
   *  because the smoke surface fires its own `setActiveDeepZoom`
   *  path, not the connector's close binding. */
  close: "close",
  /** Cycle counter label — literal includes the colon so a11y
   *  readers announce the pair as one token. */
  cycles_label: "cycles:",
}) satisfies Readonly<Record<string, string>>;

// ---------- /room-smoke --------------------------------------------

export const ROOM_SMOKE = Object.freeze({
  /** HUD line labels. Each literal carries its trailing colon so
   *  renames stay atomic. */
  tier_label: "tier:",
  ready_label: "ready:",
  works_label: "works:",
  focus_label: "focus:",
}) satisfies Readonly<Record<string, string>>;
