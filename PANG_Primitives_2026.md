# PANG — Primitives (2026)

> The 2026-native primitives PANG uses. Each one forecloses a
> conventional default so the right implementation can surface.
>
> For every primitive: the forbidden default, the required primitive,
> the adapter path, and the enforcement mechanism. If a primitive is
> used outside this document, the default will win.
>
> Paired with `PANG_Architecture_2026.md` (stack-level choices) and
> `PANG_Gates.md` (mechanical enforcement). Subordinate to
> `CLAUDE.md` § *Reach forward, not back*.
>
> Last updated: 2026-04-22 (third pass) — §3 typography rewritten
> to the DS Chapter 03 three-register stack (Instrument Serif +
> Geist + Geist Mono via Google Fonts), superseding the earlier
> PP Editorial Sans lock. Earlier the same day: #38 hybrid
> rectangle + segmentation detection added (iteration #1 codify:
> the scanner accepts sculptures, textiles, stretched canvases
> off the wall, paper works with deckle edges — not only framed
> rectangles); #34 CSS Anchor Positioning, #35 OffscreenCanvas +
> Worker for the Room renderer, #36 Motion `linear()` easing
> compilation, #37 WebGPU-shader Liquid Glass (exploratory); #13
> extended with Safari `MediaStreamTrack` fallback.

---

## How to read this document

Each primitive has the same shape:

- **Forbidden default** — what a 2020-era model reaches for.
- **Required primitive** — what PANG uses.
- **Adapter path** — how it's wrapped so consumers never see the
  split.
- **Enforcement** — the lint rule, the grep, the CI gate, or the
  code-review trigger.

If you are writing code that touches a primitive and you cannot name
its enforcement, the primitive is uncovered. Open a PR that adds the
check before writing the code.

---

## Color

### 1. OKLCH color space, not hex or HSL

- **Forbidden default:** hex values (`#E8985E`) scattered across
  components; HSL tokens without perceptual uniformity.
- **Required primitive:** OKLCH in CSS custom properties. Two layers
  — primitive tokens (the raw colors) and semantic tokens (what they
  mean).
- **Adapter path:** `globals.css` defines `--color-primitive-*` and
  `--color-semantic-*`. Every Tailwind utility references the
  semantic layer (`bg-surface`, `text-ink`, never `bg-[#E8985E]`).
- **Enforcement:** ESLint rule rejecting hex literals and `hsl(`
  inside `.tsx`/`.css` outside `globals.css`. Gate **P11**.

### 2. `light-dark()` for theme, not `@media (prefers-color-scheme)`

- **Forbidden default:** `@media (prefers-color-scheme: dark)` blocks
  scattered across stylesheets.
- **Required primitive:** `color-scheme: light dark;` on `:root`,
  every color token declared as
  `--color-surface: light-dark(oklch(...), oklch(...));`.
- **Adapter path:** components never check theme. They read semantic
  tokens; the browser picks.
- **Enforcement:** ESLint rule rejecting `prefers-color-scheme` in
  stylesheets. Gate **P12**.

---

## Typography

### 3. Three-register stack: Instrument Serif + Geist + Geist Mono, loaded from Google Fonts with `size-adjust`

- **Forbidden default:** (a) a single "safe" variable sans
  carrying display, UI, and data on its back — the wrong
  register in every direction (invisible for editorial, too
  ornate for data). (b) A commercial-license display family
  (`PP Editorial Sans`, etc.) that adds a bootstrap step (woff2
  commit, license key, licence-lint rule) on every fresh clone.
  (c) Separate font files per weight + layout shift on swap.
- **Required primitive:** three open-source families, one per
  register, declared by literal family name in
  `src/styles/tokens.css` (DS Chapter 03, Appendix A):
  - **Instrument Serif** — display + editorial (titles, chapter
    headers, `<PangLine>`, `<MonthlyReading>`). `--serif` token.
  - **Geist** — UI register (buttons, labels, body). `--sans`
    token. The default for `html, body`.
  - **Geist Mono** — data + gate IDs (hashes, confidence bars,
    CI output, OTel trace IDs). `--mono` token.
  All three are loaded via a Google Fonts `<link>` preconnect +
  stylesheet pair (not `next/font/local` — the DS token stacks
  use literal family names, which `next/font/google`'s hashed
  names would break). Each stack declares `ui-serif` /
  `ui-sans-serif` / `ui-monospace` fallbacks so first paint has
  a correctly-metricked system font; the Google Fonts swap
  lands inside the `size-adjust` budget with no measurable CLS.
- **Adapter path:** `src/design/fonts.ts` exports
  `FONT_PRECONNECT_ORIGIN` (fonts.gstatic.com) and
  `FONT_STYLESHEET_HREF` (the single `css2?family=...` URL for
  all three families + weights). `app/layout.tsx` emits
  `<link rel="preconnect">` + `<link rel="stylesheet">` in
  `<head>`. Tokens resolve via `var(--serif|--sans|--mono)` in
  `globals.css`'s `@theme` bridge; components never name a
  family directly. `FONT_FAMILIES` + `FONT_WEIGHTS` constants
  in `src/design/locked.ts` pin the register mapping (P24).
- **CSP:** `font-src 'self' https://fonts.gstatic.com` and
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  in `next.config.ts`. Both origins are the minimal scope;
  revisit if PANG ever ships its own font-serving route.
- **Enforcement:** Lighthouse CLS budget ≤ 0.02 in CI. Gate
  **P13**. No other font family imported anywhere in `src/`
  (ESLint: `@next/font` / `next/font/google` / `next/font/local`
  imports outside `src/design/fonts.ts` fail). No literal
  family name in component-level CSS — must resolve through
  `--serif` / `--sans` / `--mono` (P24).

### 4. Sentence case or ALL CAPS — never title case

- **Forbidden default:** "Add To Wall", "Your Collection".
- **Required primitive:** sentence case for body/CTA; `text-transform:
  uppercase` with letter-spacing for labels. See `PANG_Voice.md` §
  *Capitalization as register*.
- **Adapter path:** `<Label>` component applies the uppercase
  transform. Consumers write lowercase strings.
- **Enforcement:** string lint scans `copy.ts` for title-cased
  strings. Gate **P14**.

---

## Motion

### 5. Motion (ex-Framer Motion) + Motion One springs, not tweens

- **Forbidden default:** `transition={{ duration: 0.3 }}` everywhere.
- **Required primitive:** `transition: { type: 'spring', ... }` as
  the default. Tweens only when a spec requires exact timing (scan
  sweep, View Transitions pseudo-elements).
- **Adapter path:** shared motion tokens in
  `src/lib/motion/presets.ts` — `pang.spring.snap`, `pang.spring.ease`,
  `pang.spring.heavy`. Components import presets, never raw configs.
- **Enforcement:** ESLint rule rejecting `duration:` inside motion
  configs outside `presets.ts`. Gate **P15**.

### 6. View Transitions API (cross-document), not React-driven page
transitions

- **Forbidden default:** Framer Motion `AnimatePresence` at every
  route boundary.
- **Required primitive:** `document.startViewTransition()` for
  same-document transitions; `view-transition-name` on persistent
  elements; Next.js 16 cross-document View Transitions for
  Room ↔ Detail and Viewfinder ↔ Arrival.
- **Adapter path:** `useViewTransition(name)` hook wraps the API
  with SSR-safety and fallback.
- **Enforcement:** the arrival chapter's entry/exit runs through
  `useViewTransition`; a test asserts the pseudo-element is present
  on navigation. Gate **P16**.

### 7. `@starting-style` for open-state transitions, not JS mount
hacks

- **Forbidden default:** conditionally render + `useEffect` delay to
  trigger CSS transition.
- **Required primitive:** `@starting-style { opacity: 0 }` +
  `transition-behavior: allow-discrete`.
- **Adapter path:** `<Reveal>` component applies the class; ≤10 lines.
- **Enforcement:** grep for `useState.*visible.*useEffect.*timer`
  flags. Code-review level.

---

## Layout & positioning

### 8. Anchor Positioning + Popover API, not portal-based menus

- **Forbidden default:** React Portal + positioning library
  (Floating UI / Popper) to render tooltips / popovers.
- **Required primitive:** `<div popover="auto" anchor="..." />` with
  CSS `position-anchor` / `inset-area`.
- **Adapter path:** `<Popover>` component renders the popover element
  with the correct attributes; consumers pass an anchor ref.
- **Enforcement:** no `createPortal` in `src/` outside one allow-listed
  module. Gate **P17**.

### 9. Container queries, not viewport media queries for components

- **Forbidden default:** `@media (min-width: 768px)` to restyle a
  component based on where it lives.
- **Required primitive:** `@container (min-width: ...)` with a named
  container on the layout parent.
- **Adapter path:** Tailwind v4 `@container` modifier used in
  components; `@media` reserved for page-level shell decisions.
- **Enforcement:** ESLint rule rejecting `@media` inside
  `src/components/` (allowed in `src/app/layout.tsx` and
  `globals.css`). Gate **P18**.

### 10. Subgrid, not nested grid hacks

- **Forbidden default:** manually aligning nested lists with calculated
  `grid-template-columns`.
- **Required primitive:** `grid-template-columns: subgrid` on child
  rows that need to align with the parent's columns.
- **Adapter path:** direct Tailwind utility `grid-cols-subgrid`.
- **Enforcement:** code-review level; no automated check needed.

---

## Canvas surfaces

### 11. WebGPU (with WebGL 2 fallback) for primary art surfaces

- **Forbidden default:** React + `<div style="transform: translateZ">`
  to simulate depth.
- **Required primitive:** Three.js r170+ with a WebGPU renderer; the
  renderer auto-falls-back to WebGL 2 on Tier B/C devices.
- **Adapter path:** `<CanvasSurface name={...}>` mounts the renderer
  lifecycle; React never touches the scene graph.
- **Enforcement:** grep for `react-three-fiber` hooks inside `app/`
  outside `src/components/canvas/` — flagged. Gate **P19**.

### 12. OffscreenCanvas + Web Workers for CV, not main-thread
OpenCV

- **Forbidden default:** `cv.findContours` on main thread (blocks
  capture).
- **Required primitive:** `new Worker(...)` + `OffscreenCanvas`;
  OpenCV.js lives only in the worker.
- **Adapter path:** `src/workers/cv/worker-bridge.ts` exposes a
  typed `Promise<Detection>` API over `postMessage`.
- **Enforcement:** `importScripts('opencv')` only in files under
  `public/workers/`. Gate **P20**.

### 13. `ImageCapture` + torch/focus control (with Safari fallback)

- **Forbidden default:** `ref.current.srcObject = stream;` alone;
  assuming `ImageCapture` exists on every device (it does not).
- **Required primitive — Chromium (Android, desktop):**
  `ImageCapture` for `takePhoto()` +
  `getPhotoCapabilities()` for torch; MediaTrack constraints for
  focus.
- **Required primitive — Safari (iOS, macOS):** `ImageCapture` is
  **not** shipped. Fallback path:
  - Frame grab: draw the `<video>` element to an
    `OffscreenCanvas`, then `convertToBlob()`.
  - Torch: `track.applyConstraints({ advanced: [{ torch: true }] })`
    — capability-detected via
    `track.getCapabilities()?.torch`.
  - Focus: `track.applyConstraints({ advanced: [{ focusMode:
    'manual' | 'continuous' }, { focusDistance }] })`.
  - Feature parity is close enough that `useCamera()` exposes
    the same `{ video, capture, toggleTorch, focus }` surface
    with no consumer-side branching.
- **Adapter path:** `src/workers/cv/cameraControl.ts` implements
  `getCameraControl(track)` which returns the unified interface.
  `useCamera()` imports it; component code never touches
  `ImageCapture` or `applyConstraints` directly.
- **Enforcement:** `new ImageCapture(` and `applyConstraints(`
  appear only inside `src/workers/cv/cameraControl.ts`.
  Playwright smoke test runs in both a Chromium project and a
  WebKit project; both must successfully capture + toggle torch.

---

## Storage

### 14. OPFS for staged binaries, not IndexedDB blobs

- **Forbidden default:** stuff a 6MB JPEG into IDB as a Blob.
- **Required primitive:** `navigator.storage.getDirectory()` → file
  handles.
- **Adapter path:** `src/lib/storage/*.ts` offers
  `enqueueUpload(file, meta)` → queued file handle; never touched
  raw elsewhere.
- **Enforcement:** `indexedDB.open` may only be called from
  `src/lib/idb/*`. Gate **P21**.

### 15. IndexedDB (via `idb-keyval` or typed wrapper) for structured
cache

- **Forbidden default:** `localStorage` for collection manifest.
- **Required primitive:** IDB through a typed wrapper; single
  database, versioned migrations.
- **Adapter path:** `src/lib/idb/collection.ts` exports typed CRUD.
- **Enforcement:** `localStorage.` only allowed in
  `src/auth/tier.ts`. Gate **P22**.

---

## Auth & identity

### 16. WebAuthn passkeys, not passwords or social SSO

- **Forbidden default:** email + password form; *"Continue with
  Google"* button.
- **Required primitive:** `navigator.credentials.create/get` with
  `publicKey` + `userVerification: 'required'`.
- **Adapter path:** `usePasskey()` hook.
- **Enforcement:** no `<input type="password">` anywhere in the
  codebase. Gate **P10** (also in `PANG_Architecture_2026.md` §
  Auth).

### 17. Gallery-signed JWT invite tokens, not magic links as primary

- **Forbidden default:** *"Enter your email to continue"* on the
  landing page.
- **Required primitive:** the gallery's invite URL embeds a signed
  JWT (5 min TTL) identifying the collector + gallery pairing.
- **Adapter path:** `app/i/[token]/page.tsx` verifies and mints a
  session.
- **Enforcement:** code-review level (one route, one verifier).

---

## Navigation

### 18. Navigation API, not `useRouter().push` everywhere

- **Forbidden default:** React Router / Next.js router imperative
  pushes with client-side state shimmed in.
- **Required primitive:** `navigation.navigate(url, { state })`; the
  Navigation API gives View Transitions their hook.
- **Adapter path:** `useNavigate()` wraps both the Navigation API and
  the Next.js router for SSR.
- **Enforcement:** `router.push` only inside `useNavigate`. Code-review
  level.

### 19. Back button: real browser back, not a "close" button that
routes to `/`

- **Forbidden default:** Detail view shows ✕ that navigates to `/`.
- **Required primitive:** `<Back>` dispatches `history.back()` when a
  back entry exists, falls through to `/` otherwise.
- **Adapter path:** `<Back>` component is the only back primitive.
- **Enforcement:** `router.push('/')` inside detail surfaces flags.
  Code-review level.

---

## Images

### 20. AVIF primary, JPEG fallback, no PNG for photography

- **Forbidden default:** every image delivered as PNG or JPEG only.
  Hero artwork loaded with default priority, blocking LCP.
- **Required primitive:** `<picture>` with AVIF source, JPEG fallback;
  `srcset` tied to the capability tier. Hero artwork (the work the
  collector approached) declares `fetchpriority="high"`; off-screen
  works declare `fetchpriority="low"` + `loading="lazy"`.
- **Adapter path:** `<Art priority="hero|wall|background">` wraps
  `<picture>` with the right source set from Supabase Storage and
  the right `fetchpriority` per role.
- **Enforcement:** no bare `<img>` inside `src/components/canvas`,
  `src/components/detail`. Detail surface asserts the hero `<picture>`
  carries `fetchpriority="high"` (Playwright). Gate **P8**.

### 21. Deep Zoom via OpenSeadragon, not CSS scale transforms

- **Forbidden default:** `transform: scale(3)` on a 1200px image.
- **Required primitive:** OpenSeadragon with simple-image tile source;
  source ≥ 4000px long edge.
- **Adapter path:** `<DeepZoom>` component wraps the viewer; it is the
  only call site.
- **Enforcement:** code-review level.

---

## Chrome

### 22. Sharp corners, always (brand carve-out)

- **Forbidden default:** `rounded-2xl` from the Tailwind default set.
- **Required primitive:** zero border-radius on architectural
  elements. Floating chrome may use a 2–4px radius only if required
  by the platform's material (e.g. real Liquid Glass refraction
  artifacts). Default is zero.
- **Adapter path:** Tailwind v4 config sets `--radius: 0` globally;
  consumers override only inside `src/components/chrome/*`.
- **Enforcement:** ESLint rule rejecting `rounded-` utilities outside
  `src/components/chrome/`. Gate **P9**.

### 23. Liquid Glass on WebGPU/WebGL; CSS `backdrop-filter` fallback
only on Tier B/C

- **Forbidden default:** `backdrop-filter: blur(40px) saturate(1.8);`
  as the "glass" effect everywhere.
- **Required primitive:** Tier A — WebGPU shader pass sampling the
  scene texture, applying refraction offsets + a specular term.
  Tier B/C — CSS `backdrop-filter` with conservative blur + saturation.
- **Adapter path:** `<GlassSurface tone="light|dark|accent"
  variant="touch|pill|status">` routes per tier. Consumers never
  write `backdrop-filter`.
- **Enforcement:** `backdrop-filter` allowed only in
  `src/components/chrome/cssGlass.ts`. Gate **P9** shares this check
  with corners.

---

## Accessibility

### 24. Landmarks + `aria-live` for state changes, not toasts as
chrome

- **Forbidden default:** `react-hot-toast` floating chrome for every
  state.
- **Required primitive:** named landmarks (`main`, `nav`,
  `complementary`); `aria-live="polite"` regions for non-interrupting
  updates (*Offline*, *Saved*, *Recognized*).
- **Adapter path:** `<Banner role="status" aria-live="polite">` is
  the only announcement primitive.
- **Enforcement:** `toast(` banned at import level. Code-review level.

### 25. Reduced motion respected everywhere

- **Forbidden default:** animations that ignore
  `prefers-reduced-motion`.
- **Required primitive:** every motion preset in `presets.ts`
  declares a `reducedMotion` variant (usually `{ type: 'tween',
  duration: 0 }`).
- **Adapter path:** `useMotion()` hook reads the media query and
  swaps presets.
- **Enforcement:** `motion.*` imports outside presets flagged.
  Gate **P7** (also Lighthouse accessibility score ≥ 95).

---

## AI-era UI (sketched; detail in `PANG_AI_Era_2026.md`)

### 26. `<Confidence>` primitive — gray for AI, black for user

- **Forbidden default:** black text everywhere, indistinguishable
  from user-authored.
- **Required primitive:** `<Confidence source="ai" confidence={0.87}>`
  renders `--color-ink-ai` (warm gray). User-authored renders
  `--color-ink-primary` (near-black).
- **Adapter path:** fields in the scanner review screen wrap text
  nodes in `<Confidence>`.
- **Enforcement:** Gate **A14**.

### 27. `<Diff>` primitive — accept/amend for AI output

- **Forbidden default:** an "Edit" modal that replaces AI output
  outright.
- **Required primitive:** inline diff surface; tap a field to amend;
  one-tap accept-all.
- **Adapter path:** `<Diff original={...} proposed={...}
  onAccept={...} onAmend={...} />`.
- **Enforcement:** Gate **A15**.

### 28. `<StreamingText>` — 10+ tokens/sec minimum, word-boundary
chunks

- **Forbidden default:** block the UI until the full AI response
  returns.
- **Required primitive:** Anthropic SDK streaming → `<StreamingText>`
  renders word-boundary chunks at ≥ 10 t/s.
- **Adapter path:** `<StreamingText source={asyncIterator} />`.
- **Enforcement:** Gate **A13**.

### 29. `<Queue>` — TUS-style resumable upload/enrich queue

- **Forbidden default:** uploads fail and disappear when offline.
- **Required primitive:** OPFS-backed queue with TUS semantics;
  visible to Laura only when there's something in flight (*Saved
  locally. Will upload when online.*).
- **Adapter path:** `useOfflineQueue()` + `<QueueBanner>`.
- **Enforcement:** Gate **A16**.

---

## Navigation continued

### 30. Speculation Rules API for Room → Detail prerendering

- **Forbidden default:** detail page loads cold on tap; first paint
  on the work waits for the network round-trip and image decode.
  The spine's *"the room doesn't exit, it zooms"* leaks latency.
- **Required primitive:** `<script type="speculationrules">` declared
  on the Room route, pre-rendering the visible works' detail pages
  with `eagerness: "moderate"`. Speculation rules are
  capability-detected (Tier A only) and updated as the camera
  reframes the room.
- **Adapter path:** `useRoomSpeculation(visibleWorkIds)` updates the
  injected speculation rules block declaratively.
- **Enforcement:** Playwright assertion: tapping a visible work
  records a `prerender → activate` navigation type, not `navigate`.
  Failure surfaces in CI as a navigation-timing budget regression.

---

## Sharing

### 31. Web Share API (Level 2) for shared artifacts

- **Forbidden default:** custom share modal with email / WhatsApp /
  copy-link buttons re-implemented per surface; `mailto:` links
  scattered through components.
- **Required primitive:** `navigator.share({ title, text, url, files })`
  with capability detection; `navigator.canShare({ files })` gates
  document sharing. Fallback to a single shared menu in DOM (still
  Anchor-Positioned, never a full-screen modal) only on Tier C / no
  support.
- **Adapter path:** `useShare()` hook returns
  `{ share, canShareFiles, fallback }`. Correspondence (verification
  request), Documents (send to insurance), and the invite forwarder
  all consume it.
- **Enforcement:** ESLint rejects `mailto:` and `wa.me/` literals
  outside `src/lib/share/fallback.ts`; `useShare` is the only
  share entry point.

---

## Typography continued

### 32. `text-wrap: balance` for headings, `text-wrap: pretty` for narration

- **Forbidden default:** orphaned last words on PANG's one-line
  narrations; ragged headlines on the arrival chapter title; the
  monthly reading paragraph breaking awkwardly across container
  widths.
- **Required primitive:** `text-wrap: balance` on `<h1>`–`<h3>` and
  PANG's spoken-line component; `text-wrap: pretty` on the monthly
  reading paragraph and any agent-generated prose ≥ 2 sentences.
- **Adapter path:** Tailwind v4 utilities (`text-balance`,
  `text-pretty`) wired into the `<PangLine>` and `<MonthlyReading>`
  components by default.
- **Enforcement:** Lighthouse-level (no automated assertion); review
  trigger if a string > 8 words renders without the balance/pretty
  utility on its container.

---

## Color continued

### 33. `@property` for animatable custom properties

- **Forbidden default:** Liquid Glass refraction-offset and
  specular-tint animations interpolate at the discrete-token level
  (jumpy) because the browser doesn't know the property's type.
- **Required primitive:** `@property --glass-refraction-offset`,
  `@property --glass-specular-strength`, `@property --time-warmth`
  declared in `globals.css` with `syntax`, `inherits`, and
  `initial-value`. Variables are then animatable smoothly by CSS
  transitions and View Transitions.
- **Adapter path:** Tier A WebGPU shader passes read these custom
  properties via JS bridge; Tier B/C CSS Glass reads them directly
  in `backdrop-filter` / `linear-gradient` overlays.
- **Enforcement:** ESLint rule asserting any `--glass-*` or `--time-*`
  custom property used in a `transition:` declaration has a matching
  `@property` registration in `globals.css`.

---

---

## Layout & positioning continued

### 34. CSS Anchor Positioning for every floating surface

- **Forbidden default:** JS-calculated popover/tooltip positions
  (Floating UI / Popper / custom `getBoundingClientRect` loops on
  `scroll` / `resize`). Every calculation runs on the main thread
  and compounds into INP regressions on any surface that reveals a
  popover.
- **Required primitive:** CSS Anchor Positioning with
  `position-anchor`, `inset-area`, and `@position-try` fallbacks.
  Shipped in Chromium 125+ via Interop 2024; polyfilled by Base UI
  on Safari until parity lands. Base UI's `<Popover>`,
  `<Tooltip>`, `<Menu>`, `<Select>` use it natively.
- **Adapter path:** `<Popover anchor={ref}>` / `<Tooltip anchor>` /
  `<Menu anchor>` all flow through Base UI; the anchor name is set
  by the adapter, never by the consumer.
- **Enforcement:** any *floating* surface (a component that renders
  above its source in the stacking context) must resolve through a
  Base UI primitive (or one explicitly listed Radix fallback).
  ESLint denies `getBoundingClientRect` + `useLayoutEffect`
  combinations in `src/components/` — code-review trigger flags
  JS-position hacks. Gate **P17** already bans portal-based
  menus; P17 now shares enforcement with this primitive.

---

## Canvas surfaces continued

### 35. `OffscreenCanvas` + dedicated Worker for the Room renderer

- **Forbidden default:** Three.js scene graph on the main thread,
  React-scheduler interactions blocking the render loop, INP
  spikes during View Transitions. WebGPU alone does **not** move
  rendering off the main thread — the win is the worker.
- **Required primitive:** the Room's `<canvas>` is transferred to
  a dedicated Worker via `canvas.transferControlToOffscreen()`.
  The worker owns the Three.js renderer (WebGPU where available,
  WebGL 2 fallback) and the scene graph. Main thread sends
  intent-level messages (*camera target, warmth multiplier, works
  list diff*) at 60 Hz; worker translates to draw calls.
- **Adapter path:** `src/lib/canvas/roomWorker.ts` is the single
  bridge. The React `<Room>` component never touches Three.js
  directly — it subscribes to a `RoomIntent` store (Zustand) and
  posts deltas.
- **Enforcement:** `import 'three'` / `import '@react-three/*'`
  anywhere outside `public/workers/room.worker.ts` or
  `src/lib/canvas/` → ESLint denies. Main-thread bundle grep for
  `THREE.WebGLRenderer` / `THREE.WebGPURenderer` must be empty.
  Playwright smoke test: scripted INP on the Room stays ≤ 120ms
  at p75 during a simulated pan + zoom sequence.

---

## Motion continued

### 36. Motion `linear()` easing compiled from spring configs

- **Forbidden default:** springs animated by a JS tick
  (`requestAnimationFrame` loop updating `transform` every frame).
  This pins the spring to the main thread; with many concurrent
  springs (wall entry, warmth fade, chrome reveal), the JS tick
  becomes the dominant INP contributor.
- **Required primitive:** Motion's `spring(...)` config compiled
  to a CSS `linear(...)` easing function at build time (or once at
  mount). The browser runs the interpolation on the compositor;
  the JS tick is gone. Motion One exposes this natively in 2026.
- **Adapter path:** `src/lib/motion/presets.ts` declares each
  preset twice — once as a spring config (source of truth), once
  as a pre-compiled `linear()` string for use in CSS
  `transition:` or View Transitions
  `::view-transition-group(*)`. The `useMotion()` hook picks the
  compiled easing by default and drops to JS springs only for
  physical gestures (pinch, drag) that must react to live input.
- **Enforcement:** ESLint rule: any `transition:` or `animation:`
  declaration using a spring-named token must reference a
  compiled `linear()` from `presets.ts`; ad-hoc `cubic-bezier(...)`
  outside `presets.ts` fails.

---

## Chrome continued

### 37. WebGPU-shader Liquid Glass (exploratory, Tier A only)

- **Status: EXPLORATORY.** This primitive is **not** required
  infrastructure. It is named here so the pattern is catalogued
  when/if a dedicated proof-of-ceiling iteration lands it. The
  foundation primitive is still §23 (CSS `backdrop-filter` with
  the specular-highlight stack on Tier B/C, WebGPU shader on
  Tier A).
- **Forbidden default:** waiting for Apple to ship
  `-apple-visual-effect` to the open web (no WebKit proposal
  exists as of 2026-04-22); declaring Liquid Glass "impossible
  on the web" and shipping flat chrome.
- **Required primitive (when landed):** a WebGPU compute pass
  sampling the scene texture behind a `<GlassSurface>` and
  applying (a) a refraction offset driven by
  `--glass-refraction-offset`, (b) a specular term driven by
  `--glass-specular-strength`, (c) an accelerometer-read
  highlight offset (opt-in, permission-gated via
  `DeviceOrientationEvent.requestPermission()` on iOS —
  declined gracefully).
- **Adapter path:** extends `<GlassSurface>` with a Tier A render
  path that reads the three `@property` custom properties (§33)
  and executes the shader. Tier B/C continues with CSS.
- **Enforcement:** not a merge gate. A dedicated iteration brief
  (not in the current build order) would add a Playwright
  assertion that Tier A renders the shader pass and the CSS
  fallback never ships to a WebGPU-capable device. Until then,
  §23 holds.

---

## Capture continued

### 38. Hybrid rectangle + segmentation detection (every collectible, not only framed rectangles)

- **Forbidden default:** assume every capture target is a framed,
  right-angled rectangle. A rectangle-only detector silently rejects
  sculpture, ceramics, textile, stretched canvas photographed off
  the wall, paper works with deckle edges, vitrine objects,
  photographs of photographs, and most editioned objects — which is
  most of the collection for an emerging-artist buyer. The
  rectangle bias is a training-mean default; iteration #1 (Laura's
  hands, Pixel 10 Pro) exposed it.
- **Required primitive:** the capture worker runs two detectors
  over the same frame and picks the winner per frame:
  1. **OpenCV.js rectangle detection** (fast path, ~1 MB WASM).
     `findContours` + `approxPolyDP` → quadrilateral with stability
     score. Fires auto-capture at ≥ 0.9 stability over the brief's
     hold window.
  2. **MediaPipe Image Segmenter fallback** (~10–20 MB WASM,
     cached offline after first load, served from `public/workers/`
     with a service-worker precache entry). Returns an alpha mask;
     the bounding hull of the mask is rendered as corner brackets
     in the viewfinder (Primitive §22 — brackets only, no
     perimeter). Fires auto-capture at ≥ 0.9 mask stability over
     the same hold window.
  The arbiter prefers the rectangle result when its confidence is
  above the rectangle-floor *and* its area agrees with the
  segmenter's mask area within ±15 % (catches the rectangle
  detector locking onto a picture frame edge behind the real
  target). Otherwise it prefers the segmenter. The viewfinder
  never displays the choice — the grammar is identical from
  Laura's side: frame, hold, arrival.
- **Adapter path:** `src/workers/cv/detection.ts` exports a single
  `detect(frame): Promise<Detection>` where
  `Detection = { kind: 'rect' | 'segment', corners: [...], stability,
  sourceConfidence }`. The viewfinder consumes one interface; it
  does not branch on `kind`. Worker payloads carry both results +
  the arbiter decision so a post-capture span can be attributed.
- **Enforcement:**
  - **Fixture corpus in CI.** `src/workers/cv/__evals__/capture.fixtures/`
    contains ≥ 12 fixtures spanning: framed rectangle on wall,
    stretched canvas on wall, stretched canvas off the wall on a
    floor, small sculpture on pedestal, ceramic vessel, textile
    hung loosely (no frame), paper work with deckle edges,
    photograph of a photograph, vitrine object behind glass,
    diptych (two rectangles in one frame), a work with strong
    internal rectangular content (fake-positive bait), and a dark
    work on a dark wall (low-contrast bait). Each fixture declares
    an expected `kind` and an expected stability-time budget.
    Playwright harness replays each through the worker and asserts
    (a) auto-capture fires within the budget and (b) the arbiter
    picked the expected detector. Missing fixture = failing gate;
    regression in any fixture = failing gate.
  - **Segmenter bundle precached.** Service worker precache
    manifest includes the MediaPipe WASM + model files; a
    Playwright offline-cold-install test asserts the segmenter
    initialises with no network. Shares enforcement with P4
    (offline shell).
  - **No silent rectangle-only path.** ESLint rule: any direct
    import of the OpenCV-only worker outside
    `src/workers/cv/detection.ts` fails. Consumers reach both
    detectors through the arbiter or not at all.
  - **Arbiter decision is observable.** Every `capture`
    OTel span carries `pang.capture.detector = 'rect' | 'segment'`
    and `pang.capture.arbiter_reason` — iteration feedback is
    impossible without attribution.
- **References:** MediaPipe Image Segmenter
  (`@mediapipe/tasks-vision`), OpenCV.js 4.10, Google Drive
  document scanner's *auto detect → hold → capture* grammar (the
  interaction reference for object capture as of 2026-04).

---

## Motion continued (again)

### 39. Exponential-smoothing camera animator, not spring primitives

- **Forbidden default:** Framer-Motion or Motion-One spring
  primitives wrapping the camera target. Springs overshoot by
  nature; tuning them for "no bounce" produces a heavily damped
  spring that behaves like a first-order low-pass but runs a
  second-order integrator. The Granola-confidence glide is
  *one soft settle, no bounce* — a first-order system is the
  honest answer.
- **Required primitive:** every frame the animator advances an
  internal state vector toward the target by
  `alpha = 1 − exp(−rate · dt)`. `rate = 6.0` s⁻¹ for the Room
  camera glide (converges in ~0.5 s, no tail). `dt` is clamped
  to 0.1 s so tab-switch pauses don't snap on resume. The camera
  is written once per tick; gestures mutate the *target*, not the
  camera.
- **Adapter path:** `src/room/animator.ts` exposes
  `CameraAnimator.tick(dt)` and `.snap()` (for test seeding).
  Target is a plain `{ eye, gaze }` struct so the shape is
  serializable and the seam is testable without a renderer.
- **Enforcement:** no spring primitives imported into
  `src/room/**`. The rate constant is a module-level `const` so
  the tuning knob is visible in one place.

---

## Canvas surfaces continued (again)

### 40. `PointerEvent` + `touch-action: none` on primary art surfaces, not `touchstart`

- **Forbidden default:** `touchstart` / `mousedown` pairs with
  manual coalescing, and a canvas that lets the browser's
  horizontal-swipe back-navigation or pull-to-refresh steal
  gestures.
- **Required primitive:** `PointerEvent` (unified
  mouse/touch/pen/stylus) with `setPointerCapture` so a drag
  that leaves the canvas is still tracked until `pointerup`.
  The canvas carries `touch-action: none` so the browser does
  not interpret horizontal pans as back-navigation on Chrome
  Android or elastic scroll on iOS Safari.
- **Defensive hardening:** `setPointerCapture` can throw under
  synthetic events and a handful of real-world conditions
  (pointer withdrawn mid-event, stylus rejection). Wrap it in
  try/catch; the drag still tracks without capture, capture just
  keeps routing the pointer to the canvas if the finger slides
  off.
- **Adapter path:** `src/room/gestures.ts::attachGestureController`
  is the single pointer-handler for the Room. Tap vs. drag is
  disambiguated by an 8-pixel threshold; first motion past
  threshold clears any active focus so the wall-pan resumes
  from the *displayed* camera, not the pre-focus centre.
- **Enforcement:** no `touchstart` / `touchmove` / `touchend`
  listeners anywhere in `src/room/**`. The canvas className
  includes `touch-none` (Tailwind → `touch-action: none`).

### 41. 60° vertical FOV for the phone-portrait Room

- **Forbidden default:** a 50° FOV copied from desktop three.js
  tutorials. At phone-portrait aspect (~0.44) and back-wall
  depth (~5.5 m), 50° vertical collapses horizontal FOV to ~23°,
  framing only the central work at natural wall spacing.
- **Required primitive:** `PerspectiveCamera(60, aspect, 0.1, 100)`
  reads as a standing viewpoint and frames a ±1 m triptych
  comfortably on phone-portrait. The cost is a little more
  perspective distortion on wide side-wall works, which reads
  correctly as *you are in the room*, not *you are looking at a
  screenshot of the room.*
- **Adapter path:** the camera is built in `buildRoomScene()`
  with the 60° constant; the FOV is not a knob because Laura
  doesn't tune it — it's a phone-first decision, not a
  preference.
- **Enforcement:** editorial (a future gate can grep for
  `PerspectiveCamera(50,` anywhere in `src/room/**` and fail).

---

## Active references

The enablers from `CLAUDE.md` § *Reach forward, not back*, in one
place. A reference earns a slot when it's specific enough to
foreclose a default, post-dates the training mean, and materializes
a principle PANG holds.

- **Apple Liquid Glass (iOS 26 / macOS 26)** — real-time digital
  meta-material. Study *how the glass relates to content behind it,
  not just under it.*
  - WWDC25 *Meet Liquid Glass*
  - Apple Developer *Liquid Glass — Technology Overview*
  - *Landmarks: Building an app with Liquid Glass* (sample project)
- **Apple Photo Memories (iOS 18+)** — photos acquiring spatial
  depth without becoming a 3D scene. Study the parallax grammar
  and camera-as-interaction.
- **Bruno Simon portfolio** (bruno-simon.com) — WebGL as *place*,
  not *page*. The Room's ceiling reference.
- **Arc Browser** (arc.net) — chrome that is alive without being
  busy. Command-like surfaces, appearance/disappearance timing,
  Spaces animation when switched.
- **Granola** (meeting notes app) — gray-for-AI / black-for-user
  confidence pattern. The `<Confidence>` primitive reference.
- **Cursor / Claude Code diff UI** — accept/amend model for AI
  output. The `<Diff>` primitive reference.
- **Linear command palette** — keyboard-first command surface
  motion. Reserved reference for a future surface if needed.

A reference leaves this list only if a stronger one replaces it,
named.

---

## The discipline

Every primitive above exists because a 2020-era default would have
crept in if the primitive wasn't named. If you find yourself
reaching for an adjective ("spatial", "glassy", "motion-rich"), stop
and name the primitive. If no primitive fits, open a PR adding one
to this document before writing the code.
