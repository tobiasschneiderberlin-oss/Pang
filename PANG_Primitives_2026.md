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
  Google"* button; passkey button composed *next to* a password
  field (the 2018 compromise — passkey as one option among many).
- **Required primitive:** `navigator.credentials.create/get` with
  `publicKey` + `userVerification: 'required'` + `residentKey:
  'required'` + `authenticatorAttachment: 'platform'`. Conditional
  UI via `<input autocomplete="username webauthn">` is the
  sanctioned assertion affordance on cookie-less cold start.
- **Adapter path:** `usePasskey()` hook wraps
  `@simplewebauthn/browser@11`'s `startRegistration` /
  `startAuthentication` with a structured failure shape
  (`NotAllowedError → "cancelled"`, `InvalidStateError →
  "already-enrolled"`, anything else → `"unexpected"`). Server
  verification uses `@simplewebauthn/server@11` wrapped in
  `src/auth/webauthn/{options,verify}.ts`.
- **Session design:** opaque 32-byte hex bearer cookie
  (HttpOnly + SameSite=Strict + Path=/, `Secure` in prod),
  backed by a server-side session record. Not a JWT — JWT-as-
  session makes revocation a deny-list; the opaque design makes
  revocation a file delete. Rotation on every assert. 14-day TTL.
- **Counter-rollback detection is doctrinal, not optional.**
  `verifyAuthenticationResponse`'s new counter must be strictly
  greater than the stored counter; on rollback, the credential
  moves to a revoked directory (tombstone by move, primitive 50)
  and the assert returns 410 Gone.
- **Enforcement:** no `<input type="password">` anywhere in the
  codebase. Gate **P10** (landed iter #9 upgrade): walks every
  `app/api/**/route.ts` and confirms `requireSession()` is the
  first meaningful statement of every non-allowlisted handler.
  Codified 2026-04-24, iter #9.

### 17. Gallery-signed JWT invite tokens, single-use, not magic links as primary

- **Forbidden default:** *"Enter your email to continue"* on the
  landing page; long-lived bearer tokens that survive a first
  successful bind.
- **Required primitive:** the gallery's invite URL embeds an
  HS256 JWT (14-day TTL, signed via `jose@5`) identifying the
  gallery + optional recipient metadata. The JWT carries a `jti`
  that's consumed on first successful bind; replays fail closed
  with 409.
- **Adapter path:** `src/auth/server/invite.ts` — `signInvite` /
  `verifyInvite` / `consumeInvite`. The landing page at `app/i/
  [token]/page.tsx` validates the three-segment shape server-
  side (cheap check, no verify) then hands off to
  `InviteLandingClient` which calls `/api/auth/invite/bind`. Bind
  is always client-side so CSRF-tokened cookies flow through in
  the right order.
- **Single-use marker commits before the session issues.** The
  consumed-`jti` file is written inside the same span as the
  session-cookie write; a crash between them reads as "invite
  consumed, session not issued" and the collector retries (which
  correctly fails closed — they ask the gallery for a new link).
  "Commit after" re-opens the replay window. General rule:
  **idempotency markers commit before the side effect they
  guard** (primitive 51).
- **Enforcement:** `app/api/auth/invite/bind/route.ts` is the
  single verifier; consumption is a file-exists check at
  `.pang/server-invites/<jti>.consumed`. Replay test in
  `e2e/passkey.spec.ts` proves the contract. Codified 2026-04-24,
  iter #9.

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
- **Adapter path:** `<DeepZoom>` component at
  `src/components/deep-zoom/DeepZoom.tsx` wraps the viewer; it is the
  only call site. DOM chrome owns close semantics via React synthetic
  capture (`onKeyDownCapture`) because OSD's `canvasKeyHandler` calls
  `$.cancelEvent` on Escape, starving window bubble-phase listeners.
- **Enforcement:** `scripts/check-transforms.ts` via
  `npm run check:gates` (P24d). Scans `src/` minus
  `src/components/deep-zoom/` for `transform:\s*scale(`, `scaleX(`,
  `scaleY(` in CSS-in-JS / `style=` literals and Tailwind `scale-<n>`
  utilities. Codified iter #7.

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

## Storage continued

### 42. Discriminated-union Zustand stores export a NONE singleton

- **Forbidden default:** a selector that maps missing keys to an
  inline literal, e.g.
  `useEnrichment((s) => s.byWorkId[id] ?? { kind: "none" })`.
  Every call allocates a fresh object; React's
  `useSyncExternalStore` compares snapshots by identity, detects
  drift, and logs *"getServerSnapshot should be cached to avoid
  an infinite loop"* — then hangs the surface.
- **Required primitive:** the store module exports a
  module-scoped singleton for the NONE variant (e.g.
  `export const ENRICHMENT_NONE: EnrichmentState = { kind: "none" }`).
  Every selector fallback reuses the singleton.
- **Adapter path:** any `create<StoreWithDiscriminatedUnion>()`
  in `src/stores/*.ts` exports its NONE singleton alongside the
  hook and state type; consumers import the singleton, never
  write the literal.
- **Enforcement:** code-review level + a recurrence-gate
  candidate (`grep '?? { kind: "' src/components/**/*.tsx`
  post-refactor). Landed 2026-04-23 from iter #6's Playwright
  hang.

---

## Motion continued (again)

### 43. Chapter grammar = reveal + persistent rest state

- **Forbidden default:** every beat in a chapter is transient.
  `activeBeats(plan, tMs)` drops past-end beats; the renderer
  iterates what's active and everything else vanishes. For
  narration beats (settle, ready, placement lines) that's
  correct — they're prose and the prose is over. For artifact
  beats (document cards, work thumbnails, anything Laura can
  *tap*), dropping past-end unmounts the tap target and the
  evidence disappears behind the reveal.
- **Required primitive:** artifact beats carry two lives — a
  transient reveal (`envelope` 0→1 across `durationMs`) and a
  persistent rest state (`envelope = 1, progress = 1` for all
  `tMs >= beat.startMs + beat.durationMs`). The chapter is the
  reveal *and* the settled evidence, not the reveal alone.
- **Adapter path:** `persistentArtifactSlots(beats, tMs)` in
  `src/ai/chapter/driver.ts` (companion to `activeBeats`). The
  renderer consumes whichever of the two helpers matches the
  beat kind's semantics — narration = transient, artifact =
  reveal-plus-rest.
- **Enforcement:** every `ChapterShape` renderer imports from
  `@/ai/chapter`; the helper is the single call site.
  Code-review level today; a recurrence-gate candidate once a
  second artifact-bearing chapter ships (it will: Room-wide
  Deep Zoom overlays, future narration chapters). Landed
  2026-04-23 from iter #6's mobile-Playwright card-unmount
  race.

---

## Canvas surfaces continued (yet again)

### 44. Overlay canvases gate the Room RAF tick via a named `active*` selector on `useWorks`

- **Forbidden default:** a second canvas surface (document viewer,
  deep-zoom, future artist canvas, provenance graph) mounted on
  top of the Room with the Room's RAF tick still running beneath
  it. Two render loops share the main thread; the hidden Room
  burns frames the user cannot see; INP degrades on every pinch
  inside the overlay.
- **Required primitive:** every second-canvas overlay declares a
  named `active<Surface>: id | null` selector + matching
  `setActive<Surface>` action on `useWorks`. The Room's RAF tick
  reads the union (`activeViewer || activeDeepZoom || …`) and
  pauses whenever any overlay is mounted; resumes when all return
  to `null`. The overlay itself owns its own render loop.
- **Adapter path:** `src/stores/works.ts` exports one
  `active<Surface>` field per overlay kind; `src/room/RoomCanvas.tsx`
  subscribes to the union via a shallow selector and gates its
  `requestAnimationFrame` call. The overlay component calls
  `setActive<Surface>(id)` on mount and `setActive<Surface>(null)`
  on unmount — a single effect, idempotent.
- **Enforcement:** grep `src/stores/works.ts` for every overlay
  component in `src/components/**` that imports from
  `@/stores/works`; every such overlay must read or write an
  `active<Surface>` field. Code-review level today; recurrence-gate
  candidate once the third overlay ships. Landed 2026-04-23 from
  iter #6 (`activeViewer`) + iter #7 (`activeDeepZoom`), where the
  pattern appeared twice and earned the name.

---

## State

### 45. Ref guards gating cleanup-time side effects reset on every effect setup

- **Forbidden default:** a module-scoped or set-once
  `useRef`-backed guard used to make a cleanup-time side effect
  idempotent across multiple unmount paths (Escape handler +
  focus-change unmount, for example). React 19 StrictMode's
  dev-time simulated cleanup/remount fires the cleanup once,
  sets the guard to `true`, then *persists the ref across the
  simulated remount* — so the real user interaction sees an
  already-tripped guard and the intended side effect never fires.
- **Required primitive:** the guard is reset inside the effect
  body, *before* the cleanup closure captures the ref, on every
  setup. Pattern:
  ```ts
  useEffect(() => {
    closeEmittedRef.current = false; // reset on setup
    return () => {
      if (!closeEmittedRef.current) {
        closeEmittedRef.current = true;
        emitClose("focus_change");
      }
    };
  }, [deps]);
  ```
  The reset undoes StrictMode's simulated corruption on the
  second setup; the cleanup closure reads the current ref, not
  a captured value.
- **Adapter path:** any `useRef<boolean>()` acting as a
  once-only cleanup gate lives inside the effect that owns the
  cleanup. A separate idempotency handler (Escape) reads the
  same ref.
- **Enforcement:** code-review level. Canonical counter-example:
  iter #7's `DeepZoom.tsx` emitted `deep_zoom.close` with
  `close_via: "focus_change"` *before* the paired
  `deep_zoom.open`, surfaced in a Playwright trace. Cost ~90 min
  to locate. Landed 2026-04-23 from iter #7.

---

## Client components

### 46. Components that touch browser globals at module load ship via `next/dynamic({ ssr: false })`

- **Forbidden default:** a `"use client"` component that
  statically imports a module touching `document`, `window`,
  `self`, or other browser-only globals at module evaluation
  time. The App Router evaluates client modules on the server
  during prerender; the directive only marks hydration
  boundaries, not SSR skipping.
- **Required primitive:** the **dynamic-wrapper split**. A
  thin outer file `Foo.tsx` exports `function Foo()` that
  renders `<FooClient />` obtained through
  `next/dynamic(() => import("./FooClient"), { ssr: false })`.
  The inner `FooClient.tsx` holds the real component and may
  import the offending module freely.
- **Adapter path:** canonical references:
  - `src/components/deep-zoom/DeepZoomOverlay{,Client}.tsx`
    (OpenSeadragon touches `document` at load).
  - `src/room/dom/TheRoomCanvas{,Dynamic}.tsx` (three/webgpu
    touches `self`).
  - `app/deep-zoom-smoke/DeepZoomSmokeClient{,Dynamic}.tsx`.
- **Enforcement:** code-review level. Signal: a Playwright
  webServer boot fails with `ReferenceError: document is not
  defined` (or `window`/`self`) originating from a client
  module's static import. When the failure surfaces, introduce
  the wrapper split; do not reach for `typeof window !==
  "undefined"` guards or lazy `useEffect` imports. The split
  is the sanctioned shape. Codified 2026-04-24 from iter #8.

---

## Canvas surfaces continued (again)

### 47. Third-party canvas engine cache-throughs install via a per-viewer override on the engine's own dispatch seam

- **Forbidden default:** a Service Worker fetch handler, a
  custom `fetch` interceptor, or a proxy server in front of
  the engine's tile/page requests. Each loses the
  `source: "opfs" | "network"` attribution on the main
  thread — by the time the downstream event fires, the
  decision context is gone, and cross-thread message plumbing
  to reconstruct it costs more than the cache itself.
- **Required primitive:** the adapter around a third-party
  canvas engine installs a per-viewer override on the engine's
  own dispatch seam. The override rides the same call stack
  that decides to fetch, so attribution is trivially correct.
  Canonical shapes:
  - OpenSeadragon: `viewer.world.getItemAt(0).source
    .downloadTileStart = (context) => { ... }` from
    `viewer.addOnceHandler("open", ...)`. Reference:
    `src/deep-zoom/opfs-override.ts`.
  - PDF.js: the `getDocument({ fetch })` option (iter #6
    DocumentViewer).
- **Adapter path:** the override emits
  `<surface>.cache.{hit,miss,evict}` + a load-span with
  `source: "opfs" | "network"` attribution in the same
  function that resolved the bytes. Object URLs from blob
  caches are revoked in `queueMicrotask` after the engine's
  synchronous copy-in.
- **Enforcement:** code-review level. Signal: a `tile.load`
  span emits `source` values that don't match the byte source
  (e.g., `"network"` on a warm cache), or the cache-hit path
  needs cross-thread attribution plumbing. When the override
  seam exists on the engine, use it; when it doesn't, the
  adapter has chosen the wrong engine. Codified 2026-04-24
  from iter #8.

### 48. Second meaning on the existing gesture, not a new gesture, when escalation is discrete and state-dependent

- **Forbidden default:** introducing long-press, double-tap,
  pinch-out-past-threshold, or hover-intent as a second
  escalation channel from a selected state. Each grows the
  controller's surface and muddies the handoff with
  third-party engines that own their own variants of those
  gestures (OSD pinch, PDF.js scroll, etc.).
- **Required primitive:** when escalation is discrete and
  occurs on an already-selected target, the second firing of
  the existing selection gesture *is* the escalation. The
  gesture's meaning is state-dependent; the grammar stays
  single-primitive.
- **Adapter path:** `src/room/gestures.ts` carries an
  `onSecondTap?(workId)` binding alongside `onTap`. A tap on
  an already-focused work fires the second-tap signal and
  keeps focus; every other tap path retains its prior
  meaning. The controller field is one line; the test branch
  is one describe.
- **Enforcement:** code-review level. Signal: a feature that
  needs a discrete escalation from a selected state proposes
  a new gesture name. Redirect to the second-firing pattern
  unless the escalation is continuous (pinch escalation
  across overlay handoffs is genuinely a different problem —
  deferred to its own iteration). Codified 2026-04-24 from
  iter #8.

---

## State continued

### 49. Reusable storage primitives expose observability via caller-configurable hooks, never by importing the telemetry surface

- **Forbidden default:** a reusable cache / queue / WAL
  module that imports `src/**/otel.ts` (or any
  surface-specific telemetry catalogue) and emits spans
  directly. The module stops being reusable — a second caller
  gets the first caller's span names.
- **Required primitive:** the primitive accepts
  caller-configurable hooks (`onEvict`, `onWrite`,
  `onQuotaLow`, etc.) and invokes them wrapped in try/catch
  so a caller's throw can't poison storage state. The
  caller wires the hook to the telemetry catalogue for its
  surface.
- **Adapter path:** canonical reference:
  `src/deep-zoom/opfs-cache.ts` exports
  `putTileBlob(url, blob, options)` and
  `fetchTileCached(url, init, options)` with
  `options.onEvict?(count, bytesFreed, bytesRemaining)`.
  `src/deep-zoom/opfs-override.ts` wires the hook to
  `deepZoomCacheEvictEvent`. A future document-tile cache
  can reuse `opfs-cache.ts` and wire its hook to a
  document-surface span without changing the cache module.
- **Enforcement:** code-review level. Signal: a storage
  primitive in `src/` that imports a `*/otel.ts` is the
  regression. Surface-specific wrappers (the *override* in
  the deep-zoom case) are the right home for telemetry
  wiring. Codified 2026-04-24 from iter #8.

---

## Storage continued

### 50. Tombstone by move, never by delete — live and archived live in two directories

- **Forbidden default:** a store that "deletes" a record by
  calling `unlink` (or `DELETE FROM …`) at the store level,
  removing the byte trail that answers forensic questions
  later. Works in an isolated test; fails the first time
  someone asks *"did this credential ever authenticate?"* or
  *"when was this invite consumed, and by whom?"*.
- **Required primitive:** the store has two directories (or
  two row-states with a discriminator) — live and archived.
  Revocation / consumption / soft-delete is a **move**, not
  an unlink. The store's public API treats archived-as-gone
  for every read path; forensics walks the archive directly.
- **Adapter path:** canonical references:
  `.pang/server-credentials/` → `.pang/server-credentials-revoked/`
  on counter-rollback detection (`src/auth/server/store.ts`);
  `.pang/server-outbox/pending/` → `.pang/server-outbox/delivered/`
  on successful drain (iter #4). Both use the same shape:
  `renameSync` from live to archived; the live `loadX(id)`
  returns `null` so the caller sees the credential/row as
  gone.
- **Enforcement:** code-review level. Signal: a store helper
  in `src/` calls `unlink`, `rm`, or `DELETE` against its
  durable backing. Redirect to a move-to-archived shape
  unless the record is genuinely ephemeral (session tokens,
  challenges — both of which *are* `unlink`ed because they
  have no forensic value). Codified 2026-04-24 from iter #9.

### 51. Idempotency markers commit before the side effect they guard

- **Forbidden default:** write the side effect (issue a
  session cookie, send an email, charge a card), then write
  the "this was processed" marker. A crash between the two
  re-opens the window for replay.
- **Required primitive:** the marker commits **first**, in
  the same span / transaction as the side effect where
  possible. If the marker commits and the effect crashes,
  the retry correctly fails closed (the caller sees
  "already processed") and escalates to the human path
  (ask the gallery for a new invite; call the support
  desk). That's a strictly better failure mode than the
  replay window.
- **Adapter path:** canonical reference:
  `app/api/auth/invite/bind/route.ts` writes
  `.pang/server-invites/<jti>.consumed` before calling
  `createSession()`; a replay test in `e2e/passkey.spec.ts`
  proves the contract. The pattern applies to every
  single-use token, outbox dispatcher, and "exactly-once"
  claim in the codebase.
- **Enforcement:** code-review level. Signal: a handler
  that reads *"if processed return; else do the thing;
  mark processed"* has the order wrong. The correct order
  is *"if processed return; else mark processed; do the
  thing"*. Codified 2026-04-24 from iter #9.

### 52. Filesystem-backed server stand-in for durable state in dev, row-shape 1:1 with production

- **Forbidden default:** waiting on the production
  database (Supabase / Postgres / whatever) to wire the
  durable server-side state an iteration needs. Blocks the
  iteration on infra. The alternative — an in-memory
  `Map` — is worse: restarting `next dev` loses every
  record, and the migration-to-prod is a rewrite.
- **Required primitive:** any durable server-side store
  in dev lives under `.pang/server-<name>/` as one file
  per record. JSON shape is literally the production row
  shape (same field names, same types). The directory is
  `.gitignore`d with a `.gitkeep` stub so the shape is
  tracked but the contents never are. The migration to
  production is a helper swap: `JSON.parse(readFile(path))`
  becomes `await supabase.from(table).select(…)`; the call
  site doesn't change because the store helpers
  (`loadUser`, `saveSession`, `consumeInvite`, etc.)
  already hide the I/O.
- **Adapter path:** canonical references: `.pang/server-outbox/`
  (iter #4, verification request dispatcher) and
  `.pang/server-{users,credentials,sessions,invites,
  challenges,credentials-revoked}/` (iter #9, auth). Six
  directories, one pattern. Rate-limit state also lives
  there (`.pang/server-rate-limit/`) so it survives `next
  dev` restarts within a development session.
- **Enforcement:** code-review level. Signal: a new
  iteration that needs durable server state proposes an
  in-memory `Map` or blocks on Supabase wiring. Redirect
  to `.pang/server-<name>/`; the migration cost is zero
  because the call sites are already store-helper-hidden.
  Codified 2026-04-24 from iter #9; used three times
  across iters #4, #9, and reserved for future iters.

### 53. Museumsschild push-notification title register

- **Forbidden default:** marketing-vocabulary notification
  titles, exclamation marks, emojis, evaluative adjectives.
  *"Great news! A gallery confirmed your work ✨"*. The
  notification shade is a gallery wall without the gallery's
  silence — the register has to hold louder there, not
  quieter. Most apps default to the Slack / Instagram /
  Duolingo tone; PANG cannot afford to.
- **Required primitive:** the notification title names the
  state that just became true, in sentence case, without a
  verb of persuasion. *"a gallery has confirmed a work."*
  *"a gallery has answered."* *"the ask went quiet."* The
  body is one clause of placement, no call-to-action. No
  title case, no exclamation, no emoji (`CLAUDE.md` § *The
  cannot-do list*), no first-person pronoun. The Museumsschild
  test applies: the title has to be something that could hang
  on a wall next to the work without looking out of place.
  Tapping the notification deep-links to the work; the
  notification is a placement, not an alert.
- **Adapter path:** canonical reference: `public/sw.js`
  lines 172–235 (iter #10). The three outcome kinds —
  `"confirmed"`, `"declined"`, `"expired"` — map to three
  title+body pairs authored inline in the SW. The payload
  on the wire is `{requestId, workId, outcome}` only; the
  user-visible strings live in the SW so the wire stays
  small and the strings stay out of the prompt cache (they
  are SW-authored, never agent-composed).
- **Enforcement:** code-review level + A5 voice check on
  any SW string literal that surfaces to the user. Signal:
  a PR touching `public/sw.js`'s `push` handler adds a
  title with `!`, with title case, with an emoji, or with a
  verb of persuasion. Reject; rewrite to placement register.
  Codified 2026-04-24 from iter #10.

### 54. Null-aware agent prose never leaks the null back

- **Forbidden default:** an agent prompt that gets
  `artist: null` in the input and emits *"Untitled by
  unknown artist"* or *"by N/A"* or *"by null"*. The
  null is a legitimate state of incomplete intake; the
  agent's job is to compose prose that honours it
  structurally, not to surface the placeholder. Templates
  fail here because nulls become scaffold.
- **Required primitive:** the system prompt instructs the
  agent to elide absent fields — *if the artist is not
  known, the sentence rephrases without it; it never names
  the absence*. Production output is checked against a
  banned-string list per field (`"unknown artist"`,
  `"null"`, `"undefined"`, `"n/a"`, `"name pending"`,
  `"not provided"`) in the A22 eval corpus. A fixture
  exists for the null-artist case specifically so a prompt
  drift that re-introduces the scaffold fails loud in CI.
  The scorer does not care which null-avoiding phrasing
  the agent picks — only that the leaked token doesn't
  appear.
- **Adapter path:** canonical reference:
  `evals/correspondence/fixtures.ts`
  (fixture `correspondence-03-missing-artist`) and
  `src/ai/prompts/correspondence.ts` (the "elide, do not
  surface" clause in the system prompt). The pattern
  generalises across every prose-composing agent whose
  input may carry optional fields — Narrative Agent will
  use the same discipline when it lands.
- **Enforcement:** A22 eval corpus. Signal: a fixture
  with a null field catches the agent surfacing the
  placeholder. The eval fails CI; the prompt (not the
  scorer) is wrong. Codified 2026-04-24 from iter #10.

### 55. Per-agent model selection is a decision, not a default

- **Forbidden default:** every P-LLM pinned to the current
  top-tier model (Claude Sonnet / Claude Opus), because
  "that's the strongest model available." A composing
  task that wants 400ms latency and 500 tokens of
  predictable voice-register prose is overpriced and
  overlatent on Opus; a reasoning task that parses an
  ambiguous photo label needs Sonnet's accuracy floor.
  Uniform tiering wastes cost on the easy agents and
  under-delivers on the hard ones.
- **Required primitive:** each agent module explicitly
  names the model tier in `@/ai/agents/models.ts`
  (`AGENT_MODEL_IDS.<agent>`) and the rationale is in
  the agent's module header. The tier is part of the
  agent's public contract, alongside input / output
  schema, retry policy (A21), and budget (A23). A tier
  change is a deliberate edit with an eval re-run, not
  an implicit upgrade when the vendor ships a new
  top-tier model. For interactive composing where the
  collector sees the draft pre-send, Haiku is the
  default; for ambiguous-input structured-output
  extraction where the agent has to reason about what
  a blurred label actually says, Sonnet is the default.
  Opus is reserved for a task none of the current
  agents need.
- **Adapter path:** canonical reference:
  `src/ai/agents/models.ts`
  (`AGENT_MODEL_IDS = { intake: "claude-sonnet-4-5",
  enrichment: "claude-sonnet-4-5", correspondence:
  "claude-haiku-4-5" }`). Iter #10 is the first
  deliberate non-Sonnet pin; the rationale lives in
  `src/ai/agents/correspondence.ts` lines 42–46.
- **Enforcement:** code-review level. Signal: a new
  agent module lands without a named model pin, or a
  tier change lands without an eval re-run showing the
  new tier still passes. The A22 threshold (0.85)
  holds regardless of tier; a downgrade that breaks
  the eval reverts. Codified 2026-04-24 from iter #10.

### 56. URL-handoff preserves user gesture via `<a>.click()`, never `location.href`

- **Forbidden default:** after an async fetch resolves,
  write `window.location.href = channelUrl` or
  `window.open(channelUrl)` to navigate the user to a
  `mailto:` / `wa.me:` / `tel:` / any OS-level scheme.
  iOS Safari's pop-up and URL-scheme policies require
  the navigation to happen inside the same synchronous
  user-gesture tick that initiated the user's tap. Any
  `await` crosses a microtask boundary; Safari then
  silently refuses the handoff. The user is stranded
  on the originating page with no error, no toast, no
  diagnosable signal. This is the class of bug that
  eats an evening.
- **Required primitive:** pre-allocate an
  `<a target="_blank" rel="noopener noreferrer">`
  element *synchronously* at the user-gesture tap.
  `await` any necessary server round-trip (fetch the
  `channelUrl` from your dispatch route, for example).
  Once the async work resolves, set `anchor.href =
  channelUrl` and call `anchor.click()`. The click is
  inside the original user-gesture chain (Safari
  honours the anchor's user-origin); `target="_blank"`
  ensures the handoff opens in the OS-level client
  without replacing the PANG tab; `rel="noopener
  noreferrer"` is the 2026 default hygiene. The anchor
  can be invisible (not attached to the DOM is fine on
  modern Chromium + Safari; attach+detach is the
  safest posture if a future browser regresses).
- **Adapter path:** canonical reference:
  `src/components/verification/AskGallery.tsx`
  "send now" handler (iter #10). The pattern applies
  to every OS-level handoff PANG might add —
  `sms:` when / if the Tier-C deferral lifts,
  `tel:` for a future gallery-call affordance, any
  future custom-scheme deep-link. `window.location =`
  is strictly wrong.
- **Enforcement:** code-review level. Signal: a PR
  introduces `window.location.href = ` or
  `window.open(` on a URL that starts with a
  non-`https:` / non-`http:` scheme. Reject;
  rewrite to the pre-allocated-anchor pattern.
  Codified 2026-04-24 from iter #10.

### 57. Service-worker → tab fan-out via BroadcastChannel

- **Forbidden default:** after the service worker
  handles a push event, call `clients.matchAll()` and
  `postMessage` to each open client, hand-rolling the
  fan-out. Works for one consumer; falls apart when a
  second consumer (test harness, iframe, devtools
  preview) wants the same event. Or: have the tab poll
  the server on `visibilitychange` to pick up any
  state the SW processed while the tab was hidden.
  Wasteful, lags the push, races with the reconciler.
  Or: just rely on the OS notification — which doesn't
  flip the in-tab store, so a collector who switches
  back sees a stale state until the next boot
  reconcile.
- **Required primitive:** the SW `postMessage`s
  through `new BroadcastChannel("pang-<domain>")`
  immediately after processing the push (or any other
  server-originated event). Every tab with a
  listener on the same channel name picks up the
  event and flips its store. Fire-and-forget semantics
  handle the "no tab open" case automatically — the
  boot-time reconciler is the correctness floor
  (primitive 58). The channel name is namespaced per
  subsystem (`pang-verification`, future `pang-
  enrichment`, `pang-works`) so a listener only
  wakes for its own events. Zero tap; sub-frame
  latency; no polling.
- **Adapter path:** canonical reference:
  `public/sw.js` lines 218–232 (iter #10) — the
  confirm push handler closes with a
  `BroadcastChannel("pang-verification")
  .postMessage(...)`. The listener lives in the
  tab's reconciler / confirm-bridge wiring.
  Generalises: any SW-processed event with
  user-visible tab-side state should fan out through
  BroadcastChannel.
- **Enforcement:** code-review level. Signal: a new
  SW event handler processes state that the tab needs
  to reflect, but doesn't fan out through a
  BroadcastChannel. Add the relay; the cost is one
  line in the SW and one listener in the tab.
  Codified 2026-04-24 from iter #10.

### 58. Asynchronous round-trips ship two rails: push for latency, poll for correctness

- **Forbidden default:** push-only — trust the
  notification channel to deliver every acknowledgement
  and let the client display stale state when it
  doesn't. Or: poll-only — ignore the push path's
  latency advantage and make every state transition
  wait for the next boot walk. Both fail collectors
  whose devices silently drop subscriptions, whose
  browsers vendor-revoke registrations, whose mobile
  OS sleeps background SWs past the push TTL, or
  whose connection partitioned between "sent" and
  "acknowledged."
- **Required primitive:** every asynchronous
  round-trip with a user-visible side effect ships
  both rails. The push (or BroadcastChannel — see
  primitive 57) is the *latency* rail: when it
  works, the tab flips state inside a frame. The
  boot-time outbox walker is the *correctness*
  floor: it visits every `dispatched`-state record,
  polls the server's authoritative outcome endpoint,
  and reconciles the client store deterministically.
  Neither alone suffices — push without poll drops
  silently; poll without push wakes the collector
  late. The server's outcome record is the single
  source of truth; push is a notification channel,
  not the state channel. "Outbox-as-truth" is the
  phrase.
- **Adapter path:** canonical reference:
  `src/verification/reconcile.ts` (iter #10
  extension) walks `dispatched` outbox entries on
  every boot and calls
  `/api/verification/outcome/<requestId>` to
  reconcile. `src/verification/push-deliver.ts`
  sends the push best-effort without blocking the
  outcome write. The two rails are orthogonal —
  delivery failure doesn't fail the outcome; poll
  success catches the gap.
- **Enforcement:** code-review level. Signal: a new
  async round-trip ships with only one rail
  (push-only is the common mistake — it looks like
  the state channel but isn't). Add the
  outbox-walker rail; the cost is a route and a
  boot hook, and the correctness floor you gain is
  worth a week of "it works on my device" support
  investigations. Codified 2026-04-24 from iter #10.

### 59. Active-surface slice is a named primitive; claim is idempotent, release is ownership-guarded

- **Forbidden default:** surface-awareness via scattered
  evidence — the router path, the presence of an overlay DOM
  node, prop-threaded "is this surface active?" booleans, the
  `pang.surface` OTel dimension read by every consumer that
  needs to gate. The default feels harmless because every
  single consumer works in isolation, but the cumulative cost
  is that adding a new surface-aware decision (a chapter
  mount, a focus sticking rule, a reduced-motion clamp at
  transition) requires touching every other consumer to stay
  consistent. The surface concept was already everywhere;
  what was missing was a name for it.
- **Required primitive:** a Zustand slice
  (`src/stores/surface.ts`) with a discriminated union of
  surface kinds (`"room" | "scan" | "gallery-confirm" |
  "deep-zoom" | "document" | null`). Every surface island
  claims its slot on mount via a `useSurfaceClaim(kind)`
  hook; the hook sets the active surface on mount and
  releases it on unmount. The setter is idempotent (writing
  the same surface is a no-op); the clear is ownership-
  guarded via a `releaseIfOwner(kind)` action — a later
  unmount of a previous owner doesn't evict a newer surface
  that has already taken the stage. Not persisted: surface
  is a runtime concept, and a refresh restarts at whatever
  route the URL selects. The slice is the canonical reactive
  read; OTel emissions (the `pang.surface` dimension)
  continue to derive from it, so the aggregator shape stays
  stable.
- **Adapter path:** canonical reference:
  `src/stores/surface.ts` + `src/stores/use-surface-claim.ts`
  (iter #11) + five call sites: `RoomSurfaceClaim.tsx`,
  `app/scan/page.tsx`, `app/g/_components/
  GalleryOutcomeClient.tsx`, `DeepZoom.tsx`,
  `DocumentViewer.tsx`. New surfaces claim at mount via
  two lines (`useSurfaceClaim("kind")`); new consumers
  read via `useSurface((s) => s.activeSurface)`.
- **Enforcement:** code-review level. Signal: a new
  surface-aware decision reaches for the router path, an
  overlay's presence, or a prop-threaded "is this active?"
  boolean. Replace with the slice read. The cost is zero
  (the slice already exists); the benefit is that every
  future surface-aware decision shares one source of truth.
  Codified 2026-04-24 from iter #11.

### 60. Per-entity UX-state latch, not a central dismissals table

- **Forbidden default:** a `ux_dismissals` / `shown_hints` /
  `onboarding_state` table (or its OPFS equivalent: a
  `ux-state.json` keyed by composite strings like
  `shown:<entityId>:<ceremony>`) that accumulates every
  once-and-only-once flag the app ever grows. The default
  looks reasonable on day one when there's a single flag; by
  year one it is a landfill of orphan keys, dead entity IDs
  nobody cleaned up, and composite-key schemes that nobody
  can migrate because the lifecycle of each flag is coupled
  to a business event the table doesn't know about.
- **Required primitive:** a UX-state latch that the ceremony
  gates on (chapter-shown, tip-seen, banner-displayed, once-
  only-X) lives *as a field on the entity whose business
  event triggered it*, not in a central table. For iter
  #11's outcome chapter: `outcomeChapterShownAt: string |
  null` sits on the `"confirmed"` / `"declined"` variant of
  `VerificationState`, next to `decidedAt` and `requestId`.
  The lifecycle is automatic: when the verification entry
  is evicted (outbox cleanup, user-initiated removal), the
  latch goes with it. The migration story is clean: the
  field is optional in the persistence parser so legacy
  records before the field existed parse as `null` and
  replay the ceremony on next surface entry, which is the
  correct failure mode for a short ceremony.
- **Adapter path:** canonical reference:
  `src/stores/verification.ts` — the `"confirmed"` and
  `"declined"` variants both carry
  `outcomeChapterShownAt: string | null`. The
  `markOutcomeChapterShown(workId, shownAt)` action is
  idempotent (a second call on an already-latched entry is
  a no-op; StrictMode double-mount safe). `verification.
  persist.ts` reads the field with legacy-migration posture
  (missing → null). Generalises to any future
  once-and-only-once UX flag on intake records, enrichment
  records, deep-zoom entries, etc.
- **Enforcement:** code-review level. Signal: a new
  once-and-only-once flag reaches for a shared dismissals
  store or a composite-keyed OPFS file. Move the flag to
  the entity whose business event triggers the ceremony. If
  no such entity exists, the flag probably shouldn't be a
  latch at all — it's either a preference (lives in the
  preferences store) or a session runtime concern (lives
  nowhere durable). Codified 2026-04-24 from iter #11.

### 61. Module-singleton ref bridges sibling imperative handles; cleanup ref-compares

- **Forbidden default:** threading a `ref` or an
  `imperativeHandle` up to the common ancestor and back
  down to both siblings, or introducing a React context
  provider for the single purpose of bridging one
  per-frame imperative call between two sibling components.
  Both defaults conflate *render graph* with *imperative
  handle lifetime*. A per-frame write like
  `setArrivalFactor(id, t)` has no business round-tripping
  through React reconciliation; it's a call into an
  imperative surface (a canvas, a media element, a worker)
  and its home is module state.
- **Required primitive:** a module-singleton ref
  (`{ current: Handle | null }`) exported from a small
  module dedicated to it. The surface that *owns* the handle
  populates the ref on mount and clears it on unmount, with
  a ref-compare in the cleanup: `if (handleRef.current ===
  handle) handleRef.current = null`. The ref-compare matters
  because StrictMode double-mounts cleanup before the second
  mount runs — a naive clear nulls out the *next* mount's
  handle, and every subsequent read returns null. Sibling
  components read the ref on every frame or on demand.
  Works because the ref is typed, the module boundary is
  narrow, and the handle's shape is stable (methods on a
  handle, not raw DOM nodes).
- **Adapter path:** canonical reference:
  `src/room/dom/roomHandleRef.tsx` + `TheRoomClient.tsx`
  (iter #11) — `TheRoomClient` populates the ref in a
  `useEffect` with a mount-captured handle object, the
  cleanup ref-compares against the same handle object
  before nulling. `OutcomeChapterMount`, a sibling on the
  Room route, reads the ref and calls `setArrivalFactor`
  from its RAF loop. Generalises: any two sibling
  components that need to share an imperative handle
  across a per-frame or high-frequency boundary.
- **Enforcement:** code-review level. Signal: a new
  sibling-to-sibling imperative call is about to thread a
  `ref` through a common ancestor, or introduce a context
  provider for one call. Use the module-singleton ref
  pattern. The cost is one small module; the benefit is
  one less context boundary and no render-graph coupling
  for a per-frame write. Codified 2026-04-24 from iter #11.

### 63. Seed-every-privileged-LLM-call — the voice layer holds at the call boundary

- **Forbidden default:** relying on the agent file to "obviously"
  pass the voice seed to its Claude call because the identifier is
  imported at the top of the file. A developer under delivery
  pressure adds a second `messages.create(...)` beside the first,
  copies the shape, forgets the `system:` array, or rolls a
  hand-written string for "just this one short quick call." The
  voice discipline degrades silently: A4 still passes (the file
  imports the identifier), CI still green, Laura hears a Claude
  call that speaks with no voice. The failure mode is cumulative —
  every new agent widens the hole.
- **Required primitive:** a gate at the call site, not the file.
  For every `client.messages.create(...)` on the P-LLM path in
  `src/ai/agents/**`, an AST walk proves the `system` argument
  resolves — directly or through a barrel re-export — to
  `PANG_VOICE_SYSTEM_PROMPT`. Accepted shapes:
  `system: PANG_VOICE_SYSTEM_PROMPT` or
  `system: [{ type: "text", text: PANG_VOICE_SYSTEM_PROMPT, ... }, ...]`
  (the seed in any position; cache-ordering is a separate concern).
  Rejected: string literal, missing field, array without the seed.
  The CaMeL Q-LLM path is explicitly exempt — identifiers ending in
  `QUARANTINED_SYSTEM_PROMPT` opt the call out by naming
  convention, because the Q-LLM carries a narrow extraction role
  and must not inherit voice context it could reflect into a P
  channel.
- **Adapter path:** canonical reference: A24
  (`scripts/gates/a24-voice-seed-adoption.ts`, iter #12). Built on
  `ts-morph` for identifier resolution across imports — the prior
  regex gate (A4) can only verify the import exists; A24 verifies
  every call uses it. Same plumbing generalises: any shared
  cross-agent invariant (future rate-limit budgets, future OTel
  resource attrs, future CaMeL capability tokens) can graduate
  from "every file imports the helper" to "every call site proves
  the helper flows."
- **Enforcement:** mechanical. Signal: A24 fails on any new P-LLM
  call site that doesn't trace `system` to the seed identifier.
  An agent that genuinely cannot carry the seed (future
  hypothetical) requires a doctrine edit to add an explicit
  allowlist — not a per-line escape hatch. Codified 2026-04-24
  from iter #12.

### 64. Corpus-every-user-facing-string — the voice layer holds at the string boundary

- **Forbidden default:** inline JSX literals in components and
  routes (`<button>Sign in</button>`, `<button aria-label="Close">`).
  Each looks like a one-off under delivery pressure and is always
  "going to be moved later." The repo accumulates dozens of
  hand-rolled micro-copy strings that never pass the banned-
  vocabulary gate (it only walks the corpus), never go through voice
  review, and never get a second read. A5 polices what the corpus
  may say; without a gate requiring strings *reach* the corpus, A5
  is a partial check. Icon-only buttons are the worst-offending
  shape: their `aria-label` is the only surface an assistive reader
  sees, and it's the first thing a developer hand-rolls.
- **Required primitive:** every JSX text node and every user-facing
  JSX attribute (`title | aria-label | placeholder | alt`) under
  `src/components/**` and `app/**` must resolve — via import
  analysis — to a corpus module. A corpus module is any file
  matching `src/**/{voice,strings,corpus}*.ts` or the
  `PANG_VOICE_STRINGS` re-export barrel. Template literals pass only
  if all substitutions trace to corpus identifiers AND every quasi
  segment is empty or pure punctuation/whitespace — a template with
  prose in its quasis fails, because the prose belongs in the
  corpus, not in a JSX compositor. The four attribute set is
  deliberately narrow: A25 catches what the collector reads, not
  developer-facing ids and class names.
- **Adapter path:** canonical reference: A25
  (`scripts/gates/a25-corpus-discipline.ts`, iter #12) +
  `src/ai/prompts/strings.ts` (the `PANG_VOICE_STRINGS` bundle as
  the one barrel every component can import from). Same ts-morph
  stack as A24; corpus resolution follows both the filename
  convention and the accepted module-suffix list. The pair A24+A25
  closes the voice loop at both ends: A24 at the LLM call, A25 at
  the JSX render.
- **Enforcement:** mechanical, default-pipeline. The gate runs
  unconditionally in `npm run test` across `src/components/**` and
  `app/**` — iter #13 closed the 58 known inline literals and
  removed the `A25_FULL_SMOKE=1` escape hatch from the default
  path. A narrow opt-out (`A25_FULL_SMOKE_SKIP=1`) survives for
  local bisects; CI never sets it. A new component that lands with
  an inline string fails the gate at the introducing commit, not at
  the next audit sweep. A migration that moves a string from
  component to corpus passes both A5 (banned vocabulary) and A25
  (corpus discipline) by construction. **Enforcement addendum
  (iter #13):** audit-sweep rollout proved to be a one-time cost —
  58 violations → 0 in four move-only commits, byte-neutral on the
  main chunk, zero test breakage. The cadence moves from "quarterly
  audit iteration" to "within one commit". Codified 2026-04-24 from
  iter #12; default-pipeline enforcement codified 2026-04-24 from
  iter #13.

### 65. Seed-as-artifact — the voice prompt is regenerated, never hand-edited

- **Forbidden default:** hand-maintaining
  `src/ai/prompts/voice.ts` as a living file. Once the seed and
  the string corpus both exist, they drift: a new onboarding string
  lands in the corpus, a voice-example stays from three iterations
  ago in the seed, the seed's examples no longer reflect the voice
  the corpus now speaks. The drift is invisible to CI because the
  seed is valid TypeScript and compiles. Laura hears a Claude
  response that matches the examples from last month, not the
  corpus from this week.
- **Required primitive:** `voice.ts` is a generated artifact. A
  deterministic script
  (`scripts/rebuild-voice-prompt.ts`) reads six canonical sample
  addresses from the `PANG_VOICE_STRINGS` bundle and writes the
  examples block between `EXAMPLES:BEGIN` / `EXAMPLES:END` markers.
  A `check:voice-prompt` CI step diffs the committed file against
  the deterministic rebuild; non-zero exit on drift. The canonical
  six slots (`invite.greeting`, `ask_gallery.action`,
  `outcome.confirmation`, `push.offer`, `dispatch.email_label`,
  `arrival.placement`) are doctrine: renaming one is a doctrine
  edit that fails the script loudly.
- **Adapter path:** canonical references:
  `scripts/rebuild-voice-prompt.ts` (the generator),
  `src/ai/prompts/voice.ts` (the artifact, with begin/end markers),
  `src/ai/prompts/strings.ts` (the source bundle + canonical
  addresses list). Generalises: any string asset downstream of an
  authored doctrine should ship as an artifact — the ceremony
  registry (iter #2), the model-budget table (iter #6), and the
  capability graph (iter #1) are natural candidates for the same
  pattern when their own sources stabilise.
- **Enforcement:** mechanical. Signal: `check:voice-prompt` fails
  if the seed and bundle disagree. Fix by re-running
  `npm run rebuild:voice-prompt`; commit the reconciled artifact.
  Never hand-edit between the markers. Codified 2026-04-24 from
  iter #12.

### 66. Banned-vocabulary-single-sourced — one source of truth, TypeScript catches the drift

- **Forbidden default:** the banned-vocabulary list copy-pasted
  between a corpus-walker (A5's `check-strings.ts`) and a CaMeL
  sanitiser (`src/ai/camel/banned.ts`). Two places, two
  hand-maintained hardcoded arrays, two drift surfaces. A new
  banned term gets added to one; the other silently diverges. The
  drift is invisible until a corpus string slips the walker
  because its banned term was never registered with it, or the
  CaMeL pipeline permits evaluative prose because the sanitiser
  list is stale. The fix isn't "remember to edit both." The fix is
  to make the second list not exist.
- **Required primitive:** a single module exports the banned lists
  (`BANNED_VOCABULARY` — the hard marketing-vocabulary list;
  `EVALUATIVE_VOCABULARY` — the soft evaluative-language list).
  Every consumer — the corpus walker, the CaMeL sanitiser, a future
  ESLint rule, a future eval fixture generator — imports from it.
  The module is typed; adding a term in the right list is typed;
  renaming the constant fails compilation at every call site. CI
  catches drift as a TypeScript error, not as a code review
  oversight.
- **Adapter path:** canonical reference: `src/ai/camel/banned.ts`
  (the one source). Iter #12 step 1 migrated
  `scripts/check-strings.ts` off its hand-maintained copy. Pattern
  generalises: wherever two pieces of mechanical policy would want
  the same list (retry classes, cost ceilings, cache TTLs, span
  names), single-source at the earliest reasonable layer and let
  the type system enforce the rest.
- **Enforcement:** mechanical. Signal: a PR adds a banned term to
  one place but not the other — impossible, because the other
  place imports the first. Compile-time. Codified 2026-04-24 from
  iter #12.

### 62. Skip-reason telemetry turns a failure-mode brief into pre-Laura diagnosis

- **Forbidden default:** silent gates — a guard that
  short-circuits a flow without emitting the fact that it
  did, on the assumption that "if the gate works nothing
  happens, and nothing is the right answer." The default
  fails because when the gate later regresses (latch not
  persisting, surface check firing on the wrong edge, a
  condition no longer evaluating correctly), there is no
  observable evidence to find from the outside — the
  failure looks identical to "the gate is working, nothing
  to do here." The iter #11 failure-mode brief named five
  regression classes; each one needed a signal that was
  distinct from absence.
- **Required primitive:** every pre-effect gate emits a
  telemetry span naming its skip reason. For a surface-
  aware chapter mount: `chapter.outcome.skipped
  { reason: "already-shown" | "surface-not-room" }` fires
  every time the gate short-circuits the mount, with the
  entity ID and the gate's inputs as attributes. The skip
  span is not an error — it's the *evidence the gate fired
  correctly*. Diagnosis works from the presence of the
  expected skip spans (the gate is healthy) and from their
  absence (the gate has regressed, or the ceremony is
  failing to trigger upstream of the gate entirely). The
  failure-mode brief's regression classes become
  observable as distinct skip reasons; each class is
  triaged by its own span.
- **Adapter path:** canonical reference:
  `src/ai/chapter/otel.ts` + `outcome-mount.ts` (iter #11)
  — the mount hook calls `spanChapterOutcomeSkipped({
  reason, workId, variant })` on every gate short-circuit.
  The `reason` is a closed discriminated union
  (`"already-shown" | "surface-not-room" | ...`), so
  aggregators can cardinality-safe count by reason.
  Generalises to any pre-effect gate: push-delivery gates,
  reconcile gates, idempotency-marker gates, retry-decision
  gates — each gate's short-circuit is a signal.
- **Enforcement:** code-review level. Signal: a new gate
  lands with a silent short-circuit, or a gate's existing
  implementation returns early on a boolean without
  emitting the reason. Add the skip span; the failure-mode
  brief's regression classes become the closed set of skip
  reasons. The cost is a single telemetry call; the
  benefit is a failure mode that stops being "it didn't
  work" and starts being "the skip span for class N fired
  / did not fire, which points at layer M." Codified
  2026-04-24 from iter #11.

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
