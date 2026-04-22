# PANG — Aha Sprint

> Rails off. Ceiling by default. Develop → Test on Laura's hands →
> Codify, iterate once, or drop.
>
> Optimizes for the moment Laura goes "oh" — not for release velocity,
> not for feature completeness, not for covering old sprint plans. The
> queue is short on purpose.
>
> Every iteration declares four things before code starts: **scope,
> stack, reference, canvas.** A missing declaration produces the
> training-mean implementation. See `CLAUDE.md` § *Reach forward, not
> back*.
>
> Last updated: 2026-04-21 — post-reset. Clock reset to iteration #0
> (PWA reset) and iteration #1 (Intake Agent, Option B). All prior
> iterations archived.

---

## Status

| # | Name | Scope | Status | Landed principle / cut reason |
|---|------|-------|--------|-------------------------------|
| 0 | PWA reset | Infra | **In progress** | — |
| 1 | Intake Agent | Ceiling | Queued (next) | — |
| 2 | The Room v2 | Ceiling | Queued | — |
| 3 | Arrival as chapter v2 | Ceiling | Queued | — |
| 4 | Enrichment Agent v1 | Ceiling | Queued | — |
| 5 | Documents as evidence v1 | Ceiling | Queued | — |
| 6 | Deep Zoom collection-wide | Principle | Queued | — |
| 7 | Passkeys auth | Ceiling | Queued | — |
| 8 | Verification request flow | Ceiling | Queued | — |
| 9 | PANG Voice v1 wire-up | Principle | Queued | — |
| 10 | Narrative Agent — monthly reading v1 | Ceiling | Queued | — |
| 11 | Spatial audio + haptics (opt-in) | Principle | Queued | — |
| 12 | Verify-for-club (conditional) | Principle | Queued, may drop | — |

The old iteration numbering (A1–A11, iterations #1–#13 of the previous
family) is archived. See `_archive/legacy_docs/PANG_Aha_Sprint.md` for
the pre-reset log. None of those iterations is a dependency for the
new order.

---

## Testing cadence

Not every iteration earns Laura's hands. Gates catch plumbing
regressions mechanically; Laura catches whether the experience
actually walks. The split is:

| # | Iteration | Cadence | Why |
|---|-----------|---------|-----|
| 0 | PWA reset | Gates only | Infrastructure. No experience to test. |
| 1 | Intake Agent | **Laura's hands** | The aha moment. The full stack in one vertical. |
| 2 | The Room v2 | **Laura's hands** | The spine's home surface. Presence, not just pixels. |
| 3 | Arrival as chapter v2 | **Laura's hands** | Emotional peak of the spine. Hands-only signal. |
| 4 | Enrichment Agent | Gates only | Backend + contributor UI. No collector-facing surface on its own. |
| 5 | Documents as evidence v1 | **Laura's hands** | Tactile feel; gestures; register of the CoA surface. |
| 6 | Deep Zoom collection-wide | Gates only | Primitive uplift on an existing surface. |
| 7 | Passkeys auth | Gates only | One-gesture contract; platform-chrome flow; gates cover it. |
| 8 | Verification request flow | **Laura's hands** | Voice + viral gesture + cross-channel share sheet. |
| 9 | PANG Voice v1 wire-up | Gates only | String audit + prompt seed; A4/A5 cover it. |
| 10 | Narrative Agent — monthly reading | **Laura's hands** | Does the paragraph feel like the room, or like a chatbot? |
| 11 | Spatial audio + haptics | Gates only | Opt-in, doctrine-constrained; gate ensures off-by-default. |
| 12 | Verify-for-club (conditional) | **Laura's hands** if built | Signal-dependent; only if iterations 1–10 warrant it. |

**The six hands-on iterations (1, 2, 3, 5, 8, 10) carry the spine.**
The other seven are gates-only because they either (a) plumb
infrastructure with no experiential surface, (b) uplift an existing
surface behind an already-shipped experience, or (c) are
mechanical / doctrine-constrained such that Laura's feedback adds
no signal the gates haven't already captured.

Between hands-on iterations, you (Tobias) run the end-to-end walk
from `PANG_Spine.md` § *Operating rules* #4: open link → install →
room → approach work → detail → paint → document → back → scan →
arrival → new work in room. If the walk breaks on a gates-only
iteration, that iteration re-opens with a hands-on close.

---

## Kickoff brief template

Every iteration opens with this brief — written before code, in a
clean context, read aloud to sanity-check it.

```
Iteration #N — {name}

Scope:      ceiling | principle (+ named reason if principle)
Stack:      {specific technologies, not capability descriptions}
Reference:  {at least one implementation, linked or catalogued in Primitives}
Canvas:     {DOM | <canvas> | Web Worker | server | hybrid (declare split)}

Spine moment advanced: {quote from PANG_Spine.md}
Cross-cutting layers touched: {voice | time | provenance | gestures | trust}
Gates this iteration must pass: {list from PANG_Gates.md}

Test criteria (Laura):
  1. {observable behavior}
  2. {observable behavior}
  3. {unprompted return condition if applicable}

Pre-existing work this depends on:
  - {iteration # or archived artifact}

Out of scope (explicit):
  - {items someone might expect but we're not doing this round}

Outcome gate: Codify / iterate once / drop.
```

---

## Iteration #0 — PWA reset

**Status:** in progress (2026-04-21).

**Why this exists:** the previous build was a Next.js + Capacitor
hybrid aiming for iOS and Android shells. The PWA pivot (see
`CLAUDE.md` § 2) invalidates the shell. This iteration is the
mechanical cleanup + 2026 foundation. No aha. No UI. The reward is
that iteration #1 starts on solid ground.

**Scope:** principle. Explicitly infrastructural — the test isn't
"does Laura feel something"; the test is "does `/healthz` pass gates
P1–P10 and does `npm run build` emit a valid installable PWA."

**Stack:**
- Next.js 16 (Turbopack)
- React 19 (Server Components default)
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Tailwind v4 with OKLCH tokens and `light-dark()`
- Workbox 7 service worker with Navigation Preload enabled
- `manifest.webmanifest` with `display: standalone`, icon set
  (maskable), `share_target`, `shortcuts`
- OPFS bootstrap module (`src/lib/storage/bootstrap.ts`)
- Supabase client, `@tanstack/query`, Zustand

**Reference:**
- Next.js 16 docs § *Progressive Web Apps*
- Chrome DevRel *PWA Checklist* (for P1–P10 mapping)
- web.dev *App-like PWAs with the File System Access API* (for OPFS
  pattern)

**Canvas:** DOM only (no art surface this round).

**Gates this iteration must pass:** P1–P10 (installability, service
worker, offline shell, OPFS, manifest, icons, CSP, HTTPS + HSTS, CLS
budget, LCP budget) + **P23** (accessibility floor — lands at the
foundation, not retrofitted later). No AI gates (no AI code this
round).

**Test criteria:**
1. Fresh device: tap invite link → PWA installs to home screen → cold
   launch renders an empty shell in < 1.5s (LCP).
2. Airplane mode: relaunch shows empty shell, not browser error.
3. Lighthouse PWA audit: 100/100.
4. `npm run check:gates` CI passes all of P1–P10.

**Pre-existing work this depends on:** none. Old `pang/` prototype
archived.

**Out of scope (explicit):**
- No camera (iteration #1)
- No Claude calls (iteration #1)
- No wall / Room rendering (iteration #2)
- No auth (iteration #7)
- No push subscription registration (iteration #8)

**Outcome gate:** codify. (This iteration is infrastructural; there
is no "drop" option — the alternative is that we don't ship at all.)

---

## Iteration #1 — Intake Agent (Option B)

**Status:** queued, to open immediately after #0.

**Why this is first:** the Intake Agent exercises every P-gate and
every A-gate in one vertical slice. It is the canonical wow moment.
It is the moment Laura goes from "I opened a link" to "my first work
just hung itself on my wall." Intake lands at the full 48-gate
ceiling.

**Scope:** ceiling. No "we'll add X later." No "we'll ship a form
first." The agent is Claude Vision + structured output + CaMeL on
document-sourced content + OTel spans + confidence UI + TUS-style
resumable upload queue + OPFS staging + View Transitions to arrival.

**Stack:**
- Next.js 16 API Route (Edge runtime where possible)
- `@anthropic-ai/sdk` ≥ latest 2026 release
- Claude Sonnet 4.6 for Vision (primary); Haiku 4.6 for classification
- Structured output (tool use with JSON schema) + Zod runtime
  validation
- CaMeL dual-LLM pattern (P-LLM orchestrates, Q-LLM reads untrusted
  document content)
- OpenTelemetry GenAI semantic conventions (`gen_ai.*` spans)
- `navigator.mediaDevices.getUserMedia` with `ImageCapture` for
  focus + torch
- OpenCV.js 4.10 in a dedicated Web Worker for rectangle detection
- OPFS for the upload queue (TUS-resumable staging)
- View Transitions API (cross-doc) for viewfinder → arrival
- Motion One for the spring curves (not Framer Motion)

**Reference:**
- Apple Vision framework demos (for rectangle tracking feel)
- Granola app (for the gray-AI / black-user confidence pattern in
  the review screen)
- Cursor / Claude Code diff UI (for the one-tap accept/amend model on
  the review screen)
- Stripe *TUS resumable uploads* (for the queue semantics)
- Anthropic cookbook *Structured outputs with tool use*

**Canvas:** hybrid. Viewfinder overlay on `<canvas>` (corners,
brackets, sweep); review screen in DOM (React); arrival chapter on
`<canvas>` (spotlit work, fade-ins, depth). Split declared
explicitly.

**Gates this iteration must pass:** **all 48.** P1–P25 + A1–A23.
See `PANG_Gates.md`. P25 (zero-tap review), A21 (retry policy),
A22 (eval corpus), A23 (cost cap) all land in this iteration
alongside the Intake Agent — no agent ships without them.

**Test criteria:**
1. Laura taps the "+" button on the (empty) wall. Camera opens
   within 300ms.
2. She holds a work in frame. Rectangle tracks at ≥ 15 Hz with
   smoothing. Auto-capture fires within 700ms of stability.
3. The rectified rectangle POSTs to Claude Vision. Review screen
   shows the same rectangle, same pixels. No gap.
4. Fields reveal progressively. Artist bio passes Muji register
   (no banned vocabulary). Ownership-count is correct.
5. She taps *Add to wall.* View Transition runs. Arrival chapter
   plays. The work hangs itself.
6. Offline mid-capture: the job stays in OPFS; when she comes back
   online, it resumes without a re-scan.
7. An adversarial document (PDF with hidden instructions) cannot
   escape the Q-LLM and reach the P-LLM.
8. OTel trace shows `gen_ai.operation.name`, token counts, latency,
   and the Q-LLM / P-LLM split as separate spans.
9. `npm run check:gates` passes all 48.

**Pre-existing work this depends on:**
- Iteration #0 (PWA foundation).
- `PANG_VOICE_SYSTEM_PROMPT` authored in `src/ai/prompts/voice.ts`
  (this iteration ships the first version).

**Out of scope (explicit):**
- The Room rendering (iteration #2) — arrival for this iteration
  lands on a placeholder "wall" (single-column stack) that #2
  replaces.
- Enrichment / provenance images (iteration #4).
- Verification request flow (iteration #8).
- Deep Zoom (iteration #6).
- Passkeys (iteration #7); this iteration uses a one-time anonymous
  session tied to the gallery invite JWT.

**Outcome gate:** codify (update `PANG_Spine.md` cross-cutting
layer § *Voice*, `PANG_Primitives_2026.md` if new primitives emerge,
`PANG_AI_Era_2026.md` § *Intake Agent* lessons), or iterate once
(max), or drop and re-plan. No third round.

---

## Iteration #1 — findings (2026-04-22)

Tested on Tobias's machine (MacBook Air, Chrome) over a Cloudflare
quick tunnel, and on a Google Pixel 10 Pro (Chrome, Android 16).

### What landed

- **Desktop end-to-end works.** Camera → capture → /api/intake →
  review → arrival, all in voice register. The Intake Agent
  produced the null-case arrival line:
  *"A blank sheet of paper, held to the light — no image, no
  inscription, nothing yet to read."*
  That sentence is the proof-of-ceiling for iteration #1. It
  passes the Museumsschild test on its own terms — no apology, no
  evaluative vocabulary, no software register, no emoji, sentence
  case, and it *described what was literally there* instead of
  reporting an identification failure. This is the voice doctrine
  landing under its own steam, without human touch-up.
- **Gate set green.** 20/20 gates pass in strict mode
  (P1–P10, P23, P24 + A1–A4, A7, A8, A16, A21) after the three
  scaffold fixes below.
- **Three scaffold patches required during the test session** —
  each was a 2018-regression that only hardware exposed:
  1. **CSP in dev.** `script-src 'self' 'strict-dynamic'` blocked
     every Next.js 16 inline bootstrap script. `'strict-dynamic'`
     also *overrides* any appended `'unsafe-inline'` per CSP3
     spec, so the fix drops `'strict-dynamic'` in dev entirely
     and keeps it in production. Doc-line update needed in
     `PANG_Architecture_2026.md` § *Headers* to name the dev/prod
     branch explicitly so this isn't rediscovered.
  2. **Viewfinder effect dep `[props]` → `[]`.** The camera stream
     was being torn down and reopened on every parent render. A
     `cancelled` latch handles strict-mode double-invocation; the
     dep array should be empty. `onError` stashed in a ref with
     the new React refs-in-render lint rule.
  3. **`@font-face` fallback.** `next/font/local` hard-fails the
     build when the licensed .woff2 is missing. Replaced with a
     CSS `@font-face` declaration so the scaffold builds on a
     fresh clone and falls back silently to the serif stack.

### What Laura's hands exposed

Ordered by severity / centrality to spine:

1. **Mobile scan has no real scanner support.** The OpenCV.js
   worker at `public/workers/rectangleDetector.js` was never
   shipped — the scaffold relies on auto-capture on rectangle
   stability, so without the worker Laura sees a live camera
   feed and no feedback. A scaffold-only "capture" button was
   added to unblock the test; it is **not** the shipping gesture.
   *Reference (external):* Google Drive scanner on Android —
   live corner brackets, stability cue, auto-capture, perspective
   rectification. That is the register to match.
   → **Iteration #2 scope.**

2. **Rectangles aren't enough. Galerie Droste sells painting,
   photography, sculpture, works on paper, editions, objects —
   non-rectangular works are not the edge case, they are half the
   inventory.** Rectangle detection (OpenCV) is the fast-path for
   flat works; **MediaPipe Image Segmenter** is the fallback for
   everything else. Live silhouette mask → glowing outline →
   hold-still cue → auto-capture → crop to mask. Hybrid worker
   tries rectangle first, falls through to segmentation if no
   quadrilateral stabilises within ~1 second.
   → **Graduates to `PANG_Primitives_2026.md` §15 Scanner.**

3. **Review screen is a form, and that is the thing we said we
   wouldn't build.** Current implementation gates "add to wall"
   on populated fields. The spine is *zero-tap confirm*: Claude
   reads, Laura glances, presses once, arrival plays. Every field
   is optional, always. Unknown-artist works are a legal record —
   a photo + a timestamp is the minimum. Editing is deferred to
   the detail view. The verification line (gallery fills the gaps)
   is the whole reason unverified works are allowed to be sketchy.
   → **Graduates to `PANG_Spine.md` § *The spine*, and a new gate
   P25 asserts no required-field validator in review.**

4. **Null-attribution is the default case, and needs voice-authored
   prose for every null combination.** Emerging-artist works rarely
   match any model's training data. "Unknown artist" can't feel
   like a failure — it has to feel like the natural state of a
   fresh unverified record. Few-shot examples in the P-LLM system
   prompt, keyed on which fields are null:
   - *"A landscape in oil, 2023 — the painter's name is not yet part of the record."*
   - *"A work on canvas, signed in the lower corner in a hand not yet recognised."*
   - *"An object, quietly waiting to be named."*
   - *"The signature reads 'M. S.' — the full name is somewhere the gallery may know."*
   Each line implies the verification line without naming it.
   → **Graduates to `PANG_Voice.md` § *Null-attribution prose*
   (new section), with ~16 canonical lines covering the 2^4
   field-null combinations.**

5. **Failure states use hand-authored strings; they need the same
   voice register as arrival.** "could not read the work" passes
   the Museumsschild test by the letter, not the spirit. System
   failures (network, camera permission, upload refused) can't
   route through the P-LLM (the P-LLM is what failed), so a
   curated set of voice-authored lines lives in the voice corpus:
   - *"The frame returned nothing readable. The light, perhaps, or the angle."*
   - *"The record did not arrive. The work waits."*
   - *"A signal was lost between the camera and the page."*
   → **Graduates to `PANG_Voice.md` § *Failure prose* (new
   section).**

6. **`NotReadableError` shows the Next.js dev overlay, not a voice
   line.** Camera resource contention is a user-visible failure
   mode that must surface through #5 above, not through dev chrome.
   Implementation fix — camera errors caught in Viewfinder become
   a voice-line `failed` state with a gentle retry affordance.
   → **Iteration #2 scope.**

7. **Mobile scan→review→arrival pipeline did not complete.** On the
   Pixel, capture either hung or didn't route to review. Desktop
   ran clean; mobile didn't. Suspected: contested camera resource
   during strict-mode double-invocation, or a mobile-specific
   `OffscreenCanvas.convertToBlob` path that stalls.
   → **Iteration #2 scope.**

8. **Mobile button layout regression.** "capture" (center) and
   "torch on/off" (right) overlap on narrow viewports. Pure
   layout.
   → **Iteration #2 scope.**

### Codify / iterate once / drop

- **Codify** (graduates to keeper docs):
  - §2 scanner segmentation → `PANG_Primitives_2026.md`
  - §3 zero-friction review + new gate P25 → `PANG_Spine.md`,
    `PANG_Gates.md`
  - §4 null-attribution prose → `PANG_Voice.md`
  - §5 failure prose → `PANG_Voice.md`
  - CSP dev-branch rationale → `PANG_Architecture_2026.md`
- **Iterate once** (scaffold fixes re-land in iteration #2):
  - §1 worker + auto-capture
  - §6 camera errors → voice line
  - §7 mobile pipeline completion
  - §8 mobile button layout
- **Drop**: nothing dropped from spine. The iteration #1 ceiling
  remains the iteration #1 ceiling; the gaps are in the delivery,
  not the target.

### What this tightens

- Adds gate **P25 — review is zero-tap**: no required-field
  validator; "add to wall" enabled at mount.
- Adds the scanner-segmentation expectation to Primitive §15,
  replacing "rectangle detection" as the sole ceiling.
- Adds two new sections to `PANG_Voice.md`: null-attribution
  prose and failure prose.
- Adds one sentence to `PANG_Architecture_2026.md` documenting
  the dev/prod CSP branch and why `'strict-dynamic'` is absent
  in dev.

The keeper-doc edits land in follow-up commits, each one narrow.

---

## Iterations #2–#12

Each opens with its own kickoff brief at the time it begins. Names
and scopes are pre-declared in `PANG_Spine.md` § *Build order*. The
briefs will live here, below this line, as each iteration opens.

(Briefs below this line are appended only as each iteration opens.
Do not pre-write them; the ceiling of iteration N+1 is partly shaped
by what iteration N taught us.)

---

## Iteration #2 — The Room (opened 2026-04-22)

**Status:** step 1 (canvas + scene + capability) landed and
smoke-tested; step 2 (camera + gesture + time-of-day) landed and
smoke-tested the same day. Still open: real wall layout wired to
the works store, DOM twin + a11y, canvas-DOM focus handoff, and
integration into the arrival chapter produced by iteration #1.

**Why now:** iteration #1 leaves the arrival moment landing on a
single-column placeholder. The spine's promise — "I walked into a
collection, not an app" — doesn't survive that placeholder. The
Room is the primary art surface; everything after it adapts around
it. It must exist before the next vertical slice.

**Scope:** ceiling. A WebGPU-primary room with WebGL2 fallback and
a DOM-twin "none" branch; a palette- and lighting-conscious scene
graph; one-pointer gestures that feel like a hand on the wall; a
tap that glides the camera to the work and returns to centre; a
time-of-day knob that reads as a soft dusk shift, not a filter.

**Stack:**
- Three.js r170, unified on `three/webgpu` for renderer and scene
  (the classic `three` entrypoint is out of bounds — see §
  *Three.js import unification* below).
- `WebGPURenderer` for tier A; `WebGPURenderer({ forceWebGL: true })`
  for tier B (keeps node-lighting class identity consistent — see
  the unification note below).
- Capability detection: WebGPU adapter probe with a 500 ms race
  timeout; WebGL2 context probe on a detached canvas; else `"none"`.
- Gestures: `PointerEvent` with `setPointerCapture` wrapped in
  try/catch; `touch-action: none` to prevent browser swipe
  navigation from stealing pans; single-pointer semantics
  (multi-touch deferred).
- Animator: exponential smoothing `alpha = 1 - exp(-rate * dt)`,
  `rate = 6.0`. No Framer spring, no momentum.
- Tap: `Raycaster` intersecting only work meshes (never the walls,
  floor, or ceiling); empty-space hit → `null` → focus clears.
- Scene palette: hex constants with OKLCH origin comments. The
  OKLCH → sRGB conversion is a one-way handshake at the
  TypeScript boundary (P11 only scans CSS).
- Time-of-day: CSS custom property `--knob-time-warmth` (0..1) read
  once on mount; lights are two presets (`day` / `dusk`) cross-faded
  by the knob.

**Reference:**
- Granola confidence glide (for "one soft settle, no bounce" —
  the rate-6 exponential is the direct answer; springs bounce).
- Bruno Simon's 3D portfolios (for the idea that a 3D surface
  should feel like a room you're in, not a slideshow you watch).
- Apple Photo Memories at dusk (for the time-of-day palette shift
  reading as light changing in a room, not a filter on a photo).
- Arc Browser's palette variables (for the OKLCH-first discipline
  with sRGB as a one-way handshake).

**Canvas:** `<canvas>` for the room itself (P9). The HUD on the
smoke route is DOM for legibility; in the real surface, sidecar UI
(tweaks menu, connection state, verification chips) overlays in
DOM. The DOM twin for tier `"none"` mounts separately and will
ship in step 3.

**Gates this iteration must pass:** the same 48. No new gates
introduced; every primitive here was already covered. The
three/webgpu unification is not a gate — it's a stack rule (see §
*Three.js import unification* below).

**Test criteria (step 2):**
1. Scene mounts in /room-smoke at tier `"gpu"` with all three stub
   works visible on the back wall.
2. A single-finger horizontal drag pans the camera along the
   wall; clamped by `WALL_CLEARANCE` (1.2 m) so the frustum can't
   skim behind the architecture.
3. Tap on a work glides the camera to stand 1.5 m in front of it,
   gaze level on the work centre.
4. Tap on empty space (ceiling, back wall, floor) returns the
   camera to the wall-panned default pose.
5. First motion past 8 px during a drag clears any active focus —
   the wall-pan resumes from the *displayed* camera, not the
   pre-focus centre.
6. Time-of-day knob at 0 reads as dusk (cooler light, lower
   intensity); at 1 reads as gallery day.
7. `npm run typecheck && npm run lint && npm run check:gates &&
   npm test && npm run build` — all clean.

**Pre-existing work this depends on:** none beyond iteration #0
(tokens, CSP, build chain) and the shared types in
`src/room/types.ts` introduced at step 1.

**Out of scope (explicit):**
- Multi-touch (pinch, two-finger pan for elevation) — deferred to
  a later iteration when the gesture grammar is fully mapped.
- Momentum / inertia on the wall-pan — explicit "no" per the
  Granola-glide reference. The camera stops when the finger
  stops.
- DOM twin for tier `"none"` — step 3 of this iteration.
- Arrival-chapter integration — step 4 of this iteration.
- Real wall layout from the works store — currently stubbed with
  three hard-coded works. Step 5 wires the works-store diff
  effect into `addWork` / `removeWork`.
- A Tweaks menu surface (the time-of-day knob exists but isn't
  surfaced to Laura yet).

**Outcome gate:** codify, or iterate once (max), or drop and
re-plan. No third round.

---

## Iteration #2 — findings, step 2 (2026-04-22)

Smoke-tested in Chrome via the preview harness. Synthetic
`PointerEvent` sequences exercised pan, tap-to-focus,
empty-tap-to-clear, and drag-clears-focus — all four paths
mutated the right state and the camera animator converged on the
right pose each time.

### What landed

- **Three.js node-lighting pipeline rendered correctly** only
  after unifying on `three/webgpu`. The classic `three` entrypoint
  and `three/webgpu` ship separate class instances of `Scene`,
  `Mesh`, `DirectionalLight`, etc., and the node-lighting library
  does *class-identity* lookups. Importing `Scene` from `three`
  while the renderer imports `WebGPURenderer` from `three/webgpu`
  produces a silent "no lights" render (or a
  `LightsNode.setupNodeLights: Light node not found` warning if
  you're lucky). Unifying every file on `three/webgpu` fixes it.
  This is a stack rule, not a bug — see doctrine edit below.
- **Exponential-smoothing animator feels right.** Rate-6 converges
  on the target in ~0.5 s with no bounce and no tail. The Granola
  reference lands. A spring primitive was never wired; there was
  no version of this that needed one.
- **`PointerEvent` + `setPointerCapture` is the right 2026
  primitive**, but capture can throw under synthetic test events
  and a handful of real-world conditions (pointer withdrawn mid-
  event, stylus rejection). Wrapping `setPointerCapture` in
  try/catch is defensive hardening; the drag still tracks without
  capture, capture just keeps routing the pointer to the canvas
  if the finger slides off. Shipped with try/catch.
- **`touch-action: none` on the canvas** was load-bearing; without
  it, Chrome Android stole horizontal pans for back/forward
  navigation. Declared in the smoke-route canvas className from
  the first draft.
- **FOV bumped from 50° to 60°.** Phone-portrait aspect (~0.44)
  at 50° vertical gave ~23° horizontal, which framed only the
  centre work at the scaffold's original ±1.8 m wall spacing.
  60° reads as a natural standing viewpoint and frames all three
  stub works at the compressed ±1.0 m smoke spacing without
  requiring pan. Real wall spacing (±1.8 m+) relies on the
  gesture pan, which is the ceiling for this step and lands the
  "I can look around the room" feeling.
- **Verified / unverified warmth differential is legible** in the
  scaffold. A 0.08 emissive warm bias on verified works over a
  dark surface read as "alive vs. dormant" without any label or
  legend, even before the works have texture content. This is
  the "unverified works are dormant growth triggers" spine line
  expressed in pixels.

### What we learned

- **The canvas has to commit to a class of device before the
  rest of the stack knows what it is.** Capability detection
  (WebGPU → WebGL2 → none) is the first tick, not a later
  reconcile. Lazy-importing the GPU renderer behind the tier
  check means tier-B devices never pay for the GPU bundle.
- **React is a sidecar to the canvas, not the other way around.**
  The RAF loop lives in a `useEffect` that runs once; `works` is
  intentionally excluded from the dep array because the scene
  mutates in place via `addWork` / `removeWork`. A diff effect
  (step 5) will push works-store deltas into the live scene
  without tearing the GL context down.
- **The animator's internal state must be separate from the
  `PerspectiveCamera`.** Mutating the camera directly from the
  gesture controller would race the RAF loop. Keeping an
  animator state vector and writing the camera once per tick
  keeps the mental model clean and the code testable (`snap()`
  for unit-test seeding).

### Codify / iterate / drop

- **Codify:**
  - Three.js import unification rule → `PANG_Architecture_2026.md`
    § *The Room stack* (addition below).
  - Exponential-smoothing animator (rate-6, dt-clamped) as the
    canonical room-interaction motion primitive →
    `PANG_Primitives_2026.md` § *Motion*.
  - `touch-action: none` on primary art surfaces →
    `PANG_Primitives_2026.md` § *Gesture layer*.
  - `setPointerCapture` in try/catch as a defensive-hardening
    rule for pointer handlers → same section.
  - 60° vertical FOV as the phone-portrait default →
    `PANG_Primitives_2026.md` § *The Room*.
- **Iterate once** (step 3 of this iteration):
  - DOM twin (screen-reader navigable work list) + canvas-DOM
    focus handoff.
  - Works-store diff effect wiring `addWork` / `removeWork`
    into the live scene.
  - Arrival-chapter integration: replace the iteration #1
    single-column placeholder with the Room.
- **Drop:** nothing. The ceiling for step 2 is what we expected
  step 2 to deliver.

### What this tightens

- Adds one paragraph to `PANG_Architecture_2026.md` § *The Room
  stack* documenting the three/webgpu unification rule.
- Adds three lines to `PANG_Primitives_2026.md`: rate-6
  exponential-smoothing animator, `touch-action: none` on
  primary art surfaces, 60° portrait FOV.
- Adds the pointer-capture try/catch as a one-line rule in the
  gesture-layer primitive.

No new gates. No doctrine revisions. No spine moves.

---

## Archived iterations

The pre-reset sprint family (A1–A11, iterations #1–#13 of the old
order) is archived at `_archive/legacy_docs/PANG_Aha_Sprint.md`. A
small set of principles from that family landed and are now encoded
in the keeper docs:

- **Arrival is a placement, not a dismiss.** Encoded in
  `PANG_Spine.md` § *The spine* (arrival paragraph). Originally from
  A1.
- **Every tile leads to paint.** Encoded in `PANG.md` § *Three
  interactions* (scan) and queued as iteration #6. Originally from
  A2.
- **One tap from wall to live camera is sacred.** Encoded in
  `CLAUDE.md` § *The cannot-do list* (no ActionSheet). Originally
  from the 2026-03 scanner work.
- **Sharp corners override platform defaults.** Encoded in
  `PANG_Primitives_2026.md` § *Corners*.
- **Empty-by-default, Laura is the baseline.** Encoded in `PANG.md`
  and `CLAUDE.md`. Marc retired.

Nothing else carries forward. If an archived principle resurfaces as
a question, find its line in a keeper doc or write it in.
