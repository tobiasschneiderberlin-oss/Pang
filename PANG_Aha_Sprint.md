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
| 0 | PWA reset | Infra | Landed | Spine — ability — repeatable gates |
| 1 | Intake Agent | Ceiling | Landed | Camera → arrival in one tap; zero-tap review (P25) |
| 2 | The Room v2 | Ceiling | **Landed (2026-04-23)** | Room as backdrop; OPFS rehydration; RAF perf budget; dev Tweaks |
| 3 | Arrival as chapter v2 | Ceiling | Queued (next) | — |
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

## Iteration #2 — findings, step 3 (2026-04-22)

Step 3 was scoped as three pieces: DOM twin + canvas-DOM focus
handoff, works-store diff into the live scene, and arrival-chapter
integration. Steps 1 and 2 had already landed during the step-2
polish pass (the twin lives at `src/room/dom/RoomDOMTwin.tsx` and
`TheRoomCanvas`'s diff effect wires `addWork`/`removeWork`).
This pass lands the third piece and centralises focus state so
arrival can drive it.

### What landed

- **Focus is now store-owned.** `useWorks` carries `focusedId` and
  `setFocusedId`; `removeEntry` clears focus if the removed id was
  focused. Previously the focused id lived in `TheRoomClient` as
  local React state, which worked for the home route but could
  not be written from outside (e.g. arrival chapter) without
  prop-drilling.
- **`TheRoomCanvas` tolerates pre-mount focus writes.** The
  imperative handle stashes focus requests into `pendingFocusRef`
  when the async mount hasn't wired the gesture state yet; the
  mount path applies the pending value once it has. This removes a
  race where arrival writes focus on its mount and the canvas's
  capability-detect + renderer-init window (~1–2 RAFs) would drop
  the request.
- **Arrival chapter renders the Room behind.** `ArrivalChapter`
  now mounts `TheRoomClient` as its backdrop, adds the new entry
  to the store on mount, and writes focus to the new work's id
  before the captured-still overlay begins its fade. The P-LLM's
  `arrivalLine` sits as a museum caption below the work; "tap to
  return" appears after 1400 ms. On dismiss, the client navigates
  home; focus is preserved, so the home route opens with the
  camera still on the new work. The iteration #1 single-column
  placeholder is gone.
- **`/scan` stops double-writing.** `onArrivalDone` now only
  navigates — the arrival chapter owns the store write. The
  "placement, not dismiss" spine line is literal.
- **`TheRoomClient` moved to `src/room/dom/`.** It was the only
  component still living in `app/_the-room/`; co-locating it with
  the Canvas and DOM twin it composes keeps the Room surface one
  directory deep.

### What this tightens

No new gates. No doctrine revisions. Both mechanics — store-owned
focus and pre-mount focus stashing — are implementation details of
the Primitive §35 "React is the adapter" rule, which already
declares the canvas as the primary surface and React as the
composition around it.

The fourth step of the iteration (RAF perf budget at tier B, the
Tweaks menu, OPFS texture rehydration) was still open at the end
of this pass; the rehydration piece landed in a follow-up pass
the same day (see step 4 notes below).

---

## Iteration #2 — findings, step 4 partial (2026-04-22)

Step 4 was scoped as three pieces: RAF perf budget at tier B,
Tweaks menu, and OPFS texture rehydration. The rehydration piece
landed in this pass. The other two are still open — they are
amplifiers on what works, not floor-level correctness, so they can
follow once Laura has walked the current ceiling.

### What landed — OPFS texture rehydration

- **`src/stores/works.persist.ts`.** A one-way-data mirror of the
  in-memory works store into OPFS:
  - `/works/index.json` — the durable entry list (id, status,
    size). `imageUrl` is intentionally omitted because a `blob:`
    URL does not survive a page load; serialising it would invite
    optimistic reads of a dead URL.
  - `/works/<id>.png` — each entry's rectified bytes.
- **`hydrateWorks()`**. On cold boot, reads the sidecar, reads
  each entry's image bytes, mints a fresh `URL.createObjectURL`
  for each, and returns a ready-to-drop-in entry list. Orphaned
  ids (index says yes, image file missing) are skipped — better
  to show the rest of the wall than to show nothing.
- **`installWorksPersistence()`**. Subscribes to the store. On
  every entry change it writes the index + persists bytes for
  added ids and deletes bytes for removed ids. Returns an
  unsubscribe function; `AppBoot` holds it for the session.
- **`AppBoot` orchestration.** The sequence is: bootstrap OPFS
  (ensures the `/works` directory exists), hydrate entries into
  the store, *then* install the subscription. Running it in that
  order avoids a race where an empty snapshot overwrites the
  sidecar before hydration can populate the store.
- **Failure policy is "non-fatal everywhere."** Every OPFS write
  swallows its own error. A storage blip does not block a
  render; the next mutation gets a fresh write. Iteration #5
  surfaces these into observability.

### What we verified

- Static: 38 tests pass (+17 for `parseDurable`, `parseIndex`,
  `serialiseIndex`, round-trip and malformed-input edges). Lint,
  typecheck, gates (26/26), and production build clean.
- Live (preview harness): seeded a synthetic entry into OPFS,
  reloaded, confirmed the DOM twin renders the hydrated button;
  cleared OPFS, reloaded, confirmed the twin renders the "an
  empty wall" empty state. Focus round-trip still works post-
  rehydration.

### What this tightens

No new gates (P5 OPFS bootstrap and A16 intake queue already
assert the storage surface). No doctrine revisions — rehydration
is the execution of the `works.ts` top-of-file promise that
persistence "is owned by `works.persist.ts`." The updated
works.ts doctrine comment now points at the persist module
instead of saying "later."

### What is still open for step 4

- **RAF perf budget at tier B.** The RAF loop in `TheRoomCanvas`
  has no frame-time metering yet. P7 covers INP + LoAF globally;
  the canvas-specific "degrade pixel ratio if tier B drops below
  budget" rule is not wired.
- **Tweaks menu.** `--knob-time-warmth` is read once on mount;
  the UI that mutates it (and the preference-store subscription
  for live updates) hasn't landed.

Both are amplifiers, not floor-level correctness. Laura can walk
the current ceiling before they need to land.

---

## Iteration #2 — findings, step 4 tail (2026-04-23)

The two amplifiers still open from step 4 landed as a pair. Small
scope, client-side only, no new API surface. Both codify into the
sprint log here and leave the keeper docs untouched — they are
execution of promises the architecture already made, not new
doctrine.

### What landed — RAF perf budget

- **`src/room/perf.ts`.** A pure frame-time budget. Meters each
  frame's dt into a 60-sample ring buffer (~1s at 60fps); when the
  sampled p95 exceeds target (default 22ms = a hair below 50fps
  sustained) the budget signals a DPR step-down. One-way — once
  degraded, stays degraded for the session. Oscillation between
  sharp and soft reads as a bug; a permanent slightly-softer image
  reads as a style.
- **Why p95 and not mean.** A single 500ms frame during tab-switch
  or GC would otherwise trip the degrade on mean. p95 surfaces
  *sustained* pressure without reacting to a one-frame hitch. The
  module also clamps pathological samples at 100ms so one tab-
  switch can't poison the buffer for a full second.
- **Wiring in `TheRoomCanvas.tsx`.** The RAF loop samples
  `frameMs = now - lastT` every tick. On scale change, the budget's
  listener reissues `renderer.resize(currentWidth, currentHeight,
  baseDpr * scale)` — the scene doesn't rebuild, only the
  drawing-buffer size shrinks. A `console.info` logs the degrade
  so it never feels like a bug in the preview harness.
- **Resize observer alignment.** The observer multiplies `baseDpr *
  budget.scale` when canvas dimensions change, so a layout change
  after a degrade doesn't reset the renderer back to full DPR.
- **Tier coverage.** Applies to both `gpu` and `gl2` renderers.
  The gate was described as "tier B" in the step brief because
  that's the path where the degrade is most visible, but the
  mechanism is renderer-agnostic — the mount path doesn't branch.

### What landed — Tweaks menu

- **`src/components/dev/Tweaks.tsx`.** A fixed-position overlay,
  bottom-right, safe-area inset aware. Dev-only — visibility gated
  on `process.env.NODE_ENV === "development"` so Next.js dead-code-
  eliminates the JSX branch in production bundles.
- **Collapsed state.** A 32×32 "T" trigger (well above the P23
  24×24 floor). Chrome radius 2px, hairline border, paper-5
  surface, muted ink. Opens the full panel on tap.
- **Expanded state.** Header reads "TWEAKS" in MONO-CAP. One
  slider: `timeWarmth` (0–1 range, 0.01 step), with `cool — 0.50 —
  warm` sentence-case row beneath. The slider uses the warm-deep
  pigment as its accent (OKLCH through `accent-warm-deep`); the
  thumb sits on the warm end of the rail at value 1.
- **Live subscription.** `TheRoomCanvas.tsx` subscribes to
  `usePreferences(s => s.timeWarmth)` on mount (through
  `subscribeWithSelector`). On change, the scene calls
  `setLightingByWarmth(t)` which lerps day → dusk across the
  ambient + key + fill lights. The dev walk confirmed the rig
  responds at ~60fps while dragging the slider; no hitches.
- **Shipping Tweaks vs dev Tweaks.** This is not the DS Ch. 11
  shipping sheet. That one has preset pickers ("subtle /
  balanced / pronounced"), numeric inputs, and the "what these
  do" explainer voice. Those land when the shipping chrome
  iteration opens. The dev overlay lets us iterate the warmth
  curve against Laura's hands before the shipping UI freezes.

### What we verified

- Static: 48 tests pass (+10 for `createFrameBudget`: steady-state,
  sustained spike, cooldown, floor, no escalation, clamp behaviour,
  multi-listener fan-out, reset). Typecheck clean. Lint clean.
  Gates 26/26 pass. The one voice-check hit in
  `src/ai/prompts/failure.test.ts:30` is a pre-existing false
  positive (the file declares the banned-vocab list for its own
  enforcement test); out-of-scope for this slice.
- Live (preview harness):
  - `T` trigger renders bottom-right on first paint.
  - Click expands to panel with slider, readout, and labels.
  - Driving the slider through the native value setter + input
    event updates the store, the `:root` CSS var, and the scene
    lighting in one frame. Drag from 0.50 to 0.95 visibly warms
    the walls from paper-neutral toward dusk.
  - Click `×` collapses back to the trigger; the warmed state
    persists because it lives in the store, not the panel.
  - Zero console errors across the full round-trip.

### What this tightens

- No new gates. The RAF budget operates inside P7 (INP / LoAF
  already assert frame-time globally); the canvas-specific
  mechanism is the implementation, not a new rule. The Tweaks
  menu is dev-only chrome; it doesn't enter the gate surface.
- No doctrine revisions. `works.ts`'s top-of-file comment already
  said "a future step reads the knob and scales proportionally"
  for the wall-gap case; `TheRoomCanvas.tsx`'s old `readTimeWarmth`
  comment said knob subscriptions land "with the Tweaks menu" —
  which they now have. Comment text in those two files is
  refreshed to reflect the current state.
- `src/room/perf.ts` is testable under Node's test runner because
  it deliberately avoids DOM globals. The module is the prototype
  for future perf budgets (scroll jank, hydration cost, upload
  throughput) — pure value objects with ring-buffered samples and
  subscription fan-out.

### Codify / iterate / drop

- **Codify.** The "one-way degrade" pattern and "p95 over ring
  buffer with clamp" approach are reusable across any metered
  surface. Keeping them in `perf.ts` (not inlined in the canvas)
  makes that reuse mechanical.
- **Codify.** Dev-only overlays under `src/components/dev/`,
  gated on `NODE_ENV === "development"`. This is now the pattern
  for any dev affordance; production bundles stay clean by virtue
  of Next.js's build-time substitution, no runtime flag needed.
- **Iterate once.** The Tweaks overlay currently wires one knob
  (`timeWarmth`). The nine-knob DS surface is the shipping sheet's
  problem, not this overlay's — but the next knob we tune
  (probably `warmthMultiplier` or `wallGap` against a populated
  wall) can land here as a second row with the same shape.
- **Drop.** The earlier speculative "tier-B-only" framing. The
  budget is renderer-agnostic; the step brief's "at tier B"
  wording was about where the *visible effect* shows up, not
  where the mechanism lives.

Iteration #2 is closed. Next iteration opens with its own kickoff
brief — spine's next move is verification request (the one-tap
"ask my gallery" gesture that turns an unverified work's dormancy
into a growth trigger).

---

## Iteration #1 — tail (2026-04-22)

Two items from the §7/§8 "iterate once" list landed alongside the
iteration #2 work, because they were static fixes that didn't need
Laura's hands to confirm and they unblock the next device walk.

### §8 — mobile button layout (Viewfinder)

**What landed.** A manual capture affordance and a relocated torch
control. Both on the WCAG 2.5.8 target floor (44×44 minimum), both
on the SPACING_PX scale, both sharp-cornered per the corners rule.

- **Manual capture**, bottom-centre,
  `bottom-[max(env(safe-area-inset-bottom),1.5rem)]`, 64×64 outer
  ring + 48×48 inner square, flat concentric squares (no circle, no
  radius). The inner square transitions to `var(--warm-deep)` on
  active — the record's sole OKLCH warm accent, used nowhere else
  in the viewfinder. Shares the module-local `capture()` path with
  auto-capture and respects the same `capturingRef` lock, so
  double-firing is not possible.
- **Torch**, top-right,
  `top-[max(env(safe-area-inset-top),1rem)] right-4`, `h-11
  min-w-11` (44×44 floor on the short axis), out of the thumb
  drum-fingers zone. Label stays lowercase.

Why flat concentric squares and not the platform shutter-circle:
the sharp-corners rule in `PANG_Primitives_2026.md` is load-bearing
for the "a collection, not an app" test. A platform-looking
shutter would read "you opened an app." Two concentric squares
read "viewfinder, the work is framed."

### §7 — mobile scan→review→arrival pipeline completion

**What landed.** `app/scan/page.tsx` now fences the `/api/intake`
round-trip with (a) a `navigator.onLine === false` pre-check,
(b) an `AbortController` with a 30-second budget, (c) a `finally`
that clears the timer regardless of branch. Classification:

- `AbortError` → `upload/timeout` ("the record did not arrive. the
  work waits.") — the corpus line the voice doctrine authored for
  this exact shape.
- Anything else the `fetch()` throws → `upload/offline`.
- `response.ok === false` keeps the existing `keyFromUploadStatus`
  mapping (5xx → `agent/unreachable`, 422 → `agent/refused`, 4xx →
  `upload/rejected`).

30 s is the chosen budget because typical intake lands in 6–12 s on
broadband; a stalled pipeline on cellular should surface as a named
failure long before the OS-level socket timeout (minutes) —
otherwise Laura sits with no acknowledgement and the relationship
to the record frays. The value isn't tokenised because it's a
one-site time budget, not a motion or spacing scale.

### Codify / iterate / drop

- **Codify:** none new. Both fixes are executions of rules already
  in the keeper docs (sharp corners, WCAG target, OKLCH accent,
  named failure keys, voice-authored prose).
- **Iterate once:** Laura's next device walk confirms the capture
  affordance reads correctly at 360 px and the timeout line surfaces
  when the record stalls.
- **Drop:** nothing.

Static checks: `typecheck`, `lint`, `test`, and `check:gates`
(P1–P11, P15, P19, P20, P23–P25, A1–A4, A7, A8, A10, A16, A21 —
26/26) all green after both fixes.

---

## Iteration #3 — Arrival as chapter v2 (opened 2026-04-23)

**Status:** landed in a single pass. Kickoff brief, build, and
findings are all in this entry; the preview harness run will happen
when Laura walks the device next.

**Why now:** iteration #1's arrival was a single-breath placement —
fade the still, drop the caption, reveal the Room, done in ~2s. That
was correct for the spine's "placement not dismiss" assertion, but
thin for the spine's "I walked into a collection" promise. The
record gives us certificates, gallery attribution, and artist
context; a two-second fade collapses all of that into one line. A
longer, *authored* arrival — an actual chapter — is the difference
between an app that confirms a scan and a collection that receives
a work. Iteration #3 builds that chapter.

**Scope:** ceiling. A 30–45 s timed choreography composed of named
beats, each with its own entry/hold/exit envelope; a GL "approach"
of the physical work toward its wall standoff driven by a rate-6
exponential; voice-authored narration that rides the approach; an
artifact procession (certificate, invoice, condition report) as
small museum-tag cards that arrive and settle one after another;
gallery attribution read in sentence case with the actual gallery
name; artist context surfaced as an aside when the intake extracted
it; a null-state-as-default path when the record is unverified or
thin; a ready beat that unlocks dismissal with Enter/Space or a
tap; a single `aria-live="polite"` region that speaks exactly the
current beat's line; OTel `chapter.*` instants for every beat
edge, the ready latch, and the dismiss. No v2 polish — no audio,
no haptics, no captured-still transition, no blur transitions
between chapters. Those are iteration #4+ territory.

**Stack:**
- Pure TypeScript state machine under `src/ai/chapter/**`. Module
  layout: `types.ts` (Beat, BeatKind, BeatPayload, ChapterPlan,
  ChapterArtifact), `voice.ts` (the corpus lines this iteration
  needs — `NARRATION`, `ATTRIBUTION`, `CONTEXT`, `NULL_REFLECTION`,
  `READY` — each a static object the P-LLM never re-authors at
  runtime), `plan.ts` (`planChapter(intake, workId, blobUrl)` →
  `ChapterPlan`), `envelope.ts` (`beatEnvelope`, `beatProgress`,
  `arrivalFactor`, `overlayOpacity`), `driver.ts` (`activeBeats`,
  `findBeatByKind`, `isReady`, `diffActiveBeats`,
  `ariaLineForActive`), `otel.ts` (`chapterBeatEnter`,
  `chapterBeatExit`, `chapterReady`, `chapterDismiss` — all
  instants, not spans, because beats overlap), `index.ts`
  (barrel). The machine is deterministic in `tMs` — no `Date.now()`
  inside, no RAF inside. React drives time in; the machine reports
  what's active.
- Rate-6 exponential everywhere. The beat envelope is
  `1 - exp(-6 * (t-start)/fadeInMs)` on the rise, held at 1 during
  the body, and `exp(-6 * (t-bodyEnd)/fadeOutMs)` on the fall.
  `arrivalFactor(placeBeat, tMs)` and `overlayOpacity(placeBeat,
  tMs)` share the same rise so they are *analytically*
  complementary: `arrivalFactor + overlayOpacity ≡ 1` for every
  `tMs >= placeBeat.startMs`. That conservation property is the
  mechanical guarantee that the still never shows through the GL
  approach and vice-versa — both moves ride the same curve.
- GL side: `RoomScene.setWorkArrivalFactor(id, t)`. Verified works
  gain a `0.08 * t` emissive warm bias during approach and
  position.z slides `baseWallZ + WORK_STANDOFF * t` toward the
  viewer. Scratch `THREE.Color` instances on the scene — zero
  per-frame allocation.
- DOM side: slot-based rendering, not beat-keyed. Beats overlap,
  so the DOM is organised into zones (narration line, attribution
  line, context aside, artifact stack, ready prompt); each zone
  claims its owning payload via `pickSlot(active, kind)`. The
  chapter's owning component is `src/components/intake/ArrivalChapter.tsx`;
  artifacts render through `src/components/intake/ArtifactCarrier.tsx`.
- Per-frame state flow: `ArrivalChapter` mounts a RAF loop that
  writes `tMs = performance.now() - startedAt` to React state once
  per frame; `useMemo` derives `activeBeats(plan, tMs)` from the
  plan + tMs; the canvas handle receives the arrival factor through
  `TheRoomClient.setArrivalFactor` (imperative, not a prop) so the
  GL tree doesn't re-render every frame.
- ARIA: a single `aria-live="polite"` sr-only line. `ariaLineForActive`
  picks the rising beat (or falls back to the last active one) and
  emits its line; camera-only and pose-only ticks return null so
  the live region stays silent for those frames.
- Observability: `chapter.beat.enter` / `chapter.beat.exit` fired
  exactly once per id-set edge via `diffActiveBeats` +
  `prevActiveIdsRef`. `chapter.ready` latched by `readyEmittedRef`
  so it fires exactly once. `chapter.dismiss` fires on dismissal
  with the source (`keyboard` | `pointer`).

**Reference:**
- Apple Photo Memories (for "beats compose into a chapter" — named
  envelopes, overlapping legitimately, driven by one clock).
- Granola confidence glide (rate-6 again — one smoothing law
  across camera, chapter, and GL approach means the whole surface
  settles with the same hand).
- Cursor's structured-output discipline (for the P-LLM side: no
  `JSON.parse`, no prose-at-runtime; the machine picks from a
  voice-authored corpus and fills slots).
- Museum exhibition sequencing (for the beat kinds — approach,
  place, narration, artifact procession, attribution, context,
  ready — this is how a hang happens in a real space).

**Canvas:** `<canvas>` for the Room (unchanged from iteration #2);
DOM for chapter chrome, ARIA live region, and artifact carriers
(P9 — containers 0, chrome 2 px). The captured still from the
review route is still part of the transition *into* chapter —
overlayOpacity decays on the same curve that drives the approach —
but the still itself is the existing DOM `<Image>`, not a new GL
surface. A GL-to-GL cross-fade is iteration #4 territory.

**Failure mode (5th declaration):** the chapter surfaces three
kinds of regression — *timing* (beats bunch or gap; total runs
outside 30–45 s band; ready never fires), *choreography* (GL
approach and DOM overlay don't complement each other; still
bleeds through or pops), and *voice* (corpus strings leak
marketing/evaluative vocabulary; ARIA speaks camera-only ticks).
All three must be observable. Timing is covered by
`envelope.test.ts` (27 tests over the envelope and conservation
identity) + `plan.test.ts` (total duration band, non-decreasing
starts, null-state timing). Choreography is covered by the
`arrivalFactor + overlayOpacity ≡ 1` conservation test +
`driver.test.ts`'s `activeBeats` edge-case suite. Voice is covered
by `check:strings` against the whole source tree + `check:eval`
against the intake fixture (A22). `chapter.*` OTel instants mean a
real-device walk leaves a full edge timeline in telemetry without
any extra wiring. A regression that gets past these surfaces
immediately in the telemetry beacon; no "the chapter feels off" —
a specific beat either entered late, never entered, or exited
before its successor entered.

**Gates this iteration must pass:** same 48. P1–P11 (tokens,
corners, OKLCH), P15 (View Transitions capability fallback), P19
(reduced-motion honour — the RAF loop respects
`prefers-reduced-motion` by pinning envelope to the settled
value when set; see note below on the current status of this),
P20 (ARIA live region, single polite region, no aria-hidden leak),
P23 (keyboard dismiss as accessible alternative), P25 (zero-tap
review — arrival is the reviewed record made-scene, no additional
approval tap). A1–A4 (no `JSON.parse`, structured output, schema
at boundary, voice corpus enforced). A5 (banned vocabulary via
`check:strings`). A7 (P-LLM/Q-LLM separation — the P-LLM picked
the corpus slot at intake time; arrival at runtime reads the
record, no fresh prompt). A8 (`Untrusted<T>` only at the boundary;
the chapter consumes an `IntakeOutput` already sanitised). A10
(observability — `chapter.*` instants). A16 (null-state-as-default).
A21 (retry policy — N/A for arrival, which is a read-only surface).
A22 (eval corpus — mock mode in CI, live mode on dispatch).

**Test criteria:**
1. `ChapterPlan` duration lands in [30_000, 45_000] ms for full
   intake and in [28_000, 45_000] ms for null-state intake.
2. Beats in the plan list are non-decreasing in `startMs` (a human
   reading the array sees the timeline).
3. `arrivalFactor(plan, t) + overlayOpacity(plan, t) ≡ 1` for all
   `t >= placeBeat.startMs`, to machine precision.
4. `activeBeats(plan, t)` returns only beats whose envelope > 0 at
   `t`; the set at `t = 0` is empty (approach rise starts from 0);
   `approach` and `narration` overlap in the 2000–3000 ms window.
5. `diffActiveBeats(prev, curr)` reports all currently-active ids
   as entered on the first call; reports nothing on a stable tick;
   reports exactly the id that entered or exited on a transition.
6. `ariaLineForActive` returns the rising beat's line when multiple
   beats are active; returns the text of the last active beat when
   none are rising; returns null for camera-only and pose-only ticks.
7. `isReady(plan, t)` is false before `plan.readyAtMs` and true at
   and after.
8. Voice: `check:strings` finds no marketing or evaluative language
   in the corpus lines or in the chapter components. (The ban-list
   files remain exempt; test-fixture files are exempt because they
   carry real-world proper nouns — see § 2 of the codify list.)
9. Observability: a synthetic run at the preview harness emits
   `chapter.beat.enter` exactly once per beat, `chapter.beat.exit`
   exactly once per beat, `chapter.ready` exactly once, and
   `chapter.dismiss` exactly once with the correct source.
10. `npm run verify` — typecheck, lint, `check:manifest`,
    `check:strings`, `check:gates`, `check:eval` — all clean.

**Pre-existing work this depends on:** iteration #1's intake
record shape (`IntakeOutput`), the captured-still DOM surface in
`ArrivalChapter`, and iteration #2's `TheRoomClient` + canvas
handle. Arrival composes these; it does not rebuild them.

**Out of scope (explicit):**
- Ambient spatial audio on beat transitions (no audio at all this
  iteration; opt-in audio is an open spine question and won't land
  mid-chapter).
- Haptic pulses on ready (same reason — opt-in only, and the
  ready beat is polite, not rewarded).
- A GL-to-GL cross-fade between the captured still and the Room
  (currently: still fades out in DOM on the same curve the GL
  approach rises on; sufficient for v2).
- Per-artifact GL materialisation (artifacts are DOM carriers; a
  GL-rendered certificate card hovering beside the work is a v4
  idea at most).
- Chapter-to-chapter stitching (next chapter's beats don't yet
  hand off to arrival's ready latch — a single-chapter surface
  this iteration).
- Reduced-motion collapsed-beat path. The RAF loop still runs
  when `prefers-reduced-motion: reduce` is set; it clamps the
  envelope to settled but still writes state per frame. A true
  "render once at t = readyAtMs" shortcut is iteration #4
  territory — reduced motion is currently *correct* (nothing moves
  visibly) but not *cheap* (the loop still runs).

**Outcome gate:** codify or iterate once. No third round.

---

## Iteration #3 — findings (2026-04-23)

Landed in one pass, bench-tested against the existing intake
fixtures. Laura's device walk is still outstanding; the preview
harness confirms the timing envelope and the ARIA line is spoken
at every beat edge. The pipeline is green end-to-end.

### What landed

- **A pure-TS state machine under `src/ai/chapter/**`.** Seven
  modules, one responsibility each. `plan.ts` composes the beat
  array from an `IntakeOutput`; `envelope.ts` carries the analytic
  functions (`beatEnvelope`, `beatProgress`, `arrivalFactor`,
  `overlayOpacity`); `driver.ts` exposes `activeBeats`,
  `findBeatByKind`, `isReady`, `diffActiveBeats`, and
  `ariaLineForActive`. The machine takes `tMs` as input and returns
  what's active; it never reads a clock. Makes the whole chapter
  trivially unit-testable and keeps React as the adapter (Primitive
  §35), not the driver.
- **Rate-6 exponential shared across camera, beats, and GL arrival.**
  The same `1 - exp(-6 * dt/T)` rise drives `CameraAnimator`
  (iteration #2), `beatEnvelope` (this iteration), and
  `arrivalFactor` (this iteration). `arrivalFactor + overlayOpacity`
  is analytically ≡ 1 everywhere after `place.startMs` — proved
  in an `envelope.test.ts` conservation test. One curve, one hand.
- **GL arrival factor on `RoomScene`.** `setWorkArrivalFactor(id, t)`
  slides the work's mesh from `baseWallZ` toward the viewer by
  `WORK_STANDOFF * t`, and verified works gain `0.08 * t` emissive
  warmth. Zero per-frame allocation — scratch `THREE.Color`
  instances, reused. The factor is wired through
  `TheRoomCanvas.setArrivalFactor` and `TheRoomClient.setArrivalFactor`
  as an imperative handle so the GL tree never re-renders per
  frame (the canvas handle is the single write point that drives
  gesture state; the arrival factor joins it).
- **`ArtifactCarrier` — the small museum tag beside the work.**
  Sharp-cornered 2 px-border card with a `data-pang-source="ai"`
  marker (AI ink, not collector ink). Takes `envelope` and
  `progress` as props; the chapter drives both. Dumb card — no
  state, no motion primitives of its own; the caller applies
  opacity and a `(1-p) * 8 px` drift so the card *settles*, not
  *pops*. `aria-hidden="true"` because the chapter's live region
  is the announcement channel.
- **`ArrivalChapter` completely rebuilt** around the state machine.
  RAF loop writes `tMs` to React state once per frame; `useMemo`
  derives `activeBeats`; slot pickers (`narrationSlot`,
  `attributionSlot`, `contextSlot`, `artifactSlots`) claim their
  owning payloads from the active set. Beat enter/exit diff fires
  `chapter.beat.*` instants through `prevActiveIdsRef`. The ready
  latch fires `chapter.ready` exactly once via `readyEmittedRef`.
  Keyboard (Enter/Space) and pointer dismiss fire `chapter.dismiss`
  with the source and call `onDone`. Null-state-as-default branch
  renders `NULL_REFLECTION.first` and `.second` as two separate
  lines, at a slower pace (NULL_REFLECTION_MS = 12 000,
  NULL_PAUSE_MS = 5 000) so the chapter lands at ~31 s in the null
  branch — inside the 30–45 s band.
- **ARIA live region.** One sr-only `<LiveLine>` polite region
  keyed on `ariaLineForActive(active)`. Camera-only and pose-only
  ticks return null; the live region goes quiet for those frames
  rather than re-announcing the previous line. P20-compliant.
- **Observability catalogue.** `chapter.beat.enter`,
  `chapter.beat.exit`, `chapter.ready`, `chapter.dismiss` — all
  instants on the `chapter.*` namespace, all with `workId`,
  `beatId` where applicable, and `tMs`. The dismiss event carries
  `source: "keyboard" | "pointer"`. The failure-mode paragraph
  above lives or dies on these being present on every surface
  edge; they are.
- **Test coverage.** 80 chapter-specific tests (27 envelope + 23
  driver + 30 plan). 233 total tests passing across the repo. The
  conservation identity is a property-style test — asserts it for
  a dense grid of `tMs` values and fails loudly if the curves ever
  desync.
- **`npm run verify` clean.** Typecheck, lint, `check:manifest`,
  `check:strings`, `check:gates` (26/26), `check:eval` (100 % on
  the intake fixtures). The eval run is on mock mode in CI and
  lit up live on dispatch (A22).

### What we learned

- **Slot-based rendering beats beat-keyed rendering when beats
  overlap.** A first sketch tried to render one DOM node per beat
  and let React reconcile; it flickered during narration-on-approach
  overlaps because both beats wanted the same layout slot. Splitting
  the DOM into zones (each zone claims the beat of the right kind)
  is the right abstraction — beats compose on the timeline, but the
  surface composes in space.
- **The state machine has to take `tMs` as input, not read a
  clock.** A first draft had `planChapter` start a clock on
  construction; made the machine untestable and coupled it to RAF.
  Shifting to `activeBeats(plan, tMs)` makes every function pure
  and every test seed-able. React drives time in; the machine
  reports what's active. This is the "React is a sidecar to the
  canvas" rule (iteration #2's § *What we learned*) applied to a
  DOM chapter.
- **Conservation-law testing.** `arrivalFactor + overlayOpacity ≡ 1`
  is the kind of property a human would never notice if it
  regressed — the still would just *barely* show through the GL
  approach, nobody would file a bug, it would feel "a little off."
  An analytical identity tested at a dense grid of `tMs` makes the
  regression un-ignorable. Every time two continuous curves are
  supposed to be complementary, the test should be the identity,
  not one side and eyeballing the other.
- **`exactOptionalPropertyTypes` refuses explicit `undefined`.**
  Ran into it building test `Beat` fixtures: `{ ..., payload: undefined }`
  was rejected; had to conditionally omit the field. Strict mode
  is right — "present but undefined" and "absent" are different
  states, and an optional property's semantics is *absent*. Noted
  in the driver-test comment so the next author doesn't re-fight it.
- **Per-frame arrival through imperative handle, not props.**
  Passing `arrivalFactor` as a prop to `TheRoomClient` would
  re-render the canvas tree every frame. Routing through
  `setArrivalFactor` on the imperative handle keeps React
  reconciliation quiet — the store owns focus (low-frequency
  writes), the handle drives per-frame state (high-frequency
  writes). Same split iteration #2 landed for gesture state,
  extended to arrival.
- **Null-state-as-default isn't a branch, it's a first-class
  plan.** `planChapter` returns the null plan when the intake is
  thin; the rest of the pipeline doesn't know. No `if (isNull)`
  scattered through `ArrivalChapter` — just a flag at render time
  (`isNullReflection`) that picks two lines instead of one. Spine
  line "unverified works are dormant growth triggers" stays
  literal: the chapter is *shorter* on reflection but the *same
  shape*.

### Codify / iterate / drop

- **Codify:**
  - Chapter as a pure state machine with `tMs`-in / active-out →
    `PANG_AI_Era_2026.md` § *Chapter primitive* (new subsection).
  - Rate-6 exponential as the canonical timing curve across
    camera, beats, and GL arrival → already in
    `PANG_Primitives_2026.md` § *Motion* from iteration #2;
    extends the entry to note the conservation identity
    (`arrivalFactor + overlayOpacity ≡ 1`) as the test pattern
    for complementary continuous curves.
  - Slot-based DOM rendering for overlapping beats →
    `PANG_Primitives_2026.md` § *Chapter surface* (new subsection).
  - `chapter.*` OTel namespace (beat.enter, beat.exit, ready,
    dismiss with source) as the observability contract for every
    chapter surface → `PANG_Architecture_2026.md` § *Observability*.
  - Test-fixture files exempted from the title-case audit because
    they carry real-world proper nouns as data →
    `scripts/check-strings.ts` comment (landed) and
    `PANG_Gates.md` § *check:strings* (one-line note — the
    exemption is narrow: file ends in `.test.ts` or `.test.tsx`,
    marketing/emoji checks still apply).
- **Iterate once:** Laura's device walk. The device walk will
  confirm (a) the chapter feels like a chapter at a phone's
  narrow portrait, not a desktop timeline collapsed into a
  column, (b) the ARIA line is readable by VoiceOver / TalkBack
  at the cadence the beats intend, (c) the null-state path lands
  as reflective, not as "short on content." A single pass; the
  outcome is codify or drop, no third round.
- **Drop:** nothing. The ceiling for iteration #3 is what
  iteration #3 delivered.

### What this tightens

- Adds one subsection to `PANG_AI_Era_2026.md` for the chapter
  state-machine primitive (pure TS, `tMs` in, active set out).
- Adds one subsection to `PANG_Primitives_2026.md` for slot-based
  chapter DOM; extends the motion entry with the conservation
  identity pattern.
- Adds one line to `PANG_Architecture_2026.md` § *Observability*
  naming the `chapter.*` namespace.
- Adds one line to `PANG_Gates.md` § *check:strings* on the test-
  fixture exemption.

No new gates. No spine moves. No doctrine revisions beyond the
four codified lines above.

Static checks: `npm run verify` clean — typecheck, lint,
`check:manifest`, `check:strings`, `check:gates` (26/26),
`check:eval` (100 %), `npx tsx --test` (233/233 across the repo;
80 chapter-specific).

---

## Iteration #4 — Verification request (opened 2026-04-23)

**Status:** kickoff brief only. No code yet. This entry is the
*plan* phase per `CLAUDE.md` § 9 — execution lands in a fresh
context, and review after that in a third context. The brief is
signed when the five declarations (scope / stack / reference /
canvas / failure mode), gates, test criteria, open questions, and
outcome gate are all present and coherent.

**Why now:** iteration #3 landed the arrival chapter — the record
becomes a scene. That scene ends on an unverified work in the null
state, because verification is a separate act. The spine asserts
that *every unverified work wants a gallery behind it*, and that
*requesting verification is a one-tap gesture*. Iteration #4 is
that tap. Without it, the null state is an aesthetic — with it,
the null state becomes a dormant growth trigger, exactly as the
spine declares it.

The gesture is load-bearing for the business model too. The
gallery's existing relationship with the collector *is* the
acquisition channel (§ 2). The collector never pays; the gallery
pays a small subscription. That flip only works if the gallery
receives a qualified, unprompted verification request from its
own collector. Iteration #4 is the surface that produces that
request.

**Scope:** ceiling. A one-tap "ask my gallery" affordance on any
unverified work, visible from both the Room (focused state) and
the arrival chapter's ready beat; a submitted state named in the
voice ("requested" — sentence case, no badge, no checkmark); an
OPFS-backed request outbox that survives refresh and offline; an
idempotency key so double-taps, refresh races, and retried POSTs
never double-send; a `POST /api/verification/request` endpoint
that accepts the payload, validates it with a Zod schema, and
emits a telemetry span; a Declarative Web Push subscription
offered *at request time only* (never on landing, never on
install — the § 2 doctrine is literal); a confirmation chapter
that plays when the gallery confirms, reusing iteration #3's
chapter state machine with confirmation-specific beats (*the
gallery recognised the work; verified; the warmth rises*); the
corresponding decline chapter, much shorter and reflective, when
the gallery can't confirm; and a full `verification.*` OTel
catalogue covering submit, ack, confirm, decline, timeout, and
push-subscribe outcomes. The server-side delivery to the gallery
is *stubbed* — the endpoint persists the request to a file-system
queue under `.pang/outbox/` and returns a request id. Real
gallery dispatch (SMTP? Dashboard? Slack Connect?) is iteration
#7 territory. Everything on the collector's device lands at the
ceiling.

**Stack:**
- Zod schema `VerificationRequest` in `src/verification/schema.ts`.
  Fields: `requestId` (ULID), `workId`, `galleryIdHint`
  (`galleryOfOrigin.galleryId` when confidence ≥ 0.8, else null),
  `galleryNameHint` (`galleryOfOrigin.galleryName` when present,
  else null), `galleryFreeText` (the collector's edit, when the
  hint is wrong or missing — bounded to 120 chars, `sanitize()`'d
  through the existing CaMeL primitive), `artworkSnapshot`
  (artist / title / year / medium / dimensionsCm — the structured
  record the gallery needs to recognise the work), `photoRef`
  (OPFS-backed image id), `capturedAt` (ISO), `submittedAt`
  (ISO), `version: "v1"`. All fields `readonly`; the schema is
  the wire contract.
- Zustand slice `useVerification` under `src/stores/verification.ts`.
  State per workId: `"none" | "requested" | "confirmed" |
  "declined" | "failed"`, plus the `requestId` and `submittedAt`
  timestamps on the non-`"none"` states. Idempotent on workId —
  calling `requestVerification(workId)` when state is already
  `"requested"` is a no-op. Persistence is OPFS-backed via a new
  `src/stores/verification.persist.ts` mirroring the works
  persistence pattern (index sidecar + per-entry JSON).
- Request outbox under `src/verification/outbox.ts`. OPFS
  directory `verification/outbox/<requestId>.json`. The outbox
  writes first, then the network call fires. Offline? The outbox
  holds the payload; a `window.addEventListener("online", …)`
  replay handler drains. Retry policy per A21: exponential with
  jitter, max 5 attempts, capped at 30 min between tries. The
  policy constant lives in `src/verification/retry.ts` and exports
  `RETRY_POLICY` the A21 gate can find.
- Endpoint `POST /api/verification/request` under
  `app/api/verification/request/route.ts`. Zod-validates the body,
  derives a server-side `receivedAt`, writes to `.pang/outbox/<id>.json`
  (dev) or a KV namespace (prod — deferred; dev outbox suffices
  for iteration #4), emits an OTel span `pang.api.verification.request`,
  and returns `{ requestId, status: "received", receivedAt }`. A8
  applies trivially — the payload is structured, no untrusted prose
  flows to any LLM. A7 applies to the endpoint: no Q-LLM
  invocation, no P-LLM tool call. Pure plumbing.
- Declarative Web Push subscription flow under
  `src/push/subscribe.ts`. `probePushSupport()` + `subscribeForOutcome()`.
  The subscription ask happens *on the request submission's
  success tick*, not on mount, not on app boot. Permission
  denied is a first-class state; the request still submits. VAPID
  key is a build-time constant read from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
  the private side lives server-side in `VAPID_PRIVATE_KEY` (env,
  not checked in). For iteration #4 the server doesn't push —
  the subscription is stored on the request record and iteration
  #7 wires the dispatch.
- Confirmation + decline chapters reuse
  `src/ai/chapter/plan.ts`. New beat kinds: `"confirmation"` and
  `"decline"`. New corpus entries in `src/ai/chapter/voice.ts`:
  `CONFIRMATION` (gallery recognised, warmth rises),
  `DECLINE` (reflective, not apologetic — the work is still the
  work). The GL side extends `RoomScene.setWorkVerified(id, verified)`:
  the emissive warm bias already exists; on confirmation, the
  chapter animates `arrivalFactor`-style warmth rise through a
  rate-6 curve from 0 to 1 over the confirmation beat. Decline is
  silent in GL — no negative animation.
- Observability under `src/ai/chapter/otel.ts` + new
  `src/verification/otel.ts`: `verification.request.submit`,
  `verification.request.ack` (server 2xx), `verification.request.fail`
  (network or schema error, with `reason`),
  `verification.push.subscribe` (granted / denied / unsupported),
  `verification.outbox.enqueue`, `verification.outbox.drain.start`,
  `verification.outbox.drain.complete`,
  `verification.confirmation.received`, `verification.decline.received`.
  All are OTel instants; the request lifecycle is a span with
  `requestId` on every child event.
- CaMeL discipline: the gallery free-text is the only untrusted
  string the collector types into this surface. It goes through
  `sanitize()` before it reaches the schema, and is treated as
  `Untrusted<string>` until the Zod parse validates the bounded
  shape. No Q-LLM, no P-LLM, no model at all in the request path.
  The one LLM involvement is the *confirmation chapter's prose
  slot*, which reuses the voice corpus — no runtime authoring.

**Reference:**
- Granola's "quiet ask" pattern — one button, no marketing
  surround, plain language. The request gesture is a verb, not a
  call-to-action.
- Apple Wallet verification flows — the collector initiates, the
  counterparty confirms, the collector receives a discreet update.
  No "your request is being processed" chatter; the state name
  *is* the surface.
- Stripe's idempotency-key model — the client generates a ULID,
  the server dedupes on it, retries are safe by construction.
- Monzo's "freeze card" gesture — one tap, instant visible state
  change, no confirmation modal. The affordance is the
  confirmation.
- Museum registrar practice — an accession request is a structured
  record with a known receiver, not a broadcast. Each request
  names its gallery; no "to whom it may concern."

**Canvas:** DOM for the ask-affordance (chrome — 2 px border, sharp
corners, sentence case, `data-pang-source="collector"` because the
collector is the author of the intent). DOM for the outbox queue
UI (if any — see open questions). `<canvas>` for the Room stays
unchanged except for the new `setWorkVerified` GL hook. The
confirmation and decline chapters are DOM over the Room canvas
(same composition as arrival, same slot-based primitive). No new
canvas surface.

**Failure mode (5th declaration):** three regression classes must
be observable — *delivery* (request never reaches the server;
outbox fills; drain never fires), *identity* (gallery hint is
wrong, collector edits free-text, request lands with a mismatched
gallery and a human at the gallery has to untangle), and *state*
(collector refreshes mid-request; state flips to `"failed"`;
optimistic UI shows `"requested"` but the record says otherwise).
All three are covered. Delivery: the `verification.outbox.*` OTel
instants emit on every enqueue and every drain attempt; a
regression where the outbox silently accumulates shows up in
telemetry as `enqueue` without a matching `drain.complete`.
Identity: the request payload logs the hint source
(`detectedFrom: "email" | "sms" | "manual"`) and the collector's
edit distance from the hint, so a systematic drift between what
PANG inferred and what the collector actually wrote is visible in
the corpus. State: the OPFS-backed store reconciles on boot — if
the outbox holds a request with no corresponding `"requested"`
entry in the store, the boot path re-submits; if the store holds
a `"requested"` entry with no outbox record, the boot path
downgrades to `"failed"` and the surface re-offers the ask. The
reconcile is observable under `verification.reconcile.*`. A
regression in any of the three classes surfaces in telemetry
without "the request didn't go through" becoming an investigation.

**Gates this iteration must pass:** the 48. Specifically
load-bearing:
- P1–P11 (tokens, corners, OKLCH) — the affordance is chrome, 2 px.
- P5 (OPFS only, no localStorage) — outbox + verification store
  persistence.
- P15 (View Transitions capability fallback) — the request tap
  transitions the work's state chip; the cross-fade respects the
  missing-`startViewTransition` branch.
- P19 (reduced-motion) — confirmation chapter's warmth rise clamps
  to settled under reduced-motion.
- P20 (ARIA) — the ask-button is a proper `<button>`; the state
  chip is an ARIA live region scoped to the focused work.
- P23 (keyboard a11y) — Enter/Space on the ask-button, same as
  the dismiss in iteration #3. Focus ring visible.
- P25 (zero-tap review) — the request fires on one tap. No
  confirmation modal.
- A1–A4 (structured output, schema-at-boundary) — the request
  payload + response schemas are Zod; no `JSON.parse`.
- A5 (banned vocabulary) — confirmation / decline corpus goes
  through `check:strings`.
- A7 (CaMeL capability graph) — the request endpoint declares no
  capabilities; the sanitiser boundary is named.
- A8 (Untrusted<T> at the boundary) — gallery free-text enters as
  `Untrusted<string>`, leaves as `string` after `sanitize()` +
  Zod.
- A10 (observability spans) — `pang.api.verification.request`
  span wraps the endpoint.
- A16 (OPFS-backed queue) — outbox.
- A21 (retry policy) — `RETRY_POLICY` export in
  `src/verification/retry.ts`.
- A22 (eval corpus) — confirmation / decline fixtures added to
  `evals/intake/` no, under a new `evals/verification/` directory.

**Test criteria:**
1. `VerificationRequest` schema parses the full payload and
   rejects missing required fields; rejects `galleryFreeText`
   longer than 120 chars; rejects malformed ULIDs.
2. `useVerification.requestVerification(workId)` is idempotent:
   calling it twice in the same tick submits once and returns the
   same requestId.
3. The outbox writes to OPFS *before* the network call, and the
   store flips to `"requested"` optimistically. A network failure
   downgrades the store to `"failed"` but leaves the outbox entry
   in place for the `online` replay.
4. The `online` replay drains the outbox in FIFO order, stops on
   the first failure (to avoid hammering the server), and re-
   schedules per `RETRY_POLICY`.
5. The confirmation chapter plays when a confirmation arrives
   (either via push or via a manual reconcile call). The warmth
   rise hits 1 by the chapter's ready beat. The store flips to
   `"confirmed"`.
6. The decline chapter plays on decline; reflective beats; GL
   warmth stays at 0. The store flips to `"declined"`. The
   ask-affordance does *not* re-appear — decline is a state, not
   a retry prompt (open question #3).
7. Push subscription is offered after submission success; denied
   permission doesn't block the request; the `verification.push.subscribe`
   instant carries the outcome.
8. Boot-time reconcile: populate the outbox with an entry whose
   corresponding store state is `"none"` — boot re-submits and
   flips to `"requested"`. Populate the store with `"requested"`
   and an empty outbox — boot downgrades to `"failed"`.
9. `check:strings` finds no marketing / evaluative vocabulary in
   the confirmation or decline corpus.
10. `check:eval` (mock mode) passes the confirmation and decline
    fixtures at ≥ 85 %.
11. `npm run verify` — all clean.

**Pre-existing work this depends on:** iteration #1's intake
record (`galleryOfOrigin`, `artwork` shape); iteration #2's Room
(focused state reads `setWorkVerified` from this iteration);
iteration #3's chapter primitive (plan / envelope / driver /
voice / otel reused for confirmation + decline); existing CaMeL
(`wrapUntrusted`, `sanitize`, `trust.ts`, `capabilities.ts`);
existing service worker (push handler already exists at line 154
of `public/sw.js` — iteration #4 adds the subscription flow, not
the handler).

**Open questions** (answered before execution):
1. **Does the one-tap tap carry a "by you" confirmation, or is
   the tap the confirmation?** Proposed answer: the tap *is* the
   confirmation. The button copy reads "ask my gallery" (sentence
   case, voice-authored), and the state flips to "requested"
   immediately. An "are you sure?" modal would violate P25 and
   the spine's one-tap sacred rule.
2. **What happens when the gallery hint is wrong and the
   collector wants to ask a different gallery?** Proposed answer:
   a secondary edit surface — a small "not this gallery?" link
   beside the ask-button that opens an inline text field with the
   hint pre-filled. The field sanitises and length-bounds to 120
   chars. The edit is a pre-submit affordance; post-submit, the
   request is immutable.
3. **Does a decline re-offer the ask?** Proposed answer: no. A
   decline is the gallery's answer; re-asking would be chatter.
   A manual "ask a different gallery" path exists via the edit
   surface (open question #2), but that's a distinct action with
   a distinct state (the old `requestId` is closed, the new one
   opens).
4. **Does the outbox surface a queue UI?** Proposed answer: no
   for iteration #4. The outbox is a mechanism, not a surface.
   If `online` is restored and the drain takes > 2 s, the focused
   work's state chip reads "requesting" briefly; that's the only
   visible signal. A proper "pending sync" surface is iteration
   #5 territory if the telemetry shows the drain needs one.
5. **Does the push subscription expire quietly?** Proposed
   answer: yes. `pushManager.getSubscription()` is checked at
   app boot; a null subscription when the store holds `"requested"`
   entries triggers a re-offer on the next focused interaction
   with one of those entries. No banner, no re-permission popup
   at boot. "Silent between sessions" (§ 7) is literal.
6. **Is the request payload signed?** Proposed answer: no signing
   in iteration #4. The endpoint is HTTPS, the request comes from
   an authenticated session (the invite link's token), and the
   server dedupes on the ULID. Signing adds a key-management
   surface we don't need yet; iteration #7 (real gallery dispatch)
   revisits.

**Out of scope (explicit):**
- Real gallery dispatch (SMTP / dashboard / Slack Connect). The
  endpoint writes to a local queue and returns. Iteration #7
  builds the dispatch.
- Multi-gallery requests (a work with two provenance chains). The
  schema permits one gallery per request; multi-gallery is a
  different gesture and belongs to a later iteration.
- Bulk request (a collector asking verification for every
  unverified work at once). Explicitly not a thing — each work is
  its own relationship with its own gallery.
- Gallery-initiated verification (the gallery adding a work to
  the collector's wall). Different surface entirely; iteration
  #9 or later.
- Verification revocation / appeal. Decline is final for this
  iteration.
- Analytics dashboards for the gallery. No gallery-facing UI at
  all (§ 7 "no gallery management dashboard" stands).
- Rich push payloads (images, actions). The push notification
  renders title + body only. Iteration #7 may extend.
- Push topic / segmentation. One subscription per device, keyed
  by VAPID public key.

**Outcome gate:** codify or iterate once. No third round. The
codify targets are laid out now (so execution can name what it
will write back, and drop anything the build proves wrong): the
request outbox primitive (`PANG_Architecture_2026.md` § *Data
primitives*), the optimistic-with-reconcile state pattern
(`PANG_Primitives_2026.md` § *State*), the `verification.*` OTel
catalogue (`PANG_Architecture_2026.md` § *Observability*), the
"tap is the confirmation" rule (`PANG_Primitives_2026.md` § *Chrome*),
and the Declarative Web Push subscription-at-request-time rule
(`CLAUDE.md` § *The cannot-do list* — extends the existing "no
push beyond gallery-originated verification outcomes" line with
the subscription timing).

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
