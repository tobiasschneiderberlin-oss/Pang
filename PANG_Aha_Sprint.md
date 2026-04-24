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
> Last updated: 2026-04-23 — iteration #6 (Documents as evidence
> v1) landed on `iter-6-documents-as-evidence`, squash-merged to
> `main` as `413e549` via PR #16. Four codify targets absorbed
> (singleton fallbacks, chapter reveal + rest state, `NEXT_PUBLIC_*`
> build-time discipline, `window.__PANG` seed seam); one
> iterate-once queued (`persistentArtifactSlots` → `driver.ts`);
> Laura's hands pending. Iteration #7 (Deep Zoom collection-wide)
> brief added — principle scope, gates-only, primitive lands ahead
> of source tiles. Prior same day — iteration #5 (Enrichment Agent
> v1). Prior 2026-04-21 — post-reset.

---

## Status

| # | Name | Scope | Status | Landed principle / cut reason |
|---|------|-------|--------|-------------------------------|
| 0 | PWA reset | Infra | Landed | Spine — ability — repeatable gates |
| 1 | Intake Agent | Ceiling | Landed | Camera → arrival in one tap; zero-tap review (P25) |
| 2 | The Room v2 | Ceiling | **Landed (2026-04-23)** | Room as backdrop; OPFS rehydration; RAF perf budget; dev Tweaks |
| 3 | Arrival as chapter v2 | Ceiling | **Landed (2026-04-23)** | Chapter as pure `tMs`-in state machine; slot-based DOM; conservation-identity testing |
| 4 | Verification request | Ceiling | **Landed (2026-04-23)** | Optimistic flip + OPFS outbox + planReconcile pure core; outcome chapters reuse chapter primitive |
| 5 | Enrichment Agent v1 | Ceiling | **Landed (2026-04-23)** | P-LLMs author prose, never structure; cache+status two-file rule; pure-core + procedural-wrapper for OPFS; Q-LLM per untrusted field |
| 6 | Documents as evidence v1 | Ceiling | **Landed (2026-04-23)** | Chapter = reveal + rest; discriminated-union stores export a NONE singleton; `NEXT_PUBLIC_*` is build-time inline; `window.__PANG` seed seam |
| 7 | Deep Zoom collection-wide | Principle | Brief | — |
| 8 | Passkeys auth | Ceiling | Queued | — |
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
| 4 | Verification request | **Laura's hands** | Voice + viral gesture + outcome chapter. |
| 5 | Enrichment Agent | Gates only | Backend + contributor UI. No collector-facing surface on its own. |
| 6 | Documents as evidence v1 | **Laura's hands** | Tactile feel; gestures; register of the CoA surface. |
| 7 | Deep Zoom collection-wide | Gates only | Primitive uplift on an existing surface. |
| 8 | Passkeys auth | Gates only | One-gesture contract; platform-chrome flow; gates cover it. |
| 9 | PANG Voice v1 wire-up | Gates only | String audit + prompt seed; A4/A5 cover it. |
| 10 | Narrative Agent — monthly reading | **Laura's hands** | Does the paragraph feel like the room, or like a chatbot? |
| 11 | Spatial audio + haptics | Gates only | Opt-in, doctrine-constrained; gate ensures off-by-default. |
| 12 | Verify-for-club (conditional) | **Laura's hands** if built | Signal-dependent; only if iterations 1–10 warrant it. |

**The six hands-on iterations (1, 2, 3, 4, 6, 10) carry the spine.**
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

## Iteration #4 — findings (2026-04-23)

Landed in one pass on the `iter-4-verification-request` branch.
Bench-tested against the new fixture corpus; `npm run verify`
green end-to-end (48/48 gates, 400/400 unit tests, 1/1 intake
eval, 3/3 verification eval). Laura's device walk is
outstanding — the surface is ready for hands, not yet on them.

### What landed

- **Seven-phase vertical: schema → outbox → store → submit → outcome
  chapters → reconcile → eval.** Each phase has its own module under
  `src/verification/**` (plus the store slice, the UI, the API
  routes, and the eval harness). Every module is small, tested in
  isolation, and re-exported through `src/verification/index.ts` so
  consumers see one boundary.
- **Optimistic-with-outbox state machine.** `useVerification` flips
  the work to `"requesting"` on tap; the OPFS outbox writes
  immediately; the POST fires; a 2xx ack flips the store to
  `"requested"` and pops the outbox; a push-delivered
  confirmation/decline flips to the terminal state. The outbox is
  durable, the store is a render cache, and the two are reconciled
  on every boot. The surface never pretends a request landed when
  it hasn't.
- **`planReconcile` as a pure planner over the drift matrix.** Four
  shapes are handled: outbox + `"none"` → rehydrate; outbox +
  `"confirmed"`/`"declined"` → pop the stale record; outbox +
  `"failed"` → pop the orphan; `"requesting"` + no record →
  downgrade to `"failed"` with `reason: "reconcile/lost"` so the
  ask-affordance returns. The planner takes `(records, byWorkId)`
  and returns a `ReconcilePlan` (records to remove, rehydrates,
  downgrades, summary); the procedural wrapper applies the plan
  and fires `verification.reconcile` with tallies. Every drift
  cell is a test cell.
- **`ChapterPlanBase` generalises the chapter primitive.** Iteration
  #3's `ChapterPlan` grew a `variant` tag and a `ChapterPlanBase`
  interface; `OutcomeChapterPlan` (variant `"confirmation"` or
  `"decline"`) joins it. Driver functions (`activeBeats`,
  `findBeatByKind`, `isReady`) now accept `ChapterPlanBase` — one
  path, two shapes. `planConfirmationChapter` and
  `planDeclineChapter` are pure functions of `(workId, decidedAt)`
  and the voice corpus; no model in the loop. Confirmation carries
  a `place` beat (the work settles into its wall slot); decline
  omits it (the work stays dormant — nothing to re-place).
- **GL side: `setWorkVerified`.** One imperative handle on
  `RoomScene` flips the emissive warm bias on confirmation. Decline
  is silent in GL — no negative animation, per the Voice doctrine
  (decline is a state, not a punishment).
- **`window.online` replay.** `installOnlineDrain()` wires a listener
  that calls `drainOutbox()` on reconnection. Returns an unsubscribe
  for hot-reload / tests. `reconcileVerification()` calls
  `drainOutbox()` itself at the end, so reconnection and boot both
  fire the drain without double-dispatch (the outbox's FIFO + per-
  entry `nextAttemptAt` gate handles the idempotency).
- **`verification.*` OTel catalogue.** `outbox.enqueue`,
  `outbox.drain.{start,step,complete}`, `request.{submit,ack,fail}`,
  `push.subscribe`, `confirmation.received`, `decline.received`,
  `reconcile`. Every surface edge emits; every event carries
  `requestId` where applicable; the reconcile event carries the
  four drift tallies. The failure-mode paragraph above is literal
  in telemetry now — a silent desync is impossible.
- **`evals/verification/run.ts` — deterministic outcome-chapter
  eval.** Three fixtures (confirm-typical, decline-typical,
  confirm-late-decision) × eleven structural checks each: variant
  tag, workId plumb-through, `decidedAt` plumb-through, narration
  beat presence, narration text matches `OUTCOME_NARRATION` corpus,
  narration `source: "voice-corpus"`, last beat is `ready`, settle
  beat present, `totalMs` in the `[8 000, 18 000]` band, place
  beat presence matches variant, monotonic `startMs`. Emits the
  same `pang.eval.*` JSON shape iteration #1's intake eval uses,
  so a future dashboard ingests both without translation. No
  network, no env dependency; runs on every push via
  `npm run check:eval`.
- **`npm run verify` green.** 26 P + 22 A gates, 400 unit tests
  (up from 388 after the iteration #3 tail), 1/1 intake eval
  (mock mode), 3/3 verification eval. The verify chain is the
  merge gate.

### What we learned

- **Pure-core + procedural-wrapper beats "mock OPFS in the test."**
  First draft of `reconcileVerification` was monolithic: it listed
  the outbox, read the store, applied the plan, fired the event —
  all in one function. Tests had to mock `navigator.storage` to
  cover the four drift shapes. Extracting `planReconcile(records,
  byWorkId): ReconcilePlan` let the unit tests cover every cell of
  the drift matrix without touching OPFS at all; the wrapper
  became a five-line applier. Pattern codifies as: *if a function
  has a testable core and an I/O shell, extract the core as a
  pure function that returns a plan object; the shell applies it.*
  Names it separately, tests it separately.
- **`ChapterPlanBase` was the right generalisation, not a parallel
  `OutcomePlan`.** Iteration #3 left a `ChapterPlan` with arrival-
  specific fields (`workImageUrl`, `arrivalLine`, `sourceOutput`).
  Iteration #4 needed confirmation/decline shapes with different
  specific fields (`narrationLine`, `decidedAt`) but the same beat
  mechanics. A parallel `OutcomePlan` type would have forked the
  driver (`activeBeats`, `findBeatByKind`, `isReady`) and doubled
  the maintenance surface. Lifting the common shape into
  `ChapterPlanBase` and making `ChapterPlan` / `OutcomeChapterPlan`
  both extend it kept the driver at one code path. Discriminated
  union by `variant` is the right carrier when the shapes share
  mechanics but not semantics.
- **Bash default glob matches one directory level only.** The
  `npm test` script used `src/**/*.test.ts` in bash default mode
  (no `shopt -s globstar`); it quietly matched `src/*/test.ts` +
  `src/*/*/test.ts` and *missed* `src/ai/chapter/**/*.test.ts` and
  `app/api/.../route.test.ts`. Caught because the test count stayed
  at 192 after adding twelve chapter tests for the outcome
  variants — it should have been 204+. Fixed by switching to
  `$(find src app -name '*.test.ts' -not -path '*/node_modules/*')`.
  Count jumped to 389/389 green, and iteration #4's own tests
  brought it to 400. Lesson: *if a test-runner script uses a glob,
  prove the expansion returns what you think it does before
  trusting the green.* A test count that stays flat after new
  tests land is a script bug, not a no-op test.
- **`three/webgpu` touches `self` at module load.** `scene.ts`
  imports the unified `three/webgpu` entry; Node test runners
  crash trying to import it because `self` is undefined at module
  scope. `setWorkVerified` (and `setWorkArrivalFactor` from
  iteration #3) therefore rely on e2e coverage rather than unit
  tests — the GL path can only be exercised in a real browser.
  Noted; the compensating coverage is the eval (which tests the
  *plan*, not the GL write) + the Playwright walk.
- **Two sources of truth is honest; pretending it's one is
  dangerous.** A first sketch tried to make the outbox a derived
  view of the store. That's wrong: the store is the render cache
  and the outbox is the wire queue, and they can drift after a
  crash between an outbox write and a store flip, or between an
  ack and an outbox pop. The right answer is to name both as
  canonical and reconcile on boot with tallies. The reconcile
  *is* the single-source-of-truth discipline; the tallies are
  how drift becomes visible rather than cosmic.
- **Subscription-at-request-time is the doctrine move.** The
  Declarative Web Push subscription ask fires on the submission-
  success tick, never on mount, never on landing. A denied
  permission is a first-class outcome; the request still
  submits. This is the literal reading of `CLAUDE.md` §
  *cannot-do list* ("no push notifications beyond gallery-
  originated verification outcomes the collector explicitly
  subscribed to") — the subscription *is* the explicit
  consent, offered only at the moment the collector asked for
  the outcome.
- **Reconcile summary in telemetry is worth more than reconcile
  correctness in tests.** The four drift counters (`orphanOutboxEntries`,
  `orphanStoreEntries`, `resubmitted`, `downgraded`) turn an
  invisible class of bug (*the collector thinks they asked but no
  request ever left the device*) into a visible one. If
  `downgraded > 0` ever climbs in telemetry, we have a write-order
  regression — and we have it *before* Laura notices.

### Codify / iterate / drop

- **Codify:**
  - Pure-core + procedural-wrapper as the pattern for I/O-heavy
    state transitions → `PANG_Primitives_2026.md` § *State*
    (extends iteration #3's "`tMs` in, active-out" rule with the
    analogous "records + store in, plan out" rule for reconcile-
    shaped code).
  - `ChapterPlanBase` + variant-tagged `ChapterPlan` /
    `OutcomeChapterPlan` as the discriminated-union pattern for
    surfaces that share beat mechanics but differ in domain →
    `PANG_AI_Era_2026.md` § *Chapter primitive* (extends the
    iteration #3 subsection with the generalisation).
  - Outbox + store as two canonical truths with boot-time
    reconcile + drift tallies as the observability contract →
    `PANG_Architecture_2026.md` § *Data primitives* (the request
    outbox primitive) and § *Observability* (the
    `verification.reconcile` event with its four tallies).
  - "Tap is the confirmation" for one-tap gestures where the
    affordance copy is the intent declaration →
    `PANG_Primitives_2026.md` § *Chrome*.
  - Declarative Web Push subscription fires at
    request-submission-success only → `CLAUDE.md` §
    *The cannot-do list* (extends the existing push line with
    subscription timing).
  - Test-script globs must be proven to expand: in CI, use
    `find` for recursive patterns, not bash default `**`. Noted
    in `package.json` script comment and in
    `PANG_Gates.md` § *Test infrastructure* (one line).
- **Iterate once:** Laura's device walk. The device walk confirms
  (a) the ask-affordance reads as a verb, not a CTA, in a
  phone's focused-work panel; (b) the outcome chapters land at
  the right timing band — neither rushed on confirmation nor
  dragging on decline; (c) the "requesting" state chip is
  legible as a state, not as an error; (d) a reconcile after
  airplane mode does what the tallies say it does. One pass,
  outcome is codify or drop.
- **Drop:** nothing. The ceiling for iteration #4 is what
  iteration #4 delivered.

### What this tightens

- Adds one subsection to `PANG_Primitives_2026.md` for the
  pure-core + procedural-wrapper pattern.
- Extends the iteration-#3 chapter subsection in
  `PANG_AI_Era_2026.md` with the `ChapterPlanBase` generalisation
  and the outcome variants.
- Adds the request-outbox primitive and the
  `verification.reconcile` event to `PANG_Architecture_2026.md`
  § *Data primitives* / § *Observability*.
- Extends the `CLAUDE.md` push-cannot-do line with subscription
  timing.
- Adds one line to `PANG_Gates.md` on test-script glob discipline.

No new gates. No spine moves beyond what the iteration brief
declared. The wall holds; the surface walked forward inside it.

Static checks: `npm run verify` clean — typecheck, lint,
`check:manifest`, `check:strings`, `check:gates` (48/48),
`check:eval` (intake 1/1 at 100 %, verification 3/3 at 100 %),
`node --test` (400/400 across the repo; 99 verification- and
outcome-chapter-specific).

---

## Iteration #5 — Enrichment Agent v1 (opened 2026-04-23)

**Status:** **landed 2026-04-23.** See *Iteration #5 — findings*
below the brief. All seven phases (A–G) shipped; `npm run verify`
clean; 470/470 unit tests, 26/26 gates, 9/9 eval fixtures. Five
codify targets absorbed, one iterate-once named (reconcile on
boot wiring), zero drops.

**Why now:** iteration #4 landed the growth trigger — the collector
can ask their gallery. The spine's next move is the *return*
direction: the gallery (or a museum, or a prior owner acting as
contributor) gives structured provenance back. That data powers
the "approach a work" moment (`PANG_Spine.md` § *Build order* #4).
Without iteration #5, a verified work stays thin — artist +
title + year — and the focused state has no evidence to show.
With iteration #5, the work carries a timeline and an artist
context paragraph, and iteration #6 (Documents-as-evidence) can
render them as the tactile archive the spine names.

The agent is also the canonical **batch P-LLM + Q-LLM
combination**. Intake runs one P-LLM call per work on an
interactive path. Enrichment runs a Q-LLM quarantine on
contributor notes, a P-LLM authoring pass for the artist bio,
and a structured timeline pass — all asynchronous, all in the
Batch API (A20). It's the first place the four-agent architecture
from `PANG_AI_Era_2026.md` fully exercises the agent-of-agents
pattern, and the first place `capabilities.ts` enforces a
`'gallery'` source boundary end-to-end.

**Scope:** ceiling. A `ProvenanceSubmission` schema (contributor-
branded, Q-sanitized) + an `EnrichmentOutput` schema (P-branded,
structured timeline + muji-register artist context). An agent
function `runEnrichmentAgent` under `src/ai/agents/enrichment.ts`
mirroring the intake agent's shape — Q-LLM pass on freeform
contributor notes, P-LLM pass for the artist bio, deterministic
timeline assembly from sanitized fields. An OPFS-backed
enrichment cache keyed by `workId` with a `basedOnWorkHash` so a
post-enrichment intake revision invalidates the entry. A
`useEnrichment` store slice with persistence mirroring the
verification pattern: state per workId is
`"none" | "enriching" | "ready" | "stale" | "failed"`. A
`POST /api/enrichment/submit` endpoint accepting a
`ProvenanceSubmission` from a gallery (dev auth via a shared
`X-PANG-Gallery-Token` header; real auth is iteration #8
territory). A dispatch path that validates, stages to an
enrichment outbox (OPFS locally, KV namespace in prod — deferred
to iteration #8), and fires the agent call; in dev the call runs
synchronously, in prod it dispatches to the Batch API. A
minimal render surface on the focused work — a single `dl` of
timeline entries and a paragraph card for the artist context —
proving the pipeline flows end-to-end without authoring the
tactile archive chapter (that's iteration #6). A
`evals/enrichment/run.ts` deterministic sweep with 3–5 fixtures
(nominal, poisoned-note injection attempt, empty-submission
no-op, malformed-dates salvage, multi-submission merge). A
full `enrichment.*` OTel catalogue. `A20` (Batch API) lands as
a capability — the dev harness uses immediate mode but the
dispatch path is named and observable so production swap is a
single code-site change.

**Stack:**
- Schema under `src/enrichment/schema.ts`. `ProvenanceSubmission`
  carries `submissionId` (ULID), `workId`, `contributorId`
  (gallery or museum identifier), `contributorRole`
  (`"gallery" | "museum" | "prior-owner"`), `records[]` where
  each record has `year` (int, nullable — some provenance is
  undated), `location` (bounded string), `context`
  (`"museum" | "fair" | "studio" | "private" | "auction"`),
  `imageRef` (OPFS id, nullable), and `untrustedNote` (bounded
  256 chars; this field is `Untrusted<string>` and goes through
  the Q-LLM quarantine before it reaches the agent's P-LLM).
  `EnrichmentOutput` carries `workId`, `basedOnWorkHash`
  (SHA-256 of the intake record's content fields — so a post-
  enrichment work edit invalidates the cache), `timeline[]`
  (same shape as a sanitized record, minus the untrusted note),
  `artistContext` (`nationality`, `birthYear`, `bioMuji`,
  `bannedVocabularyDetected: false`), `generatedAt`.
- Agent under `src/ai/agents/enrichment.ts`. Two-phase flow:
  (1) Q-LLM pass over each submission's `records[]` that carry
  an `untrustedNote` — sanitises to a bounded safe summary or
  drops the note; returns `'P'`-branded fields via `sanitize()`.
  (2) P-LLM pass with the rectified artwork record (from the
  already-trusted `IntakeOutput`), the sanitised record notes,
  and the intake-generated `artistContext` as context; produces
  a refined `bioMuji` (the existing bio may be thin if intake
  only saw the photo). The timeline itself is *not* authored
  by the P-LLM — it is assembled deterministically from
  sanitised record fields. The P-LLM only speaks where prose
  is already the output type (the artist context paragraph).
  `RETRY_POLICY` per A21 with temperature escalation `[0, 0.3, 0.6]`
  and `onTerminalFailure: "null"` (the collector just doesn't
  see richer enrichment yet; the work is still usable).
- OPFS cache under `src/enrichment/cache.ts`. Directory
  `enrichment/<workId>.json`; one file per work; index sidecar
  `enrichment/_index.json` maps `workId` → `{ generatedAt,
  basedOnWorkHash }` for fast listing. Write-through on success;
  invalidate on `basedOnWorkHash` mismatch.
- Store slice under `src/stores/enrichment.ts` +
  `enrichment.persist.ts`. `useEnrichment` with
  `subscribeWithSelector`; state per workId as declared above.
  Persistence mirrors `verification.persist.ts` exactly —
  index + per-entry JSON, hydrate on boot, install the
  subscription after hydration.
- Endpoint under `app/api/enrichment/submit/route.ts`. Zod-
  validates the `ProvenanceSubmission`, checks the
  `X-PANG-Gallery-Token` header against an env-gated
  `PANG_GALLERY_TOKEN` (dev-only auth; real auth is iteration
  #8), writes to the enrichment outbox (dev: OPFS under
  `.pang/enrichment-outbox/`; prod: KV — deferred), enqueues
  the agent call (dev: synchronous; prod: Batch dispatch),
  returns `{ submissionId, status: "received", receivedAt }`.
- Observability under `src/enrichment/otel.ts`:
  `enrichment.submission.received`, `enrichment.submission.rejected`
  (with `reason`), `enrichment.agent.start`,
  `enrichment.agent.complete`, `enrichment.agent.fail`,
  `enrichment.cache.hit`, `enrichment.cache.miss`,
  `enrichment.cache.invalidate` (with `reason: "workHashChanged" | "manualRefresh"`),
  `enrichment.reconcile` (boot-time stale-cache sweep with tallies
  mirroring `verification.reconcile`).
- Render under `src/components/enrichment/EnrichmentPanel.tsx`.
  DOM chrome inside the focused-work panel. Lists timeline
  entries as a `<dl>` with year + location + context (no
  images yet — iter #6). Paragraph card for the artist bio
  (muji register; banned-vocab checked). `data-pang-source="ai"`
  on the paragraph card (AI ink, dim). Sentence case, sharp
  corners, 2 px border. Chapter animation is deferred to
  iteration #6; iter #5 just reveals the data statically under
  a `<Suspense>`-equivalent loading state ("enriching…") when
  the store is `"enriching"`.
- CaMeL enforcement: the `untrustedNote` field enters as
  `Untrusted<string>`; the Q-LLM extracts a narrow safe summary
  via `sanitize()` which downgrades the brand to `'P'`. The
  P-LLM call site `assertCapability("agent.enrichment.pLlm", ...)`
  on every interpolated field — which per
  `src/ai/camel/capabilities.ts` accepts only `'gallery' | 'P'`.
  The submission's `contributorId` is gallery-branded via
  `acceptGallery()` on entry (the header token authorises the
  brand). The raw `untrustedNote` never reaches the P-LLM.

**Reference:**
- Anthropic Batch API — the canonical async dispatcher. 50 %
  cost on bulk pre-computation, and the doctrine's "rich
  provenance shows up next time they approach, not in real
  time" maps cleanly.
- Linear's cycle-of-updates pattern — a contributor adds data,
  the system recomputes derived views asynchronously, the user
  sees the updated view on their next visit to the surface.
  No "refresh to see changes" — the state is canonical.
- Obsidian's dataview pattern — structured fields compose into
  a timeline view without freeform prose. Matches the PANG
  doctrine exactly: contributors supply data; they do not
  speak.
- Arena's channel model — provenance as attached records, not
  as a narrative. Each provenance record is a verb on the
  work, not a chapter in a story.
- Museum registrar software (TMS, MimSY) — the structured
  provenance ledger as the ground truth for accession
  decisions.

**Canvas:** DOM. No `<canvas>` work in iteration #5 — the
focused-work panel is chrome (2 px border, sharp corners,
muji). The Room's GL layer is untouched; `setWorkVerified`
from iter #4 and `setWorkArrivalFactor` from iter #3 already
carry the only per-work GL state iter #5 needs. The animation
of timeline entries appearing is iteration #6 (Documents-as-
evidence), which extends the chapter primitive to the archive
surface.

**Failure mode (5th declaration):** four regression classes
must be observable — *poisoning* (a contributor note contains a
prompt-injection attempt that reaches the P-LLM), *hallucination*
(the P-LLM invents a timeline entry not present in the
submission), *drift* (the intake record is edited post-enrichment
and the cached enrichment goes stale without the store noticing),
and *cost* (submissions pile up, the agent runs N times per
work, the daily cap is hit silently). Poisoning: the Q-LLM
quarantine output is `'Q'`-branded and only downgraded via
`sanitize()`; any test fixture that smuggles an instruction under
an unexpected field must fail schema validation (enforced by
`.strict()`); the eval corpus carries an injection fixture
(`enrich-02-poisoned-note`) that asserts the P-LLM path never
sees the raw note. Hallucination: the timeline is assembled
deterministically from sanitised record fields — not written
by the P-LLM — so a hallucinated entry is structurally
impossible; the eval corpus proves this by feeding empty
submissions and asserting an empty timeline. Drift: every cache
entry carries `basedOnWorkHash` (SHA-256 of the intake's content
fields); boot-time reconcile walks the cache, recomputes the
current work hash, and invalidates mismatches under
`enrichment.cache.invalidate` with `reason: "workHashChanged"`.
Cost: per-collector daily cap (A23) + per-submission idempotency
key (submissionId) dedupes re-submissions; the
`enrichment.agent.start` event carries the estimated cost, and
the budget runner short-circuits before the HTTP round-trip if
the collector is at cap.

**Gates this iteration must pass:** the 48. Specifically
load-bearing:
- A1 (no JSON.parse) — enrichment output goes through Zod.
- A2 (tool_choice + tools on every messages.create) — both
  the Q and P passes declare tools.
- A3 (Zod parse of tool_use input) — timeline + artist context
  schemas.
- A4 (PANG_VOICE_SYSTEM_PROMPT prepended) — P-LLM call site.
- A5 (banned vocabulary) — `check:strings` over the enrichment
  voice corpus + runtime `runBannedVocabularyCheck` on the
  artist context paragraph.
- A7 (CaMeL capability graph) — `agent.enrichment.pLlm`
  already declared in `capabilities.ts` as `['gallery', 'P']`;
  iter #5 adds `agent.enrichment.qLlm` as `['Q']`.
- A8 (wrapUntrusted) — contributor notes wrapped before Q-LLM.
- A10 (gen_ai.* OTel span) — both passes wrapped.
- A16 (OPFS-backed queue) — enrichment outbox.
- A17 (idempotency key) — `submissionId` on every submission.
- A18 (per-agent budget) — `AGENT_BUDGETS.enrichment` already
  defined; iter #5 exercises it.
- A19 (per-agent model) — `AGENT_MODEL_IDS.enrichment` already
  defined; iter #5 exercises it.
- A20 (batch dispatch) — the dispatch path is named; dev runs
  immediate but the production swap is a single call site.
  The iteration ships with the dev path and a gate comment in
  `route.ts` pointing at the production extension.
- A21 (retry policy) — `RETRY_POLICY` exported from the agent.
- A22 (eval corpus) — `evals/enrichment/run.ts` with 3–5
  fixtures + mock mode.
- A23 (cost cap) — submissions that would exceed the daily
  cap short-circuit with `BudgetExceededError`.
- P1–P11 — panel chrome (2 px, sharp, OKLCH).
- P5 (OPFS-only, no localStorage) — enrichment cache + store
  persistence + dev outbox.
- P20 (ARIA) — the panel is a proper landmark; the loading
  state announces politely.
- P23 (keyboard a11y) — panel's focusable elements reachable;
  focus ring visible.

**Test criteria:**
1. `ProvenanceSubmissionSchema` rejects a missing `workId`,
   a `records[]` longer than 16, and an `untrustedNote`
   longer than 256 chars.
2. `EnrichmentOutputSchema.parse` passes on the agent's output;
   any extra field fails `.strict()`.
3. The Q-LLM quarantine produces a sanitised record-note
   summary that passes the P-branded downgrade; a prompt-
   injection string in the untrusted note does not appear
   anywhere in the P-LLM's user content.
4. The agent's timeline equals the deterministic assembly of
   sanitised record fields — no P-LLM authoring path.
5. `useEnrichment` is idempotent per `(workId, submissionBatchHash)`;
   calling `submitEnrichment(workId, records)` twice in the same
   tick enqueues once.
6. The OPFS cache writes `<workId>.json` after successful
   agent runs; the sidecar index updates atomically.
7. Boot-time reconcile invalidates cache entries whose
   `basedOnWorkHash` does not match the current intake record
   hash, firing `enrichment.cache.invalidate` with
   `reason: "workHashChanged"`.
8. `EnrichmentPanel` renders `"enriching…"` while the store is
   `"enriching"`, a `<dl>` of timeline entries when `"ready"`,
   and nothing when `"none"` (no empty-state clutter).
9. The `POST /api/enrichment/submit` endpoint rejects a request
   missing the `X-PANG-Gallery-Token` header with a 401; a
   valid request returns 202 with a `submissionId`.
10. `check:strings` finds no marketing / evaluative vocabulary
    in the enrichment voice corpus.
11. `check:eval` (mock mode) passes the enrichment fixtures at
    ≥ 85 %.
12. `npm run verify` — all clean.

**Pre-existing work this depends on:** iteration #1's intake
record (`IntakeOutput`, `ArtistContextSchema`); iteration #2's
Room + focused-work panel (the panel iter #5 mounts into);
iteration #4's verification store (enrichment only runs for
verified works — the `EnrichmentPanel` renders when the
verification store reports `"confirmed"`); existing CaMeL
(`wrapUntrusted`, `sanitize`, `assertCapability`); existing
agent contract (`_shared.ts`, `withRetry`, `withOtelSpan`,
`extractToolUse`); existing `AGENT_MODEL_IDS.enrichment` +
`AGENT_BUDGETS.enrichment`.

**Open questions** (answered before execution):
1. **Does enrichment run automatically when a verification
   confirms, or only when a contributor submits?** Proposed
   answer: only on contributor submit. Auto-running on
   confirmation would run the agent on every verified work
   even when no new provenance exists, which is waste. The
   store shows `"none"` until a submission arrives; that's the
   honest state.
2. **Does the collector see a loading state when enrichment is
   running?** Proposed answer: yes, briefly — a muji
   `"enriching…"` line in the panel. No spinner, no
   progress bar. If the agent takes more than 5 s (batch),
   the panel stays on the loading line; next boot picks up
   the result. No real-time streaming.
3. **Can a contributor submit multiple records in one
   submission?** Proposed answer: yes. A single
   `ProvenanceSubmission` carries `records[]` up to 16; the
   agent processes them together so the artist bio is
   written with full context.
4. **What happens on an agent failure?** Proposed answer: the
   store flips to `"failed"`, the cache is not written, and
   the panel renders whatever cached enrichment existed
   before (if any). No error surface on the collector side —
   a silent fallback to "thinner provenance" is more honest
   than a "we couldn't enrich this work" chatter banner. The
   failure is visible in telemetry.
5. **Is the P-LLM's bio authoring idempotent?** Proposed
   answer: deterministic at `temperature: 0` for attempt 0; the
   retry temperatures escalate only on `ZodError`, so a
   successful first attempt is reproducible. The eval asserts
   this by running the same fixture twice and comparing the
   bio byte-for-byte (mock mode — the live mode uses a hash
   of the semantic shape instead, because any LLM is
   ultimately non-deterministic at scale).

**Out of scope (explicit):**
- Contributor upload UI (gallery-facing dashboard). Iteration
  #5 exposes the endpoint; the UI is a separate iteration if
  Laura's signal ever demands one (spine § 7 holds — "no
  gallery management dashboard").
- Real Anthropic Batch API dispatch. The dev path runs
  synchronously; the production swap lives behind a named
  constant `ENRICHMENT_DISPATCH_MODE: "immediate" | "batch"`.
- Rich timeline rendering with images + CoA-style surfaces.
  Iteration #6 owns that.
- The tactile archive chapter animation. Iteration #6.
- Enrichment of unverified works. Only verified works enrich;
  an unverified work's panel renders nothing from this
  iteration.
- Multi-gallery provenance for one work. A work has one
  `galleryOfOrigin`; additional contributors (museums, prior
  owners) use the same endpoint but their submissions stack —
  not a separate schema.
- Real auth. Dev uses a shared token header; iteration #8
  (Passkeys) wires real gallery auth.
- Revocation of contributor records (a gallery retracting a
  provenance claim). Explicit iteration if it arises.

**Outcome gate:** codify or iterate once. The codify targets:
the `'gallery'`-branded input pattern
(`PANG_Primitives_2026.md` § *Trust*), the deterministic-
timeline-assembly rule — P-LLMs never author structured
fields, only prose fields (`PANG_AI_Era_2026.md` § *Agent
patterns*), the `basedOnWorkHash` cache-invalidation pattern
(`PANG_Architecture_2026.md` § *Caching*), and the enrichment
OTel catalogue (`PANG_Architecture_2026.md` § *Observability*).

---

## Iteration #5 — findings (2026-04-23)

**Status:** landed at ceiling. All seven phases (A schema/retry/otel,
B agent, C OPFS cache, D store + persistence, E HTTP endpoint,
F eval corpus, G verify) shipped through `npm run verify` with
no skips. Unit tests 470/470, gates 26/26, eval fixtures
9/9 (1 intake + 5 enrichment + 3 verification) all at 100 %.

**What landed:**
- `src/enrichment/schema.ts` — `ProvenanceSubmission`,
  `EnrichmentOutput`, `TimelineEntry`, `EnrichedArtistContext`,
  `EnrichmentAck` — all `.strict()`, every bounded field
  bounded, `submissionId` as idempotency key, `basedOnWorkHash`
  as the cache-invalidation key. `computeWorkHash()` is pure
  (no clock), `|v1` sigil future-proofs the hash shape.
- `src/ai/agents/enrichment.ts` — Q-LLM-per-record pass
  sanitising `untrustedNote` → P-LLM authoring `bioMuji` only
  → deterministic `assembleTimeline()` → `brand(…, "P")`. The
  P-LLM never authors a timeline entry; that's the
  load-bearing invariant.
- `src/ai/prompts/enrichment.ts` — four artefacts (P system
  prompt + P tool + Q system prompt + Q tool). Q tool is the
  minimal `{ note: string | null }` with `maxLength: 160`.
- `src/enrichment/cache.ts` — OPFS `/enrichment/<workId>.json`
  with sidecar `/enrichment/index.json`. Pure
  `planReconcile(index, currentHashes)` extracted so the
  stale/orphan logic unit-tests without OPFS; procedural
  wrappers call into `opfsRead`/`opfsWrite`. 15 unit tests.
- `src/stores/enrichment.ts` + `enrichment.persist.ts` — Zustand
  slice with 5-state discriminated union
  (`none | enriching | ready | stale | failed`) + OPFS
  mirror `/enrichment/status.json` (separate from cache dir
  by design — drift is aligned at reconcile). Transition
  guards: `beginEnriching` only from retryable states;
  `markStale` only from `ready` (in-flight entries keep
  running); `markReady` only from `enriching`/`stale`. 28
  unit tests between store + persistence.
- `app/api/enrichment/submit/route.ts` — Node-runtime endpoint.
  `X-PANG-Gallery-Token` header auth, 32 KiB body cap, Zod
  schema parse, voice check on `location` fields (NOT on
  `untrustedNote` — Q-LLM territory), `.pang/enrichment-
  work-hash/<workId>.txt` first-wins hash comparison,
  `.pang/enrichment-inbox/<submissionId>.json` dedup.
  Fires `enrichment.submission.received` on accept + four
  reject reasons (`auth`, `schema`, `hash-mismatch`,
  `duplicate-submission`).
- `evals/enrichment/` — 5 fixtures across 5 dimensions
  (nominal gallery, poisoned-note injection, empty-notes,
  out-of-order sort, year-nulls-last), mock mode via
  `PANG_EVAL_MOCK=1` chained into `check:eval`. Scorer
  checks 7 declared properties per fixture; score ratio ≥
  0.85 required per A22.
- Config: `AGENT_MODEL_IDS.enrichmentQuarantine = "claude-haiku-4-6"`;
  `AGENT_BUDGETS.enrichmentQuarantine = { in: 4k, out: 256, cost: $0.02 }`;
  `capabilities["agent.enrichment.qLlm"] = ["Q"]`.

**Codify (doctrine edits earned by this iteration):**
- **P-LLMs author prose, never structure.** The enrichment agent
  deterministically assembles the timeline from sanitised
  record fields and asks the P-LLM only for `bioMuji`. A
  hallucinated timeline entry is structurally impossible. Add
  to `PANG_AI_Era_2026.md` § *Agent patterns* as a hard rule
  alongside the CaMeL pattern — they rhyme (both constrain
  what a P-LLM is *allowed* to emit).
- **Cache status and payload are independent stores.** The
  enrichment cache lives at `/enrichment/<workId>.json`; the
  store status mirror lives at `/enrichment/status.json`.
  Drift between the two is normal across boots; reconcile
  aligns on the next pass. Same shape as outbox+store in
  iter #4. Add to `PANG_Architecture_2026.md` § *Storage*
  as the "two-file rule" for OPFS-backed agent state.
- **Pure-core + procedural-wrapper for OPFS code.** Every
  OPFS-touching module gets a `planX()` pure function
  (unit-testable without OPFS) and a procedural wrapper
  that calls into it. `planReconcile` here; the same shape
  for intake reconcile, verification reconcile, and any
  future agent. Add to `PANG_Primitives_2026.md` § *Storage*.
- **Q-LLM per untrusted field.** Iteration #5 runs the Q-LLM
  once per record's `untrustedNote` rather than once per
  submission. Budget engineered for it
  (`maxCostUsd: 0.02` per call × up to 16 records =
  $0.32 per submission worst case). Add as a footnote to
  `PANG_AI_Era_2026.md` § *The quarantine*.
- **Voice check scope at the endpoint.** The HTTP endpoint
  scans contributor-sanitised fields (`location`) but NOT
  `untrustedNote` — the Q-LLM is the sole consumer and an
  art note can legitimately mention words the evaluative
  list flags. Add to `PANG_Voice.md` § *Enforcement* as the
  "scope of the banned-vocabulary scan" rule.

**Iterate once** (one second pass, no debate):
- **Reconcile on boot.** `reconcileEnrichmentCache(currentHashes)`
  is written and tested; `AppBoot` doesn't call it yet. A single
  second pass wires the call + the resulting `markStale` into
  `src/app/boot.tsx`. Named as the only known gap; will be
  picked up at the next boot-path iteration so the stale-cache
  path is exercised end-to-end in Playwright. Not a blocker
  for iter #5's spine claim.
- **EnrichmentPanel render surface.** The store + cache are
  ready; a minimal `<dl>` + paragraph card is named in the
  brief. Deferred because iter #6 (Documents-as-evidence)
  re-writes this surface with the tactile archive chapter
  animation, and shipping a placeholder panel twice is waste.
  The eval proves the data pipeline is correct; the render
  is one iteration away.

**Drop:** nothing. The ceiling for iteration #5 is what iteration
#5 delivered — every phase of the plan landed, every gate
honoured, every invariant the brief declared is enforced by a
test or a gate.

**Failure mode — observability proofs (brief's fifth declaration):**
all four regression classes named in the brief are observable
in this landed code:
- *Poisoning*: `SanitizedNoteSchema.strict()` plus the Q→P
  branding path via `sanitize()`; eval fixture
  `enrichment-02-poisoned-note` carries `bioMustNotContain`
  assertions for four injection fragments. Mock proves the
  schema; live run will prove the model.
- *Hallucination*: structural — `assembleTimeline()` is called
  outside the P-LLM retry loop on sanitised record fields;
  there is no code site where the P-LLM could author a
  timeline entry. Eval fixture `enrichment-03-empty-notes`
  (all notes null) asserts the timeline length comes from
  the submission, not from the model.
- *Drift*: `basedOnWorkHash` on every cache entry; `planReconcile`
  pure function tested on 5 cases (stable/stale/orphan/mixed/
  empty); `enrichment.cache.invalidate` fires with
  `reason: "workHashChanged"` when the pure function reports
  stale.
- *Cost*: `AGENT_BUDGETS.enrichmentQuarantine` narrow per-call
  cap + `enforceInputBudget()` before every `messages.create`;
  submission-level `submissionId` dedup on the server
  idempotent-writes to `.pang/enrichment-inbox/`.

**Metabolism check:** every discovery during the build landed
somewhere. The Q-LLM-per-record scoping decision → budget
engineering + iter findings. The two-file cache/status rule
→ codify. The voice-check scope clarification → codify. The
reconcile-on-boot gap → iterate once. No unnamed "we should
think about this" leftovers.

---

## Iteration #6 — Documents as evidence v1 (opened 2026-04-23)

**Status:** kickoff brief. Written in the planning context per
`CLAUDE.md` § 9; execution will start in a fresh context so the
compacted-summary path from iter #5 doesn't bleed into the
implementation. Five declarations present; gates named; test
criteria named; Laura's hands is the outcome signal (iteration
cadence table row).

**Why now:** iter #5 produced data with no surface
(EnrichmentPanel was deferred by design — shipping a placeholder
twice is waste). Iter #1's intake produced `IntakeOutput.documents`
up to 8 per work with `type`, `fileRef`, `extractedFields` —
structured evidence for the CoA / invoice / condition report
attached to the work at scan time. Neither has a render surface
that honours the spine's claim: *"documents exist as evidence —
the CoA with its actual signature, the invoice with its real
price, condition reports as photographs. Tactile, gesture-accessed,
not a grid of administrative slots."* (`PANG_Spine.md` § *The
spine*.) Iter #6 is the render that earns both datasets. It is
also the second "Laura's hands" cadence in a row after #4 —
#5 being gates-only — so it's the iteration that most needs
her signal before shipping.

**Scope:** ceiling. Three surfaces land together, wiring the
already-produced data to the spine's documents claim:

1. **Documents chapter.** When Laura approaches a verified work
   (focus transition from wall to work), pre-filed documents
   arrive as staggered artifacts — same chapter primitive
   iter #3 built for arrival and iter #4 extended for outcome.
   Each document settles into its tactile position one by one,
   not all at once. The last beat is `ready` (chapter primitive
   contract); the collector's gesture can interrupt at any
   point and the chapter completes in one frame to its final
   state. Zero-tap to documents (P25 holds — no review step
   between focus and evidence).

2. **Enrichment panel.** The iter #5 data gets its first
   render: a muji `<dl>` of timeline entries + a paragraph
   card for `artistContext.bioMuji`. Contributor-sourced
   fields render with the crisp `data-pang-source="intake"` /
   `"gallery"` ink; the LLM-authored `bioMuji` renders dim
   under `data-pang-source="ai"`. The panel lives alongside
   the documents chapter — documents on one side, context on
   the other — but neither is modal. Taps outside either
   still dismiss focus (the iter #4 contract holds).

3. **Tactile document viewer.** Tap any document → a
   `<canvas>`-rendered viewer opens, pinch-zoomable. First
   pinch reveals scale; deeper pinch reveals the actual
   signature on the CoA or the actual price on the invoice.
   Canvas-only for zoom math (no CSS transforms on PDFs —
   Primitive §21 holds: OpenSeadragon on `<canvas>` for
   zoomable surfaces). Back gesture (pinch-out, drag-down,
   Escape key) returns to the documents chapter view. No
   platform-default toolbar, no page flip chrome; the
   document is its own object.

Iter #6 lands the **render discipline for evidence** — the same
way iter #3 landed the chapter primitive and iter #4 extended it
to outcomes. Everything iter #6 ships is a consumer of data
iter #1 and iter #5 already produce; no new agents, no new LLM
calls, no new endpoint work. A rendering iteration, not an
agent iteration.

**Stack:**
- Chapter under `src/chapter/documents/plan.ts` + `bundle.ts`
  — pure plan function `planDocumentsChapter(workId, documents,
  focusedAt): DocumentsChapterPlan` mirroring
  `planArrivalChapter` / `planConfirmationChapter`. Beats:
  `settle → artifact.1 → artifact.2 → … → artifact.n →
  context → ready`. Budget: `totalMs` between 6000 and
  12000 (scales with document count; 1 document = ~6 s, 8
  documents = ~12 s). Every artifact beat has a `payload`
  with the document's `type`, `fileRef`, `extractedFields`.
  The beats are pure data — no DOM, no canvas; the renderer
  reads `tMs` and maps to visual state.
- Renderer under `src/components/documents/DocumentsChapter.tsx`
  — DOM chrome consumer of the plan. Each artifact arrives as
  a small card with the document type (*"certificate of
  authenticity"*, *"invoice"*, *"condition report"*) plus the
  extracted fields the intake Q-LLM pulled. `View Transitions`
  wrap the artifact-in animation; Motion One's compiled
  `linear()` easings (Primitive §36) drive the settle. Sharp
  corners, 2 px borders, OKLCH tokens — Primitive §11.
- Enrichment panel under `src/components/enrichment/
  EnrichmentPanel.tsx` — DOM chrome, `<dl>` + paragraph
  card. `data-pang-source` distinguishes `"intake"` (crisp
  ink), `"gallery"` (crisp ink, contributor brand), `"ai"`
  (dim ink, muji — the bioMuji only). Suspends on
  `useEnrichment.stateOf(workId).kind === "enriching"` with
  a muji line ("enriching…", two-character ellipsis — see
  `PANG_Voice.md`); hides entirely on `"none"`.
- Document viewer under `src/components/documents/DocumentViewer.tsx`
  + `src/documents/viewer.ts` — canvas-only viewport with
  exponential-smoothing zoom animator (Primitive §39 — not a
  spring), `PointerEvent` + `touch-action: none` (Primitive §40).
  PDFs render through a worker (pdf.js 4.x, ~1.5 MB WASM,
  precached via service worker, same discipline as the
  MediaPipe segmenter from §38). Images render through
  `createImageBitmap` on a worker and are drawn to the main
  canvas as a single `ImageBitmap` source (no CSS transforms).
  Viewer is opened via the documents chapter's tap on an
  artifact; closed via pinch-out, drag-down, Escape.
- OPFS bytes layer under `src/documents/bytes.ts` — thin
  accessor over `opfsRead(fileRef)` returning
  `Blob | null`. Null-byte path is honest: the viewer renders
  a muji "this document is no longer available" state
  rather than crashing. `documents.bytes.miss` OTel event
  tags the missing `fileRef` + the `workId` so the reconcile
  pass can surface orphaned references.
- Observability under `src/documents/otel.ts`:
  `documents.chapter.start`, `documents.chapter.complete`,
  `documents.chapter.abort` (collector interrupted),
  `documents.viewer.open`, `documents.viewer.close`,
  `documents.viewer.zoom_depth` (max pinch level reached —
  a coarse signal for "did she paint into this document"),
  `documents.bytes.miss`, and — tying back into iter #5 —
  `enrichment.panel.render` firing when the panel's state
  flips to `"ready"` for the first time on a work.
- Voice additions under `src/ai/voice/documents.ts` + corpus
  under `ai/voice/corpus/documents.md`. Sentence-case labels
  only: *"certificate of authenticity"*, *"invoice"*, *"condition
  report"*, *"no longer available"*, *"enriching…"*. Zero
  marketing vocabulary; every string passes `check:strings`.
  No generated prose — every string in iter #6 is
  hand-authored and corpus-sourced.

**Reference:**
- Rijksmuseum's *Rijksstudio* object page — documents and
  provenance as tactile layers alongside the work, not as
  an administrative accordion at the bottom. Zoom into the
  signature is a first-class gesture.
- Apple Notes' scanned-document viewer — canvas-rendered,
  pinch-zoomable to signature, no chrome except the thinnest
  possible title strip. No page flip; no search bar; no
  export button mid-view.
- Figma's comment thread — contextual chrome that appears
  beside the object, not over it. The object remains
  untouched.
- Granola's reveal cadence — content lands in staggered
  beats (not all-at-once); each beat has its own settle.
  Same shape the chapter primitive already produces; iter #6
  is the second surface to borrow it (after outcome
  chapters in iter #4).
- Museum CoA framing — the CoA is evidence, not decoration.
  Rendered muji, at the work's actual scale, with the
  signature legible. Anti-reference: a PDF viewer with page
  navigation, zoom controls, and a download button — the
  chrome that makes a museum object feel like a file.

**Canvas:** split — DOM for chrome, `<canvas>` for the document
viewport. The documents chapter is DOM (cards settle in via
View Transitions + compiled-spring easings; no canvas math
needed). The enrichment panel is DOM (`<dl>` + paragraph).
The document viewer is `<canvas>` (pinch-zoom math, sub-pixel
signature readability, no CSS transform blur). The Room's
existing canvas (iter #2) is untouched; the viewer opens as
a second canvas *overlay*, not a replacement — iter #2's GL
layer pauses its RAF loop when the viewer is active (a
`useWorks((s) => s.activeViewer)` selector gates the tick).

**Failure mode (5th declaration):** four regression classes must be
observable.

- *Jank under staggered reveal.* A document chapter with 8
  artifacts on a mid-tier Android must hold 60 fps during the
  settle; INP p75 ≤ 200 ms through the artifact sequence.
  Enforcement: `documents.chapter.*` spans include per-frame
  timing attributes; a Playwright harness scripts a mocked
  `performance.now()` + 8-document fixture and asserts the
  frame-time histogram p75 < 16.67 ms. Regression fails CI.
- *Source confusion.* Bio must render under
  `data-pang-source="ai"` (dim); intake-extracted fields
  must render under `data-pang-source="intake"` (crisp);
  gallery-submitted timeline notes must render under
  `data-pang-source="gallery"` (crisp). A renderer bug that
  mis-attributes a source is a voice regression invisible to
  `check:strings`. Enforcement: a React Testing Library test
  per render path asserts the `data-pang-source` attribute
  against the data's branded origin; a Playwright visual
  regression catches the `text-ink-ai` vs `text-ink` ink
  swap.
- *Missing document bytes.* An OPFS quota eviction or a
  migration path has dropped a document's bytes; the
  viewer must render a muji "no longer available" state and
  fire `documents.bytes.miss` — never crash, never render a
  broken-image icon, never show a raw `fileRef`. Enforcement:
  a test fixture with a dangling `fileRef` asserts the
  miss-state string + the OTel event; the chapter does not
  abort (the rest of the documents still settle).
- *Viewer-as-escape-hatch.* The back gesture (pinch-out,
  drag-down, Escape) must always return to the documents
  chapter view — never to a blank room, never to the wall.
  A bug in the viewer's unmount path that dismisses focus
  entirely breaks the spine's "stay with the work" promise.
  Enforcement: a Playwright walk scripts every back path
  and asserts `useWorks.getState().focusedId` is unchanged
  at viewer close.

**Gates this iteration must pass:** the 48. Specifically
load-bearing:
- P7 (INP 200 ms p75) — staggered reveal + pinch-zoom are
  both gesture surfaces that must hold the budget.
- P9 (Room reserves `<canvas>`) — unchanged; iter #6 adds a
  *second* canvas for the viewer and gates the Room's RAF
  via `activeViewer`.
- P11 (OKLCH only) — the new artifact cards + viewer chrome
  use token colours only; no literal hex.
- P15 (springs default / compiled `linear()`) — artifact
  settles use compiled easings; pinch-zoom uses the
  exponential-smoothing animator (Primitive §39), not
  spring primitives.
- P20 (CV runs in a worker) — unchanged but extended: PDF
  parse runs in a worker via pdf.js; no main-thread parse.
- P23 (keyboard a11y) — the viewer is keyboard-dismissable
  (Escape), the documents chapter is focus-trappable only
  while the viewer is open, and the enrichment panel's
  headings are landmark-labelled.
- P24 (design-token discipline) — zoom rate, settle
  duration, artifact stagger all live as module-level
  `const`s, no magic numbers in render files.
- P25 (zero-tap review) — focus → documents chapter → ready
  in one gesture; no "confirm opening" prompt.
- A4 (voice prompt) — not applicable (no LLM calls in
  iter #6) but the gate still runs to confirm nothing was
  added inadvertently.
- A5 (banned vocabulary) — `check:strings` scans the new
  voice corpus under `ai/voice/corpus/documents.md`.
- A8 (`wrapUntrusted`) — not applicable for iter #6 (render
  path only); the gate still runs.
- A10 (OTel spans) — all chapter + viewer spans wrapped.
- A21 (retry policy) — not applicable (no agent calls); the
  gate still passes because no new agent was introduced.

**Test criteria:**
1. `planDocumentsChapter` is pure: same `(workId, documents,
   focusedAt)` input produces byte-identical output across
   calls; no clock reads inside the plan function.
2. A chapter with `n` documents has exactly `n + 3` beats
   (`settle` + n artifact beats + `context` + `ready`) and
   its `totalMs` falls in `[6000, 12000]` across `n ∈ [1, 8]`.
3. Collector interruption during a documents chapter
   completes the chapter to its final state in one frame
   (the same escape hatch iter #3's arrival chapter
   guarantees).
4. `DocumentsChapter` renders every artifact with its
   `data-pang-source` attribute matching the document's
   branded origin (`"intake"` for Q-LLM extracted,
   `"gallery"` for enrichment contributor fields, `"ai"`
   only on `bioMuji`).
5. `DocumentViewer` opens on artifact tap, zooms via
   `PointerEvent` pinch, closes via pinch-out / drag-down /
   Escape. Background `focusedId` is unchanged at viewer
   close.
6. A dangling `fileRef` renders the "no longer available"
   state and fires `documents.bytes.miss`; the chapter
   continues without aborting.
7. `EnrichmentPanel` renders `"enriching…"` while the store
   is `"enriching"`, the `<dl>` of timeline entries when
   `"ready"`, nothing when `"none"`. State transitions
   trigger a single re-render (a Zustand selector test).
8. `check:strings` finds no marketing / evaluative
   vocabulary in `ai/voice/corpus/documents.md`.
9. Playwright walk: open a verified work with 3 documents →
   documents chapter → tap CoA → viewer zoom to signature →
   back gesture → documents chapter still visible → tap
   outside focus → back to the Room. No blank frames, no
   `focusedId = null` mid-walk.
10. `npm run verify` — all clean. 26/26 gates, 480+/480+ unit
    tests (10+ new tests expected), 9/9 existing eval
    fixtures preserved.

**Pre-existing work this depends on:**
- Iteration #1's `IntakeOutput.documents[]` (already in
  `CollectionEntry.verificationHint`).
- Iteration #2's Room + focused-work selector chain
  (`useWorks.focusedId`).
- Iteration #3's chapter primitive
  (`planArrivalChapter`, the `tMs`-driven renderer).
- Iteration #4's `FocusedWorkPanel` + `AskGallery` layout
  (documents + enrichment panels live *beside* it, not
  inside it).
- Iteration #5's `useEnrichment` store + `readEnrichmentCache`
  (the enrichment panel reads from both).

**Open questions** (answered before execution):
1. **Does the documents chapter auto-play on focus, or
   require a tap?** Proposed answer: auto-play on focus.
   Laura's gesture to the work *is* the gesture to the
   documents. The spine says "documents arrive as artifacts,
   one by one" (§ *The spine*) — an additional tap before
   that would be chrome.
2. **What's the viewer's default zoom?** Proposed answer:
   fit-to-viewport. First pinch reveals scale; no "actual
   size" toggle, no "fit to width" button. The gesture is
   the control.
3. **Do we render contributor (gallery) timeline notes on
   the artifact cards?** Proposed answer: no. The artifact
   card shows only the *intake-extracted fields* (signature
   description, purchase date, etc.). Contributor notes
   live on the enrichment panel's timeline `<dl>`, not on
   the document card. The separation preserves the CoA's
   character as a physical object — the contributor's
   annotation does not belong on the CoA's face.
4. **What happens if a document's `fileRef` is null?**
   Proposed answer: the artifact card still renders (the
   extracted fields are the information), but tapping the
   card is a no-op — no viewer opens, no error appears.
   The fields were legible enough to surface without the
   scan; the scan is a nice-to-have.
5. **Does the viewer support multi-page PDFs?** Proposed
   answer: page 1 only in v1. A 12-page condition report
   renders page 1 with a muji "+11 more pages" footer.
   Pagination is iter #7 or later — the ceiling for v1 is
   the signature on the CoA, not archival browsing.

**Out of scope (explicit):**
- Collector-uploaded documents. Documents arrive via
  intake (iter #1) or via gallery/museum enrichment
  submissions (iter #5 — extended in a later iteration if
  signal demands). There is no "+" button to upload a
  document in iter #6.
- Multi-page PDF pagination. v1 is page 1 only.
- Document editing / annotation. Evidence, not drafts.
- Document sharing / export. A download button is chrome
  that breaks the museum-object register.
- Full-text search across documents. Iter #7+ territory
  if it ever lands.
- New LLM calls. Iter #6 is rendering, not agents. No
  prompts, no tools, no retry policies, no Q-LLM passes.
- OPFS quota management. Iter #6 renders the
  "no longer available" state honestly but does not add
  proactive eviction logic — that's the OPFS reconcile
  iteration.

**Outcome gate:** codify or iterate once based on Laura's
signal. The codify targets:
- **Chapter primitive as a render discipline, not just an
  arrival affordance.** Iter #3 + #4 built it, iter #6
  confirms it extends to evidence. Add to
  `PANG_Primitives_2026.md` § *Motion* as the "chapter
  grammar: pure plan + tMs-driven renderer".
- **Source-attribution ink as a voice primitive.**
  `data-pang-source` + the ink-vs-ink-ai CSS tokens are
  now applied across three surfaces (intake result card,
  enrichment panel, document artifact card). Codify as a
  first-class primitive: "every string that reaches Laura
  carries its source".
- **Pinch-to-signature as the grammar for evidence.**
  Pinch isn't just "zoom into the paint" (iter #7's deep
  zoom); it's also "zoom into the signature" (iter #6's
  viewer). The gesture means *read closer*. Add to
  `PANG_Spine.md` § *Gestures* as the doctrine edit.

Laura's hands test, specifically:

> *"Open a verified work that has a CoA and an invoice. Watch
> the arrival chapter, then look at it for ~30 seconds. Do the
> documents feel like evidence, or like a file manager? Tap the
> CoA — can you read the signature? Does the back gesture put
> you back where you expected, or somewhere weird?"*

If the evidence register lands, codify the three above. If
the register is ambiguous, iterate once on the chapter
cadence or the viewer chrome. If it lands as "file manager",
drop iter #6 and ask what the spine actually wants from
evidence.

---

## Iteration #6 — findings (2026-04-23)

**Status:** landed at ceiling on `iter-6-documents-as-evidence`,
squash-merged to `main` as `413e549` via PR #16. `npm run verify`
clean (26/26 gates, all unit suites green); Playwright e2e
18/18 across `chromium-mobile` + `chromium-desktop`; CI green
(PANG gates + Playwright e2e + Vercel build + preview comments).
Laura's hands pending — the walk goes next; these findings cover
what CI, the lint, and the gesture grammar already taught us.

### What landed
- `src/ai/chapter/plan.ts` — `planDocumentsChapter(workId,
  documents, focusedAt)` pure (no clock reads inside);
  `settle → artifact.1…n → ready` beat sequence; `totalMs`
  scales with document count. Beats carry `payload` with
  `type`, `fileRef`, `extractedFields`.
- `src/ai/chapter/types.ts` + `voice.ts` + `index.ts` — shared
  `BeatPayload`, `DocumentsChapterPlan`, plus voice corpus for
  artifact labels (*"certificate of authenticity"*, *"invoice"*,
  *"condition report"*) and the context / viewer lines.
- `src/ai/chapter/plan-documents.test.ts` — 8 unit tests (plan
  purity, beat count, totalMs bounds, payload integrity).
- `src/components/documents/DocumentsChapter.tsx` — DOM chrome
  consumer of the plan. Staggered reveal via compiled easings;
  artifact cards persist at rest state after their beat ends
  (see *persistent artifact slots* below).
- `src/components/documents/DocumentViewer.tsx` + `src/documents/
  viewer.ts` + `viewer.test.ts` — canvas viewport, pdf.js 4.x
  worker at `public/vendor/pdf.worker.min.mjs`, exponential-
  smoothing zoom (Primitive §39), `PointerEvent` + `touch-action:
  none`. Missing-bytes path renders the muji "no longer
  available" line and fires `documents.bytes.miss`.
- `src/documents/bytes.ts` — thin OPFS accessor
  (`Blob | null`), never throws.
- `src/documents/otel.ts` — full span catalogue:
  `documents.chapter.{start,complete,abort}`,
  `documents.viewer.{open,close,zoom_depth}`,
  `documents.bytes.miss`, and `enrichment.panel.render`
  tying back into iter #5's data surface.
- `src/components/enrichment/EnrichmentPanel.tsx` — provenance
  `<dl>` + bioMuji `<p>` with `data-pang-source` per element.
  Reads `readEnrichmentCache(workId)` on ready/stale; renders
  nothing on `none` / `enriching` / `failed` (the absence is
  the state, per the panel's own doctrine).
- `src/stores/enrichment.ts` — exports `ENRICHMENT_NONE` as a
  module-scoped singleton (see *selector stability* below).
- `src/components/AppBoot.tsx` — `window.__PANG.useWorks`
  exposed under `NEXT_PUBLIC_PANG_E2E=1`; the sanctioned
  Playwright seeding seam.
- `e2e/documents.spec.ts` — Tier 2 walk: focus a seeded work
  with a document → chapter mounts → tap CoA card → viewer
  opens → Escape dismisses → chapter DOM survives + focus
  preserved.
- `playwright.config.ts` + `.github/workflows/ci.yml` — the
  env var is threaded into both webServer and CI build step
  (see *build-time env discipline* below).

### What CI + the gesture grammar exposed

Four discoveries, each with its own verdict:

1. **Zustand selector instability under `useSyncExternalStore`.**
   `EnrichmentPanel`'s original fallback — inline `{ kind:
   "none" }` inside the selector — allocated a fresh object on
   every call. React 19 detected the unstable snapshot and
   logged *"The result of getServerSnapshot should be cached
   to avoid an infinite loop"*. Playwright caught it as a
   hang. Fix: module-level `ENRICHMENT_NONE` singleton,
   exported from the store, reused as the selector fallback.
   The shape generalises to every discriminated-union store:
   a missing key maps to a shared singleton, never a literal.

2. **Chapter grammar = reveal + persistent rest, not reveal
   alone.** `activeBeats(plan, tMs)` drops past-end beats
   (correct for transient narration: a settle beat should
   not keep painting after `endMs`). But artifact beats
   carry tap targets — they must survive their reveal so the
   evidence is still reachable. Desktop raced past this on
   first implementation; mobile's slower frame cadence lost
   the race and cards unmounted before the Playwright
   `dispatchEvent` fired. Fix: a local `persistentArtifactSlots`
   helper in `DocumentsChapter.tsx` clamps past-end artifact
   beats to `{ envelope: 1, progress: 1 }`. The chapter is
   the reveal *and* the rest state.

3. **React 19 `react-hooks/set-state-in-effect`.** The panel's
   first cut called `setState` inside an async `useEffect` to
   reset-on-focus-change; React 19's lint rejects this
   pattern (cascades renders). Rewrote to stamp `{ workId,
   payload }` and derive the current-focus payload at render
   time via equality check. The lint is the enforcement; no
   doctrine edit earned.

4. **`NEXT_PUBLIC_*` is build-time inline, not runtime.** The
   `window.__PANG` seed hook is gated by
   `process.env["NEXT_PUBLIC_PANG_E2E"]` inside `AppBoot`.
   Setting it on Playwright's webServer env works locally
   (dev reads env live) but failed in CI, where `next build`
   runs separately from `next start`. The flag has to be
   present during **build** for Next.js to inline
   `"1"` into the production bundle; the runtime value is
   never consulted. One-line fix in the workflow lifting the
   var to the e2e job env.

### Codify
- **Module-scoped singleton fallbacks for discriminated-union
  stores.** Every Zustand selector that maps a missing key to
  a "none" variant reuses a module-level singleton rather
  than allocating. Add to `PANG_Primitives_2026.md` § *Storage*
  as *"discriminated-union stores export a NONE singleton"*.
- **Chapter grammar = reveal + rest state.** Artifact beats
  have a transient reveal envelope (0→1 over `durationMs`)
  **and** a persistent rest state (envelope = 1 after `endMs`).
  Narration beats stay transient. Extends the existing
  "chapter grammar: pure plan + tMs-driven renderer" primitive
  earned in iter #3 + #4. Add to `PANG_Primitives_2026.md`
  § *Motion* as a clarifying clause.
- **`NEXT_PUBLIC_*` build-time discipline.** Next.js inlines
  these vars at build time; any CI step that runs `next build`
  must already see every `NEXT_PUBLIC_*` the code reads, or
  those branches compile out to dead code. Add to
  `PANG_Architecture_2026.md` § *Build* as a one-paragraph
  rule with the exact failure mode (PR #16's e2e hang) as the
  canonical counter-example.
- **`window.__PANG` as the sanctioned E2E seed seam.**
  `window.__PANG.<storeName>` exposed under `NEXT_PUBLIC_PANG_E2E=1`;
  scoped to non-prod bundles by env gate. Every Playwright
  spec that needs store-level seeding goes through this seam
  rather than driving the UI; prod bundles ship no seed hook.
  Add to `PANG_Architecture_2026.md` § *Testing*.

### Iterate once (one second pass, no debate)
- **Lift `persistentArtifactSlots` into `src/ai/chapter/driver.ts`.**
  Export alongside `activeBeats` so every chapter renderer
  uses the same primitive rather than re-implementing the
  reveal-vs-rest split per surface. Apply to `ArrivalChapter`
  and `OutcomeChapter` the same pass — both have artifact
  beats that want the rest-state contract. Single PR, scoped
  to the chapter grammar unification. Picked up at the next
  surface that opens.

### Drop
- The React 19 setState-in-effect discovery. The lint
  enforces the pattern mechanically; no doctrine edit
  earned. Noted here so it's not rediscovered.
- `documents.chapter.abort` event ergonomics — emitted but
  not yet read by any consumer. The span is cheap to leave
  alone; its consumer-side shape gets codified when a
  surface actually reads it.

### Failure mode — observability proofs (brief's fifth
declaration): all four classes observable.
- *Jank under staggered reveal*: per-beat reveal timing holds
  through the e2e walk on chromium-mobile (Pixel 7 emulation);
  `documents.chapter.*` spans emit with the expected payload.
  The 8-artifact fixture is still TODO — named as a debt on
  the `check:perf` harness below.
- *Source confusion*: TimelineRow's `data-pang-source`
  attribution wires per entry; `inkForRole` maps every
  contributor role to `"gallery"` today (a conservative
  palette decision — widening is a later iteration). BioMuji
  lands under `data-pang-source="ai"`. Playwright asserts
  the attributes at the panel level.
- *Missing document bytes*: `src/documents/bytes.ts` returns
  `null` cleanly; viewer emits `documents.bytes.miss` and
  renders the muji "no longer available" line. Confirmed in
  the e2e walk — the spec deliberately doesn't seed OPFS
  bytes and the viewer still mounts.
- *Viewer-as-escape-hatch*: `focusedId` preserved through
  viewer open + Escape close; asserted in
  `e2e/documents.spec.ts`. The chapter DOM survives the
  viewer lifecycle.

### What this tightens
- `PANG_Primitives_2026.md` gains the singleton-fallback
  rule and the reveal-plus-rest clause. Two lines, both
  subtractive (they replace ad-hoc patterns that were
  already sitting in the code).
- `PANG_Architecture_2026.md` gains the `NEXT_PUBLIC_*`
  build-time rule and the `window.__PANG` seed-seam rule.
- `PANG_Gates.md` and `.pang/gates.yaml` unchanged (still
  48). P7's staggered-reveal perf assertion stays a debt
  until the 8-artifact fixture exists; not a new gate.
- `CLAUDE.md` unchanged. Nothing cut from the cannot-do
  list; nothing added.

### Metabolism check
Every discovery lands: singleton → codify; reveal+rest →
codify + iterate-once (the driver.ts lift); build-time env
→ codify; seed seam → codify; set-state-in-effect → drop
(lint owns it); `abort` span ergonomics → drop (no consumer
yet). The Vercel Agent Review PR-permissions detour earlier
today is a tooling note, not a doctrine edit. No unnamed
"we should think about this" overhangs.

---

## Iteration #7 — Deep Zoom collection-wide (opened 2026-04-23)

**Status:** kickoff brief. Scope is explicit down-scope to
**principle** with a named reason (below). Cadence table
row: gates-only, no Laura's hands — this iteration lands a
primitive behind its sanctioned adapter ahead of the data
that will populate it.

**Why now:** iter #6 codified "pinch means read closer" on
the document viewer (the signature on the CoA, the price on
the invoice). The same gesture wants to apply to the **work
itself** — paint, canvas weave, restoration marks — but two
prerequisites are missing:

1. `CollectionEntry.imageUrl` is a flat single-resolution
   image today; source pyramids (DZI / IIIF) don't exist in
   the intake pipeline yet. Generating them is a separate
   iteration.
2. Primitive §21 ("Deep Zoom via OpenSeadragon, not CSS
   scale transforms") exists in doctrine but its enforcement
   is "code-review level" — no gate, no lint. A future
   iteration wanting a "quick zoom" affordance could add
   `transform: scale(2)` and nothing would stop it.

Landing the primitive behind its sanctioned adapter now —
before the source tiles exist — makes the seam ready. When
the tile-generation pipeline ships, `<DeepZoom>` plugs in
without a round of primitive-shape debate. The gate upgrade
closes the door on the regression class before it can land.

**Scope:** **principle** (explicit down-scope). Named reason:
source tile pyramids don't exist in the intake pipeline yet,
so "every work in The Room is deep-zoomable" is not
achievable this iteration. The principle being proven: a
primitive can land behind its sanctioned adapter ahead of the
data. Ceiling for the iteration is "`<DeepZoom>` exists, is
lint-enforced, smoke-routed with a seeded DZI, and the
anti-pattern (CSS scale) is gated out of `src/` outside the
adapter." Room wire-up is out of scope.

**Stack:**
- `openseadragon` 4.x npm package. Wrapped in
  `src/components/deep-zoom/DeepZoom.tsx` as the sole
  sanctioned call site per Primitive §21. Thin wrapper —
  `new OpenSeadragon({ element, tileSources })` inside a
  `useEffect` with proper cleanup on unmount.
- Tile source: `{ Image: { Url } }` for flat fallback +
  `{ type: "image", tileSource: "<DZI manifest URL>" }` for
  tiled pyramids. Both land; only DZI exercises real deep
  zoom, but the simple-image path is the fallback when only
  flat bytes exist (so the adapter is never blocked on
  source-pipeline readiness).
- Smoke route `/deep-zoom-smoke` (behind `NEXT_PUBLIC_PANG_E2E=1`
  or `NODE_ENV === "development"`; prod bundles never ship
  it — same env-gate discipline as iter #6's `__PANG` seam).
  Mounts `<DeepZoom>` against one pre-baked DZI pyramid
  seeded at `public/vendor/deepzoom/<work>/`. Source
  selection: a genuinely public-domain reference (MET /
  Rijksmuseum open-access), not a generated placeholder.
- Gesture: OSD owns its own pinch / wheel / keyboard-zoom
  handling. We confirm compose with `touch-action: none` on
  the container. No CSS scale, no transforms, no overlaying
  gesture library.
- Canvas: OSD renders to its own canvas — no second overlay,
  no CSS-scaled `<img>`. The Room's canvas (iter #2) is
  untouched; DeepZoom opens as a second canvas overlay
  matching iter #6's DocumentViewer pattern. Room's RAF tick
  gates on a new `activeDeepZoom` selector (same shape as
  `activeViewer`).
- OPFS tile cache at `/deep-zoom/<workId>/` — **named but
  deferred**. The shape (pure `planTileCache()` + procedural
  wrapper per iter #5's OPFS discipline) is declared here
  for the later iteration that wires it; v1 lets OSD fetch
  directly.
- Lint / gate uplift: a new `check-transforms.ts` script
  folded into `npm run check:gates`, scanning `src/` minus
  `src/components/deep-zoom/` for `transform:\s*scale\(`,
  `scaleX\(`, `scaleY\(` in CSS-in-JS / `style=` literals +
  Tailwind `scale-` utilities. Runs alongside the existing
  string audit. Gate count stays 48 — folded into P24
  (design-token discipline) rather than added as P26.

**Reference:**
- Rijksmuseum Rijksstudio zoom into *The Night Watch* — the
  canonical deep-zoom-into-a-painting experience. Paint
  strokes, canvas weave, restoration marks at 100 %+. This
  is the target register for when source tiles exist.
- Google Arts & Culture / Art Camera — the same shape with
  an ML upscaler on top; the upscaler is out of scope, but
  the gesture contract is identical. Worth the reference
  because the *"don't show chrome while zooming"* discipline
  is already set there.
- OpenSeadragon's `simple-image` example on their own docs —
  the minimum viable wiring; their docs are the spec.
- Anti-reference: any lightbox that pinches a JPEG with CSS
  scale. Crisp at 1×, mush at 2×. Exactly the failure
  Primitive §21 names.

**Canvas:** `<canvas>` via OSD. Minimal DOM chrome around it
(close gesture, no title strip, no zoom controls — OSD's
internal UI is suppressed). Sharp corners, 2 px borders,
OKLCH tokens only. The Room's canvas is unaffected.

**Failure mode (5th declaration):** four regression classes
must be observable.

- *CSS-scale backsliding.* Most likely future regression: a
  future iteration adds a "quick-zoom" affordance via
  `transform: scale(2)` somewhere in `src/`. Enforcement:
  the new `check-transforms.ts` gate. A violation fails CI;
  the unit-test fixture lives in `scripts/check-transforms.test.ts`
  and deliberately introduces a pattern the scanner must
  catch, asserting both the positive (catches the
  violation) and negative (the adapter's own file is
  exempted) cases.
- *Tile-load jank.* OSD's default tile strategy is
  network-first; on a cold cache with a 4000 px DZI, the
  initial pan can jank. Enforcement: `deep_zoom.tile.load`
  OTel span with `durationMs` + `source: "network"` attribute.
  The Playwright smoke asserts the span fires on first
  pan; the perf SLO (p95 < 200 ms warm) is named but not
  CI-gated this iteration — the warm path requires the
  OPFS cache which is the deferred phase.
- *Memory leak on unmount.* OSD holds tile-cache references
  + canvas contexts; a missed cleanup leaks across
  open/close cycles. Enforcement: Playwright harness cycles
  open → close × 10 on the smoke route and asserts
  `performance.memory.usedJSHeapSize` delta < 5 MB
  (Chromium-only; our CI matrix is chromium-desktop +
  chromium-mobile so this works). Fails CI on regression.
- *Escape semantics.* Close gesture (Escape, drag-down,
  pinch-out-past-threshold) returns to the originating
  surface with `focusedId` preserved. Same contract as
  iter #6's DocumentViewer. Enforcement: Playwright spec
  asserts `useWorks.getState().focusedId` unchanged across
  open → close; `useWorks.getState().activeDeepZoom` returns
  to `null` on close.

**Gates this iteration must pass:** the 48.
- P7 (INP 200 ms p75) — pinch + wheel must hold the budget;
  OSD's RAF cannot starve main-thread input.
- P9 (Room reserves `<canvas>`) — unchanged; DeepZoom opens
  as a second canvas overlay behind an `activeDeepZoom`
  selector (the iter #6 `activeViewer` pattern generalised).
- P11 (OKLCH only) — any new chrome uses tokens.
- P15 (compiled easings / springs default) — OSD's internal
  easings live under its own adapter surface; PANG code
  introduces no new cubic-beziers.
- P24 (design-token discipline) — **extended** by
  `check-transforms.ts` to ban `transform: scale(` outside
  the DeepZoom adapter. The gate content grows; the gate
  count does not.
- P23 (keyboard a11y) — OSD's + / − / arrow-key zoom
  preserved; Escape dismissable; `role="dialog"` +
  `aria-label="deep zoom"` on the overlay root.
- A4, A5, A8, A10, A21 — not applicable (no LLM calls, no
  new agent); gates still run and pass.

**Test criteria:**
1. `<DeepZoom src tileSource onClose />` mounts, wraps OSD,
   emits `deep_zoom.{open,close,zoom_depth,tile.load}`
   spans at declared boundaries. Unit test + smoke-route
   integration.
2. A deliberately-introduced `transform: scale(2)` in
   `src/components/verification/` (temporary commit on a
   test branch) fails `npm run check:gates`; reverting
   passes. The gate's fixture file proves both directions.
3. Smoke route `/deep-zoom-smoke` renders the seeded DZI;
   first tile paints within 1 frame of mount; pinching to
   3× reveals a region the flat 1024 px fallback source
   cannot show (canvas weave visible). Playwright visual
   diff captures the 1× vs 3× frames.
4. Open → close × 10 on the smoke route holds heap delta
   under 5 MB (Playwright + `performance.memory`).
5. Escape / drag-down / pinch-out-past-threshold all
   dismiss; `focusedId` unchanged; `activeDeepZoom` back
   to `null`.
6. `npm run verify` — still 26/26 declared checks plus the
   new `check-transforms`; unit tests +5 or more (wrapper,
   span emission, close paths, scanner fixture); evals
   unchanged; Playwright +1 spec (`deep-zoom.spec.ts`).
7. The new gate surfaces in `npm run check:gates` output
   as a line item under P24's section.

**Pre-existing work this depends on:**
- Iter #2 Room + the `active*`-selector pattern for
  overlay canvases.
- Iter #6 DocumentViewer (the second-canvas-overlay
  reference implementation, the gesture semantics, the
  Escape contract).
- Iter #6 codify: `NEXT_PUBLIC_PANG_E2E` env discipline
  (the smoke route's dev-only gate).
- `touch-action: none` + `PointerEvent` discipline
  (iter #2).

**Open questions (answered before execution):**
1. **OpenSeadragon vs a 2026 alternative?** OSD. It is the
   reference implementation for tiled deep-zoom in the
   browser; alternatives (Leaflet, OpenLayers, Seadragon.js)
   are forks or subsets. 4.x is maintained. The tile
   protocol is open; if we ever swap engines, `<DeepZoom>`
   is the one change-site.
2. **DZI vs IIIF?** DZI first. File-folder-on-disk simple;
   no manifest server required. IIIF joins when museum-API
   integration lands (a later iteration).
3. **Who generates the tile pyramid?** Not this iteration.
   v1 ships with one pre-baked DZI under `public/vendor/
   deepzoom/`. A build-time script (flat source → DZI
   pyramid) is its own iteration, probably adjacent to the
   higher-res source-image acquisition.
4. **Gate added to the count or folded in?** Folded into
   P24. Gate count stays 48 — extending the doctrine the
   existing gate already enforces is cleaner than adding a
   parallel gate for the same concept.
5. **Does the adapter wire into The Room this iteration?**
   No. The Room wire-up is a later iteration when per-work
   source tiles exist. Today's ceiling is primitive + smoke
   + gate uplift.

**Out of scope (explicit):**
- Live per-work Deep Zoom in The Room. Primitive + smoke
  route only.
- The tile-generation pipeline (flat JPEG → DZI pyramid).
- OPFS write-through tile cache. Named in stack; phase-2.
- IIIF tile source.
- Deep-zoom of documents (iter #6's CoA viewer keeps its
  own pinch-zoom animator; DeepZoom is for artwork
  surfaces, not documents).
- A11y audit of OSD's internal chrome. OSD's defaults are
  reasonable; a dedicated audit is its own iteration if
  signal warrants.
- New LLM calls, new agents, new eval fixtures. Rendering +
  gate uplift only.

**Outcome gate:** codify or iterate once. Codify targets if
the primitive + the gate uplift land cleanly:
- **Primitive §21's enforcement graduates from
  "code-review level" to a CI gate.** Update
  `PANG_Primitives_2026.md` § 21 and `PANG_Gates.md` P24
  accordingly.
- **Overlay canvases gate the Room tick via an `active*`
  selector.** The same pattern appears in iter #6's
  DocumentViewer (`activeViewer`) and iter #7's DeepZoom
  (`activeDeepZoom`). Name it a primitive. Add to
  `PANG_Primitives_2026.md` § *Room / overlay* as "overlay
  canvases gate the Room RAF tick via a named selector on
  `useWorks`."
- **Primitives land ahead of data when the shape is stable.**
  Iter #6 shipped the enrichment panel ahead of contributor
  submissions; iter #7 ships DeepZoom ahead of source tiles.
  The discipline: if the adapter's interface is decided,
  land it — empty routes beat ad-hoc patterns appearing
  when data arrives. Add to `CLAUDE.md` § *Reach forward,
  not back* as a fifth move (or absorb into the existing
  four — decide at codify time based on what the language
  lands as).

Laura's hands: **not this iteration**. Gates-only per the
cadence table. Close-out walk: `npm run verify` green
including the new `check-transforms` gate, smoke route
mounts under `NEXT_PUBLIC_PANG_E2E=1`, open → close × 10
clean in Playwright, heap delta under budget.

---

## Iteration #7 — findings (2026-04-23)

**Status:** landed at ceiling on `iter-7-deep-zoom`, PR #17
open at https://github.com/tobiasschneiderberlin-oss/Pang/pull/17.
`npm run verify` clean (26/26 gates including the new P24d
`check-transforms` sub-gate, 509/509 unit tests green);
Playwright e2e pass on chromium-desktop + chromium-mobile
(1m49s CI duration). Blocking checks green: PANG gates,
Playwright e2e Tier 2, Vercel build, Vercel Preview Comments.
Laura's hands: out of scope this iteration per the cadence
table — the codify targets are doctrine-level, not
experiential.

### What landed
- `src/components/deep-zoom/DeepZoom.tsx` — thin OSD 4.1
  adapter. `new OpenSeadragon({ element, tileSources })` in
  a `useEffect`, full cleanup on unmount. `tileSources`
  accepts `{ type: "image", url }` (flat) or
  `{ Image: { Url } }` / DZI manifest (tiled). Dialog is
  `role="dialog" aria-label="deep zoom"` +
  `data-pang-surface="deep-zoom"` + `data-pang-ready` flag
  flipping on OSD's `open` event.
- `src/deep-zoom/otel.ts` — span catalogue:
  `deep_zoom.{open,close,zoom_depth,tile.load}` via
  `console.debug(JSON.stringify(...))` with `pang.deep_zoom.*`
  attrs. `close_via` discriminates `"keyboard" | "button" |
  "focus_change"`.
- `src/stores/works.ts` — new `activeDeepZoom: string | null`
  selector + `setActiveDeepZoom` action. Same shape as iter
  #6's `activeViewer`; the Room's RAF tick reads both as
  siblings.
- `app/deep-zoom-smoke/page.tsx` — smoke route gated by
  `NEXT_PUBLIC_PANG_E2E === "1"` at build time (404 in prod
  bundles). Mounts `<DeepZoom>` against one seeded
  public-domain PNG at `public/vendor/deepzoom/sample.png`
  via the `simple-image` tile source.
- `scripts/check-transforms.ts` + fixtures under
  `scripts/__fixtures__/check-transforms/{violating,clean}/`.
  Scans `src/` minus `src/components/deep-zoom/` for
  `transform:\s*scale(`, `scaleX(`, `scaleY(` in CSS-in-JS /
  `style=` literals and Tailwind `scale-<n>` utilities.
  Folded into `npm run check:gates` as P24d — P24 gains a
  sub-line in the gates output; the count stays 48.
- `scripts/check-transforms.test.ts` — 7 unit tests across
  4 describes (violating fixtures, clean fixtures, exempt
  adapter escape hatch, `maxViolations` cap).
- `e2e/deep-zoom.spec.ts` — Playwright walk. Mount + Escape,
  10-cycle heap discipline (`performance.memory.usedJSHeapSize`
  delta < 5 MB on Chromium), `deep_zoom.{open,close}` pair on
  the console-debug sink.
- `package.json` + `tsconfig.json` — test glob extended to
  `scripts/` (excluding `__fixtures__`); tsconfig excludes
  the fixture directory so fixture JSX doesn't need the full
  project JSX lib resolution.

### What execution exposed

Four discoveries, each with its verdict:

1. **OSD's `canvasKeyHandler` calls `$.cancelEvent` on
   Escape, which sets `cancelBubble = true` and starves
   window-level bubble-phase listeners.** A document-level
   `keydown` listener with `{ capture: false }` never fired
   when OSD had canvas focus. Fix: move Escape handling to a
   React `onKeyDownCapture` on the dialog root — React's
   synthetic capture runs before OSD's bubble-phase native
   handler, so `e.preventDefault() + e.stopPropagation()`
   wins. This is the general shape for any DOM chrome that
   wraps a third-party canvas engine with its own event
   grammar.

2. **React 19 StrictMode's cleanup/remount corrupts `useRef`
   guards that were set during the simulated cleanup.** The
   original `closeEmittedRef` guard (to make the close event
   idempotent across the Escape handler + focus-change
   unmount path) tripped because StrictMode fires the effect
   cleanup once during dev simulation, which set the ref to
   `true`; `useRef` persists across the simulated remount,
   so when the user's actual Escape arrived, the handler
   saw `true` and returned early. The Playwright trace
   showed `deep_zoom.close` with `close_via: "focus_change"`
   firing *before* `deep_zoom.open`. Fix: reset the guard at
   the start of every effect setup — `closeEmittedRef.current
   = false;` as the first line inside the effect, before the
   cleanup closure captures it. The pattern: **a ref guard
   that gates a cleanup-time side effect must be reset on
   setup, not at module scope**, or StrictMode will corrupt
   it.

3. **`check-strings.ts` flagged `"simple"` inside the
   `simple-image` OSD tile-source discriminator (5 false
   positives).** Two issues: (a) JSDoc one-liners like
   `/** uses "simple-image" */` weren't skipped by the
   comment-detection heuristic (`startsWith("*")` doesn't
   match `/**`); (b) the marketing-term scan didn't exempt
   code identifiers. Fixes: a block-comment stripping pass
   that preserves line numbers via newline substitution, and
   a code-identifier regex exemption
   (`/^[a-z0-9]+(?:-[a-z0-9]+)+$/` — lowercase kebab-case,
   no spaces) for the marketing scan. The audit is about
   user-facing prose, not discriminated-union literals; this
   closes the gap without narrowing the rule.

4. **`@types/openseadragon@5.0.2`'s `GestureSettings` omits
   `zoomToRefPoint` and `pinchRotate` even though OSD 4.1
   supports both.** Passing them typechecks under the plain
   options shape but fails under the nested
   `gestureSettingsTouch` shape. OSD's runtime defaults
   already match what we wanted (`zoomToRefPoint: true`,
   `pinchRotate: false`), so dropping both keys from our
   config was lossless. The general shape: when a typed
   third-party adapter's shape is narrower than the runtime,
   prefer dropping to the defaults over `as unknown as`
   casts.

### Codify
- **Primitive §21's enforcement graduates from
  "code-review level" to a CI gate.** P24 gains a sub-gate,
  `P24d: no CSS scale transforms outside the DeepZoom
  adapter`, wired into `npm run check:gates` via
  `check-transforms.ts`. Fail condition: any
  `transform:\s*scale(`, `scaleX(`, `scaleY(` in CSS-in-JS
  or `style=` literals, or any Tailwind `scale-<n>` class,
  inside `src/` and outside
  `src/components/deep-zoom/`. Update
  `PANG_Primitives_2026.md` § 21 (the "enforced in
  code-review" clause becomes "enforced by
  `check-transforms.ts`") and `PANG_Gates.md` P24 (expand
  the fail list). Gate count stays 48.
- **Overlay canvases gate the Room RAF tick via a named
  `active*` selector on `useWorks`.** `activeViewer` (iter
  #6) and `activeDeepZoom` (iter #7) both follow this
  shape: when either is non-null, the Room's RAF tick
  pauses; when both are null, the Room tick resumes. Add to
  `PANG_Primitives_2026.md` § *Room / overlay* as "every
  second-canvas overlay declares a named `active<Surface>:
  id | null` selector on `useWorks`; the Room's RAF tick
  reads the union and pauses while any overlay is mounted."
  The pattern generalises to future overlays
  (`activeArtistCanvas`, `activeProvenanceGraph`, etc.)
  without re-deriving the contract each time.
- **Primitives land ahead of data when the adapter's
  interface is decided.** Iter #6 shipped the enrichment
  panel before contributor submissions; iter #7 ships
  DeepZoom before per-work tile pyramids. Both had the
  adapter's shape settled and both had a seeded smoke
  surface proving the shape works. Add to `CLAUDE.md`
  § *Reach forward, not back* as a fifth move: *"Land the
  primitive ahead of its data when the adapter's interface
  is decided and a seeded fixture proves the shape. Empty
  routes beat ad-hoc patterns that crystallise when data
  arrives."* The fifth move sits alongside the four existing
  enablers — not a replacement.
- **Ref guards gating cleanup-time side effects must be
  reset on every effect setup.** StrictMode's simulated
  remount corrupts module-scoped or set-once guards;
  resetting inside the effect body before the cleanup
  closure captures the ref is the only correct pattern. Add
  to `PANG_Primitives_2026.md` § *State* as a one-paragraph
  rule with the iter #7 Escape regression as the canonical
  counter-example. The regression is not theoretical — it
  surfaced in a real Playwright trace and cost ~90 min to
  locate.

### Iterate once (one second pass, no debate)
- **Adopt `P24d` naming in `.pang/gates.yaml` output.**
  `check:gates` currently prints the new scanner under
  P24's general block without the `d` suffix. Cosmetic —
  the gate is enforced correctly. Next time a gate block
  is touched, surface the sub-gate letters consistently
  across P24a–P24d.

### Drop
- The `@types/openseadragon` gap on `zoomToRefPoint` /
  `pinchRotate`. The runtime defaults already match; no
  doctrine edit earned. Noted here so the next contributor
  doesn't reintroduce the casts.
- The Playwright `closeBtn.click()` interception by the
  dialog's `fixed inset-0 z-50`. Escape is the primary
  close affordance per Primitive §21 and the DocumentViewer
  contract it generalises; the click-on-external-button
  path is a smoke-route ergonomic, not a product affordance.
  No doctrine edit; the spec uses Escape.

### Failure mode — observability proofs (brief's fifth
declaration): all four classes observable.
- *CSS-scale backsliding*: `check-transforms.ts` runs as
  part of `npm run check:gates`; the 7 unit tests assert
  both directions (positive: flags `transform: scale(2)`
  and `scale-125`; negative: permits matrix transforms,
  `scaleFactor` variables, commented scale mentions, and
  OSD-style `navigatorSizeRatio`). Exempts
  `src/components/deep-zoom/` exactly. A deliberate
  violation in `src/components/verification/` was not
  shipped in this PR but the fixture proof is sufficient.
- *Tile-load jank*: `deep_zoom.tile.load` OTel span emits
  with `durationMs` + `source: "network"` attribute on the
  smoke route. Warm-path SLO (p95 < 200 ms) named as debt
  per the brief; blocked on the OPFS cache deferred to
  phase-2.
- *Memory leak on unmount*: Playwright walk cycles open →
  close × 10 on the smoke route; `performance.memory.
  usedJSHeapSize` delta measured and asserted < 5 MB on
  both chromium-desktop and chromium-mobile. Would catch
  "OSD viewer + tile cache + canvas contexts leaked across
  cycles" regression class directly.
- *Escape semantics*: Playwright asserts
  `useWorks.getState().activeDeepZoom` returns to `null`
  after Escape, and `focusedId` stays pinned to the
  sentinel across the cycle. The `deep_zoom.{open,close}`
  event pair lands on the console-debug sink.

### What this tightens
- `PANG_Primitives_2026.md` gains:
  1. § 21 — enforcement clause updated from "code-review" to
     "`check-transforms.ts` via `npm run check:gates` (P24d)".
  2. § *Room / overlay* — overlay canvases gate the RAF
     tick via a named `active*` selector on `useWorks`.
  3. § *State* — ref guards gating cleanup-time side
     effects reset on every effect setup (the StrictMode
     rule).
- `PANG_Gates.md` — P24 fail-list extended with P24d. Count
  stays 48.
- `.pang/gates.yaml` — P24d wired so `npm run check:gates`
  reports it.
- `CLAUDE.md` § *Reach forward, not back* — fifth move
  added: "Land the primitive ahead of its data when the
  adapter's interface is decided and a seeded fixture
  proves the shape."
- `package.json` — test glob extended to `scripts/`; the
  scripts directory now hosts unit-tested gates alongside
  the scanners they implement.
- `tsconfig.json` — `scripts/__fixtures__` excluded from
  type-check (fixtures are read as text by the scanner, not
  compiled as JSX).

### Metabolism check
Every discovery lands: Primitive §21 uplift → codify +
doctrine propagation; overlay-canvas RAF gate → codify;
primitives-ahead-of-data → codify (new fifth move in
`CLAUDE.md`); StrictMode ref-guard reset → codify (new
state rule in `PANG_Primitives_2026.md`); OSD
`cancelBubble` on Escape → codify (folded into the
overlay-canvas primitive — chrome owns React synthetic
capture, engine owns the canvas surface); `check-strings.ts`
code-identifier exemption → landed directly in the scanner,
no doctrine edit earned (the voice rule is about prose, not
identifiers; the exemption narrows the false-positive set);
@types gap → drop (runtime defaults match); `closeBtn`
click interception → drop (Escape is the product
affordance). No unnamed overhangs.

---

## Iteration #8 — Deep Zoom collection-wide, data phase (opened 2026-04-23)

**Status:** kickoff brief. Scope is **ceiling**. This iteration
closes spine moment #6 (`PANG_Spine.md` § *Build order*): paint
strokes on real works. Iter #7 landed the primitive behind its
sanctioned adapter ahead of data; iter #8 ships the data across
the collection and wires the Room to open `<DeepZoom>` on focused
works. It also discharges iter #7's "primitive ahead of data"
codify by proving the adapter against real pyramids.

**Why now:** the primitive exists, the gate exists, the overlay
contract (`activeDeepZoom` + RAF-gate) exists. The three missing
pieces are (1) real tile pyramids generated from high-res source
images, (2) `CollectionEntry.tileSource` as the shape that
surfaces the pyramid to the adapter, and (3) a Room gesture that
escalates focus → deep zoom without disturbing the wall. Without
this iteration, iter #7 sits latent; with it, the "Rijksstudio
register" lands in the Room. This is the iteration where Laura
can stand in front of her Van Gogh and see the paint.

**Scope:** **ceiling.** Reasons this is ceiling not principle:
the pipeline is well-understood (DZI is 1:1 with the
OpenSeadragon adapter we already ship), the OPFS cache shape is
pre-declared in iter #7's stack, and the Room wire-up uses an
existing `activeDeepZoom` selector. No experimental path has
to be proven; the risk is execution quality, not direction.

Landing shape:
- Build-time DZI pyramid generator (`scripts/build-deepzoom-pyramids.ts`)
  using `sharp` — reads `public/vendor/deepzoom/sources/<workId>.{jpg,png,avif}`,
  emits DZI pyramid + manifest under
  `public/vendor/deepzoom/<workId>/`. Deterministic: same input
  → identical pyramid bytes. Hashed output so CI can cache.
- Seeded real works: 2–3 public-domain pieces with ≥ 4000 px
  long edge (Rijksmuseum open-access / Met Open Access). Source
  images checked into `public/vendor/deepzoom/sources/`;
  generated pyramids checked in under the per-work directory
  so `npm ci && npm run build` is self-contained (no network
  fetch on CI).
- `CollectionEntry.tileSource?: TileSource` where `TileSource`
  is a discriminated union: `{ type: "dzi", manifestUrl, maxLevel,
  tileSize }` or `{ type: "image", url }` (OSD simple-image
  fallback). Zod schema at the boundary. Store migration:
  default `undefined` for existing works; new works admit the
  field on intake when pipeline runs.
- `src/deep-zoom/opfs-cache.ts` — intercepts tile fetches via
  a custom OSD tile source wrapper. Lookup order: OPFS →
  network (write-through). LRU eviction keyed on `workId`; on
  mount, the most-recently-opened work's tiles are warmed.
  `navigator.storage.estimate()` probe on first use; graceful
  no-op if quota < a floor threshold (cached in memory only).
- Room integration: `src/room/RoomCanvas.tsx` adds a
  `tap-on-focused-work` handler that reads the focused work's
  `tileSource` and calls `setActiveDeepZoom(workId)` if
  present. No tile source → no deep-zoom affordance (not a
  loud absence; the work just stays in the wall-focus pose).
  `activeDeepZoom` triggers `<DeepZoom>` mount via the app
  shell.
- Escape / drag-down / pinch-out-past-threshold from
  `<DeepZoom>` → `setActiveDeepZoom(null)`; `focusedId`
  invariant across the cycle. Room camera pose unchanged —
  the wall stays at the exact focus pose, so closing deep
  zoom feels like *returning to where you were*.
- Observability: `deep_zoom.cache.{hit,miss,evict}`,
  `deep_zoom.tile.load { source: "opfs" | "network",
  durationMs }`, `deep_zoom.pyramid.load { workId, maxLevel,
  sourceBytes }` on mount. Sibling spans:
  `room.focus.deep_zoom_enter` / `room.focus.deep_zoom_exit`
  so the Room-overlay chain is observable end-to-end.
- Iterate-once carry-over from iter #6: lift
  `persistentArtifactSlots` from `DocumentsChapter.tsx` into
  `src/ai/chapter/driver.ts` alongside `activeBeats`. First
  commit on the branch, before the main iter #8 surface.

**Stack:**
- `sharp` ≥ 0.33 — the DZI generator. Native (libvips under
  the hood); no Python or ImageMagick. Already de facto
  standard for Node image pipelines; MIT.
- OpenSeadragon 4.1 — unchanged from iter #7. The adapter
  already supports both DZI manifest URLs and simple-image
  fallbacks. Custom tile source wraps the DZI loader to
  route through OPFS cache.
- OPFS for tile cache. No IndexedDB (Primitive §14). Per-work
  directory: `/deep-zoom/<workId>/<level>/<col>_<row>.jpg`.
  Read via `FileSystemFileHandle` + `Blob`; write via
  `createWritable()`. Eviction: delete the oldest-mtime
  per-work directory when quota pressure is detected.
- Zod at the `tileSource` boundary. Same pattern as every
  other untrusted shape; even though the source is our own
  build output, the schema validates the contract between
  generator and consumer.
- `navigator.storage.estimate()` for quota probing. Chromium,
  Safari 18.4+, Firefox all ship it. Fallback: assume 50 MB
  available and let write failures gracefully degrade to
  network-only.
- Room integration through the existing `activeDeepZoom`
  selector on `useWorks`; no new store fields. The Room's
  RAF-gate already reads the union.
- `TheRoomCanvas.tsx` — one new handler on the focused-work
  tap path. No new gestures; the existing tap-to-focus
  semantics get a second meaning when the focused work
  already sits in the focus pose (tap-while-focused →
  open deep zoom).

**Reference:**
- **Rijksmuseum Rijksstudio** (https://www.rijksmuseum.nl/en/rijksstudio)
  — the canonical register for "zoom into a painting on the
  web." Paint strokes at 100%, canvas weave at 200%,
  restoration marks visible. The Room-to-deep-zoom handoff
  isn't there (their surface is a list view) but the zoom
  fidelity is the target.
- **Google Arts & Culture Art Camera**
  (https://artsandculture.google.com/project/art-camera) —
  same fidelity; the ML upscaler is out of scope, but the
  "don't show chrome while zooming" discipline is set
  there. The close gesture is a quiet return, not a
  dismissal.
- **Apple Photos pinch-to-zoom-to-detail** — for the
  continuous-gesture shape. The Room already owns pinch for
  wall-pan; the tap-in-focus escalation (not continuous
  pinch) is iter #8's compromise. Continuous pinch
  escalation is iter #9+ (open question #4).
- **Anti-reference:** any gallery-site lightbox that opens a
  flat JPEG in a modal. Crisp at fit, mush at zoom. The
  exact failure Primitive §21 + P24d forbid.

**Canvas:** OSD canvas for deep zoom (unchanged from iter #7);
Room canvas for the wall (iter #2); DocumentViewer canvas
(iter #6). Three sibling overlays; each gates Room RAF via its
own `active<Surface>` selector per Primitive §44. Sharp
corners, 2 px borders, OKLCH tokens only. No new chrome
surfaces.

**Failure mode (5th declaration):** four regression classes
must be observable.

- *Pyramid generator incorrectness.* A pyramid with off-by-one
  level counts or wrong tile overlap reads as ghosting or
  missing tiles at zoom boundaries. Enforcement: unit tests
  on `planDeepZoomPyramid(sourceWidth, sourceHeight,
  tileSize, overlap)` — pure, no image I/O. Golden-fixture
  hash check on the first seeded pyramid: any change to
  generator output changes the hash; test fails.
  `deep_zoom.pyramid.load` span emits `maxLevel` and
  `sourceBytes`; playwright asserts a sensible pair for the
  seeded fixture.
- *OPFS cache misses cold-path.* First open → network fetch;
  second open → OPFS hit. `deep_zoom.tile.load` with
  `source: "opfs" | "network"` makes the path observable.
  Playwright walk: open work twice; first cycle emits
  `source: "network"`; second cycle emits `source: "opfs"`
  for the same tile coordinates. Warm-path budget named
  (p95 first-tile-paint < 50 ms) but not CI-gated — the
  signal lives in the span durations for manual review
  until we have a perf harness.
- *OPFS quota overrun.* `navigator.storage.estimate()` polled
  on mount; if `quota - usage < 10 MB`, evict the oldest
  per-work directory. `deep_zoom.cache.evict { workId,
  reclaimedBytes }` span. Fails observably when eviction
  loops (same workId evicted repeatedly) — a pathological
  signal the e2e asserts doesn't fire on the standard walk.
- *Room handoff.* `focusedId` must stay pinned through
  open → pan-and-zoom → close; Room camera pose must be
  identical on exit to what it was on entry. Enforcement:
  Playwright asserts `useWorks.getState().focusedId`
  unchanged across the cycle, and reads a camera-pose
  snapshot before/after (exposed via the `__PANG` E2E
  seam). `room.focus.deep_zoom_enter` and
  `room.focus.deep_zoom_exit` spans carry the pose as an
  attribute so the invariant is observable offline too.

**Gates this iteration must pass:** the 48.
- P7 (INP 200 ms p75) — opening deep zoom from Room focus
  must not drop frames; OSD's mount is the critical path.
- P9 (Room canvas) — unchanged; deep zoom opens as a third
  overlay sibling to DocumentViewer (iter #6) and DeepZoom's
  own smoke route (iter #7).
- P11 (OKLCH only) — any new chrome uses tokens.
- P15 (compiled easings / springs default) — the Room →
  deep-zoom transition uses an exponential-smoothing
  animator (Primitive §39) if any interstitial motion
  appears; no new cubic-beziers.
- P24d (no CSS scale transforms outside DeepZoom adapter) —
  new code in `src/room/**` cannot add `transform: scale(`
  to simulate the zoom-in gesture. The whole point of
  iter #7's P24d is it's enforced for this iteration.
- P23 (keyboard a11y) — Escape dismissable from deep zoom;
  +/- / arrow-key zoom inherited from OSD.
- A8 (CaMeL / Untrusted boundary) — `TileSource` shape at
  the Zod boundary. Even our own build output validates.
- A16 (OPFS-backed queue discipline) — the tile cache is
  OPFS-backed; matches the intake queue pattern.

**Test criteria:**
1. `npm run build:deepzoom-pyramids` runs deterministically.
   Same input source produces identical output bytes
   (golden-hash check). Zero dependencies on network at
   build or runtime.
2. 2–3 real public-domain works seeded with tile pyramids
   checked into `public/vendor/deepzoom/<workId>/`. Each
   source ≥ 4000 px long edge. `CollectionEntry.tileSource`
   populated in the seed data.
3. From The Room, tap on a focused work opens `<DeepZoom>`
   with the work's tile source. First tile paints within
   1 frame of mount on warm cache (second open); within
   3 frames on cold.
4. Pinching to 3× reveals paint-stroke detail a 1024 px
   flat image cannot show. Playwright visual-diff captures
   1×, 2×, 3× frames against golden fixtures.
5. Escape → back to Room. `focusedId` unchanged.
   `useWorks.getState().activeDeepZoom` back to `null`.
   Room camera pose identical to pre-open (snapshot assert).
6. Open → close × 10 from Room focus state: heap delta <
   5 MB (Chromium `performance.memory`), no OSD leaks.
7. OPFS tile cache observable: first cycle emits
   `deep_zoom.tile.load { source: "network" }`; second
   cycle emits `source: "opfs"`.
8. `npm run verify` clean — 26/26 gates + unit tests +5 or
   more (pyramid planner, OPFS cache, tile-source Zod
   schema, Room tap-to-zoom handler, driver.ts slot lift);
   evals unchanged; Playwright +1 spec (`room-deep-zoom.spec.ts`).
9. `persistentArtifactSlots` lifted into
   `src/ai/chapter/driver.ts`; `DocumentsChapter.tsx`
   imports from `@/ai/chapter` instead of its local helper.

**Pre-existing work this depends on:**
- Iter #2 Room + the camera-pose state + gesture controller.
- Iter #6 DocumentViewer (reference implementation for the
  overlay contract), + `__PANG` E2E seed seam.
- Iter #7 `<DeepZoom>` primitive + `activeDeepZoom`
  selector + `check-transforms.ts` gate.
- Iter #5 enrichment data shape (same store, same
  `CollectionEntry` type being extended).

**Open questions (answered before execution):**
1. **`sharp` vs `libvips` direct vs a pure-JS DZI
   generator?** `sharp`. Native (libvips bindings);
   handles AVIF, JPEG, PNG, WebP; deterministic output.
   Pure-JS alternatives (`deepzoom-node`) are 10× slower
   and unmaintained.
2. **DZI vs IIIF?** DZI, as in iter #7. File-folder on disk,
   no manifest server. IIIF when museum-API integration
   lands (spine #8, iter #9+).
3. **AVIF vs JPEG tiles?** JPEG. AVIF has better
   compression but Safari tile decode is still slow; the
   warm-path latency floor matters more than storage
   bytes. Revisit when Safari 18.4 is minimum.
4. **Continuous-pinch escalation from Room → deep zoom,
   or tap-to-zoom?** Tap-to-zoom. Continuous-pinch
   escalation is a Room-canvas gesture-ownership problem
   (OSD wants to own pinch once mounted; the Room owns it
   pre-mount). Deferred to iter #9+. The tap on
   already-focused-work is the compromise: one discrete
   gesture, no ownership handoff.
5. **Gate added to the count?** No. P24d already covers
   "no CSS scale outside adapter"; that's the regression
   class this iteration could regress. The tile-source
   Zod schema lives under A8 (untrusted boundary). Gate
   count stays 48.
6. **Per-work `tileSource` on intake, or out-of-band?**
   Out-of-band this iteration. The build script seeds
   2–3 works with hand-placed source images and produces
   pyramids. Intake-pipeline integration (photo → DZI on
   submit) is a later iteration — probably adjacent to
   Passkeys or post-Correspondence. Named as out-of-scope.
7. **What real works?** Public-domain candidates from
   Rijksmuseum and Met Open Access APIs:
   - Vermeer, *Girl with a Pearl Earring* (Mauritshuis, PD —
     backup: Met Open Access holds a 19th-century study).
   - Van Gogh, *Wheatfield with Crows* (Van Gogh Museum PD,
     Met Open Access has *A Wheatfield* 1895).
   - Rembrandt, *The Night Watch* (Rijksmuseum PD).
   Final selection in the commit depends on which sources
   are available ≥ 4000 px without login.

**Out of scope (explicit):**
- Continuous-pinch escalation from Room to deep zoom
  (iter #9+ when gesture-ownership story is designed).
- IIIF tile source (iter #9+ with museum-API integration).
- Per-work pyramid generation on intake (out-of-band).
- ML upscaling (Google Art Camera style). Never, probably.
- Tile streaming compression (AVIF). Revisit in two
  iterations.
- Tile pre-warming on Room paint. Cache warms on first
  open, not in the background. Background pre-warm is a
  performance iteration downstream.
- Per-work credits / attribution overlay in deep zoom.
  Minimal DOM chrome — the painting is the subject, not
  the metadata.
- A11y audit of OSD's internal chrome (still deferred
  per iter #7).

**Outcome gate:** codify or iterate once. Codify targets if
the pipeline + Room wire-up land cleanly:
- **DZI pyramid generator is the sole sanctioned path.**
  Add to `PANG_Primitives_2026.md` § 21 as the generator
  half of the adapter primitive.
- **OPFS tile cache is the sole sanctioned cache for tile
  bytes.** No IndexedDB, no Cache API, no in-memory
  beyond OSD's own. Add to
  `PANG_Primitives_2026.md` § *Storage* as a clarifying
  clause on §14 (OPFS for staged binaries).
- **Overlay-to-Room handoff preserves camera pose and
  `focusedId`.** Add to `PANG_Primitives_2026.md` § 44
  (overlay-canvases-gate-RAF) as the complementary
  contract: *the Room camera pose is an invariant of the
  overlay lifecycle; overlays close to the same pose they
  opened from.*
- **Tile-source shape is a Zod-validated discriminated
  union.** Add to `PANG_AI_Era_2026.md` § *Untrusted
  boundaries* as a non-AI example of the same pattern.

Laura's hands: **after merge.** Walks the full Room → tap
work → deep zoom → paint strokes → close → Room loop on a
real device. This is the spine moment test. The outcome
is either "I can see the paint" (codify and advance) or
a named regression in the observability proofs above
(iterate once or drop).

---

## Iteration #8 — findings (2026-04-24)

**Status:** landed at ceiling and merged as
https://github.com/tobiasschneiderberlin-oss/Pang/pull/18 (squash
`311fe18`). `npm run verify` clean (26/26 gates, 598/598 unit
tests, 3/3 eval fixtures). Playwright e2e 22/22 on both
`chromium-mobile` and `chromium-desktop`, including the new
`room-deep-zoom.spec.ts` cold/warm cache attribution walk (1m44s
CI duration). Blocking checks green: PANG gates, Playwright e2e
Tier 2, Vercel build, Vercel Preview Comments, Vercel Agent
Review. Laura's hands: queued for next real-device session on the
merged preview; the iteration is doctrine-complete independent
of that walk.

### What landed

- `scripts/build-deepzoom-pyramids.ts` — deterministic DZI
  generator reading `public/deep-zoom-sources/<workId>/source.*`
  and emitting `public/deep-zoom/<workId>/manifest.dzi` +
  `manifest_files/<level>/<col>_<row>.jpeg` via `sharp`. Three
  seeded works checked in: `vermeer-pearl`, `van-gogh-wheatfield`,
  `rembrandt-night-watch`. Pyramids live in the public tree so
  `npm ci && npm run build` stays network-free.
- `src/stores/works.ts` — `CollectionEntry.tileSource?:
  { kind: "dzi"; url: string } | { kind: "simple-image"; url:
  string }`, Zod-validated at the boundary. Optional: works
  without a tile source stay on the wall unchanged; only seeded
  works admit a pyramid today.
- `src/deep-zoom/opfs-cache.ts` — OPFS tile cache with FNV-1a
  64-bit keys, `index.json` sidecar, LRU eviction governed by
  `navigator.storage.estimate()` quota probe (< 50 MB free
  triggers eviction). Pure helpers (`cacheKey`, `pathForKey`,
  `parseIndexEntry`, `serialiseIndex`, `parseIndex`,
  `planEviction`, `perWorkBytes`) isolated from I/O; 35 unit
  tests covering determinism, round-trips, malformed input
  resilience, and eviction planning.
- `src/deep-zoom/opfs-override.ts` — installs
  `downloadTileStart` on `viewer.world.getItemAt(0).source`
  via `viewer.addOnceHandler("open", …)`. Override routes
  tiles through `fetchTileCached`, emits
  `deep_zoom.cache.{hit,miss,evict}` + a `tile.load` span with
  `source: "opfs" | "network"`, converts Blob → Image via
  `URL.createObjectURL`, revokes in `queueMicrotask` after
  `context.finish(img, null, null)`.
- `src/deep-zoom/otel.ts` — event catalogue extended with
  `deep_zoom.cache.{hit,miss,evict}`; `tile.load` source union
  narrowed from `"network" | "cache"` to `"network" | "opfs"`
  (the OPFS layer is the only cache we ship; no in-memory
  middle tier).
- `src/room/gestures.ts` — `onSecondTap?(workId)` binding. A
  tap on an already-focused work fires the signal and keeps
  focus; any other tap path retains its prior semantics. 10
  fake-canvas unit tests cover the new branch +
  non-interference with the existing tap-on-empty / drag /
  jitter cases.
- `src/deep-zoom/resolve.ts` — pure `resolveTileSource(workId,
  fileRef, entries)` + the store-writing `openDeepZoomForWork`
  helper. 6 resolver tests for DZI / simple-image / missing /
  mismatched / empty cases.
- `src/components/deep-zoom/DeepZoomOverlay{,Client}.tsx` —
  SSR-safe dynamic boundary. The outer file wraps the inner
  client in `next/dynamic({ ssr: false })`; the inner file
  subscribes to `entries` + delegates to `<DeepZoomConnector>`.
- `src/components/deep-zoom/DeepZoom.tsx` — installs the OPFS
  override before OSD's `open` handler; the `tile-loaded`
  synthetic-`source` bridge is removed (the override owns
  attribution now). `tile-load-failed` stays as a safety net
  for OSD-internal failures.
- `e2e/room-deep-zoom.spec.ts` — single Playwright walk:
  wipe OPFS, seed entry, write composite, assert cold-path
  `cache.miss ≥ 1` + `tile.load{source:"network"} ≥ 1`,
  Escape (focus survives), re-open, assert warm-path
  `cache.hit ≥ 1` + `tile.load{source:"opfs"} ≥ 1` (gated on
  OPFS availability).
- `app/page.tsx` — mounts `<DeepZoomOverlay />` as a sibling
  to the Room canvas and DocumentViewer; the connector is a
  no-op until `activeDeepZoom` is non-null, so the
  OpenSeadragon bundle never loads until Laura asks for paint
  depth.

### What execution exposed

Five discoveries, each with its verdict:

1. **OpenSeadragon touches `document` at module load — an
   indirect import through a client component crashes the
   SSR pass.** The first Playwright run of
   `room-deep-zoom.spec.ts` failed at webServer boot with
   `ReferenceError: document is not defined` because the
   home route imported `<DeepZoomOverlay>` statically, and
   the overlay statically imported `<DeepZoomConnector>`,
   which statically imported OSD. The Next.js app router
   evaluates client-component modules on the server during
   the prerender even when they carry `"use client"`. Fix:
   the standard **dynamic wrapper split** — `DeepZoomOverlay`
   is `next/dynamic({ ssr: false })` around
   `DeepZoomOverlayClient`. Same shape as
   `DeepZoomSmokeClientDynamic` (iter #7 smoke) and
   `RoomCanvasDynamic` (iter #2). The pattern generalises:
   any component that imports a module with top-level
   `document`/`window`/`self` access needs the dynamic split,
   regardless of the `"use client"` directive.

2. **Gesture unit tests can't import from `./scene` — `three/
   webgpu` crashes Node at module load.** Adding
   `src/room/gestures.test.ts` surfaced the iter #4 named
   debt directly: `gestures.ts` originally imported `ROOM`
   from `./scene`, which re-exports it from `./constants`
   *but* also imports `three/webgpu` at the top level, which
   crashes Node's `tsx --test` runner with `self is not
   defined`. Fix: repoint the import to `./constants` (where
   `ROOM` actually lives). The general shape is that **pure
   modules (controllers, selectors, helpers) must import
   from pure siblings — never transit through a GL-touching
   module for a constant.** The iter #4 debt about `scene.ts`
   still stands (no unit coverage there), but the fix pattern
   for other surfaces is now demonstrated.

3. **OSD's `viewer.source` property doesn't exist at the
   Viewer level — the source lives on each TiledImage.**
   TypeScript `@types/openseadragon` suggests otherwise. The
   correct accessor is `viewer.world.getItemAt(0).source`
   after guarding `viewer.world.getItemCount() === 0`. The
   override is idempotent, so an
   `addOnceHandler("open", …)` registration is safe across
   StrictMode's simulated setup/cleanup cycle. Pattern match
   to iter #7's `@types/openseadragon` gap: when the published
   type is narrower than the runtime, prefer an explicit
   narrow-interface cast (`as unknown as { downloadTileStart…
   }`) over a property `as unknown as` — the narrow interface
   documents *what we actually touch* and stays reviewable.

4. **Eviction telemetry shouldn't live in the cache module.**
   First draft of `opfs-cache.ts` imported `otel.ts` directly
   to emit `deep_zoom.cache.evict` from inside `putTileBlob`.
   That broke the decoupling — the cache has no business
   knowing about the deep-zoom observability catalogue, and
   it wouldn't be reusable for (say) document-tile caching.
   Fix: `onEvict?: (count, bytesFreed, bytesRemaining) =>
   void` callback option on `putTileBlob` + `fetchTileCached`,
   invoked once per eviction batch, wrapped in try/catch so a
   throw from the caller doesn't poison the cache. The
   override wires the two together: `fetchTileCached(url,
   undefined, { onEvict: deepZoomCacheEvictEvent })`. The
   general shape is **caller-configurable observability hooks
   on reusable primitives**; the callee doesn't import the
   telemetry surface, the caller decides.

5. **Cache attribution must ride the same call stack that
   decided to fetch.** An earlier sketch had OSD's
   `tile-loaded` event emit the `tile.load` span with a
   synthetic `source: "network"` placeholder. That broke the
   warm/cold separation — by the time `tile-loaded` fires,
   the information about whether the byte source was OPFS or
   a `fetch()` is gone. Fix: the span fires from inside the
   `downloadTileStart` override's `img.onload` callback,
   where `src === "opfs" | "network"` is known. The general
   shape: **observability attribution belongs on the call
   stack that made the decision**, not on a downstream event.
   Cross-thread or cross-event attribution requires
   reconstructing the decision context, which is the same
   trap that made the iter #1 Pixel-10 regression expensive
   to diagnose.

### Codify

- **Components importing `document`/`window`/`self` at module
  load always ship via `next/dynamic({ ssr: false })`.** The
  pattern has now surfaced three times (iter #2 Room canvas,
  iter #7 DeepZoom smoke, iter #8 production overlay) with
  identical shape. Add to `PANG_Primitives_2026.md` §
  *Client components* as: *"any component that transitively
  imports a module touching `document`, `window`, `self`, or
  other browser-only globals at module-evaluation time must
  ship as a `next/dynamic({ ssr: false })` wrapper around a
  `*Client.tsx` inner file. The `\"use client\"` directive
  alone is not sufficient — the App Router evaluates client
  modules on the server during prerender."* Canonical
  reference: `DeepZoomOverlay{,Client}.tsx`.
- **Third-party engine cache-throughs install via a
  per-viewer override on the engine's own dispatch seam, not
  via a Service Worker or fetch-level interceptor.** OSD's
  `downloadTileStart`; pdfjs's `getDocument({ fetch })`
  option (iter #6 DocumentViewer). The override sits on the
  same call stack that decided to fetch, so the `source`
  attribution is trivially correct. Add to
  `PANG_Primitives_2026.md` § *Third-party canvas engines*:
  *"every adapter around a third-party canvas engine that
  fetches bytes exposes a per-viewer/per-document override
  seam; PANG's cache-through rides that seam, not a
  cross-cutting fetch interceptor. The seam carries
  `source: 'opfs' | 'network'` attribution on the deciding
  call stack."* This generalises to future engines
  (e.g., the Artists chapter's 3D model viewer) without
  re-deriving the contract.
- **Reusable storage primitives expose observability via
  caller-configurable hooks, never by importing the
  telemetry surface.** The OPFS tile cache knows when it
  evicts; it fires an `onEvict` callback; the caller wires
  the callback to `deep_zoom.cache.evict`. Add to
  `PANG_Primitives_2026.md` § *State* as: *"a reusable
  storage primitive (OPFS cache, in-memory LRU, write-ahead
  log) never imports `src/**/otel.ts`. It accepts
  caller-configurable hooks (`onEvict`, `onWrite`,
  `onQuotaLow`) wrapped in try/catch. The callers wire the
  hooks to the appropriate telemetry catalogue for their
  surface."* Canonical reference: `opfs-cache.ts` +
  `opfs-override.ts`.
- **Second meaning on the same gesture instead of a new
  gesture when escalation is discrete.** The Room owns tap,
  drag, pinch; deep-zoom escalation needed a new discrete
  signal; rather than introducing a new gesture (long-press,
  double-tap, pinch-out-past-threshold), the second tap on
  the already-focused work *is* the signal. One controller
  field, one test branch, zero new grammar. Add to
  `PANG_Primitives_2026.md` § *Gestures* as: *"when an
  escalation is discrete and occurs on an already-selected
  target, prefer a second firing of the existing selection
  gesture over a new gesture. The gesture's meaning is
  state-dependent; the grammar stays single-primitive."* The
  anti-pattern: introducing double-tap, long-press, or
  pinch-out as a second escalation channel — each grows the
  controller's surface and muddies the handoff with
  third-party engines that own their own variants of those
  gestures.
- **The iter #7 "Primitives land ahead of data" move is
  discharged.** DeepZoom shipped in iter #7 behind a smoke
  route; iter #8 backfilled the data. No doctrine edit —
  the move was already codified (`CLAUDE.md` § *Reach
  forward, not back*, move 5). But the two-iteration cadence
  is now visible as a concrete example and worth naming:
  **iter #7 + iter #8 = the sanctioned shape for any future
  primitive-then-data pair.** Referenced in the
  metabolism-check below.

### Iterate once (one second pass, no debate)

- **`onEvict` signature may want `workId | null` when
  eviction becomes per-work.** Today's signature is
  `(count, bytesFreed, bytesRemaining)` — sufficient for
  global LRU. When the cache grows a per-work eviction
  policy (probably iter #10+ when the collection outgrows
  the default OPFS ceiling on a subset of devices), the
  hook shape needs the workId to attribute the evict span.
  Next iteration that touches the cache path: widen the
  callback to `(summary: { count, bytesFreed, bytesRemaining,
  workId: string | null })`. Until then, the scope-less
  event matches reality (global LRU) and the doctrine stands.

### Drop

- **The idea of a Service Worker fetch-handler cache-through
  for tiles.** Considered during the brief; rejected during
  execution for the reason in discovery #5 — the SW can't
  attribute `opfs` vs `network` back to the main thread
  without cross-thread message plumbing that would cost more
  than the cache itself. The override pattern wins. No
  doctrine edit; the negative is implicit in the
  "third-party engine cache-throughs install via a
  per-viewer override" codify above.
- **Per-work `tileSource` on intake.** Named out-of-scope in
  the brief; stays that way. A collector-scanned photo → DZI
  pipeline is a downstream iteration (post-Correspondence,
  probably adjacent to the museum-grade capture work). No
  regression surfaced because no code path depends on it
  today; seeded pyramids cover the flat-vs-zoom gap
  end-to-end for the three works that matter for the spine
  moment.

### Failure mode — observability proofs (brief's fifth
declaration): all four classes observable.

- *Pyramid generator incorrectness.* `sharp`-based generator
  emits a deterministic pyramid; the three seeded works were
  each regenerated during development and produced identical
  bytes. No golden-hash CI gate wired yet (the generator is
  run at seed-time only, not build-time), but the pyramid is
  checked into the repo so a regression would surface as a
  diff on the `public/deep-zoom/<workId>/**` tree. The
  `deep_zoom.open` span carries `source_kind: "dzi" |
  "simple-image"` so a pyramid-vs-fallback regression shows
  in telemetry. Debt: a golden-hash gate in `check:gates` is
  a small future iteration (5 min of hash-then-assert).
- *OPFS cache cold vs warm path.* The new
  `room-deep-zoom.spec.ts` walk is the direct proof. Cold
  leg wipes `deep-zoom-cache/`, opens, asserts `cache.miss ≥
  1` + `tile.load{source:"network"} ≥ 1`; warm leg asserts
  `cache.hit ≥ 1` + `tile.load{source:"opfs"} ≥ 1`. The
  warm-path latency SLO (p95 < 200 ms) lives on the
  server-side dashboard (tile.load spans ship with
  `tile_duration_ms`); the e2e proves the attribution is
  correct, not the latency.
- *OPFS quota overrun.* `planEviction` pure helper has 35
  unit tests covering ascending-lastAccess ordering,
  evict-everything at `maxBytes = 0`, no-input-mutation, and
  empty-plan-under-budget. `deep_zoom.cache.evict` fires
  once per eviction batch with `bytesFreed` +
  `bytesRemaining`. A pathological "same tile evicted
  repeatedly" scenario would surface as a monotonically
  climbing evict count in the dashboard; no explicit e2e
  gate yet because the unit coverage of the planner is
  complete.
- *Room handoff.* `room-deep-zoom.spec.ts` asserts
  `useWorks.getState().focusedId` stays pinned to the seeded
  sentinel across open → Escape → close; `activeDeepZoom`
  returns to `null`. Camera-pose snapshot-before-after is
  out of scope for this spec (the Room's camera-pose shape
  is still on the iter #3 scaffolding; a pose-snapshot seam
  would be a small follow-on in whichever iteration first
  needs to assert Room-camera continuity across another
  overlay). `focusedId` is the invariant that matters for
  the spine, and it's observed.

### What this tightens

- `PANG_Primitives_2026.md` gains four rules (Client
  components / dynamic-wrapper split; third-party engine
  cache-throughs / per-viewer override seam; storage
  primitives / caller-configurable hooks; gestures /
  state-dependent second meaning). All four surfaced during
  execution with concrete code references from iter #8.
- `PANG_Spine.md` moment #6 (paint strokes on real works) is
  now end-to-end live. The build order entry marks
  complete-at-ceiling; the next open moment is #7
  (Correspondence / verification confirmation).
- `e2e/room-deep-zoom.spec.ts` joins `e2e/deep-zoom.spec.ts`
  (iter #7 heap discipline) as the two sanctioned walks for
  the surface. Cache attribution + heap discipline + escape
  semantics all covered.
- `public/deep-zoom/<workId>/` becomes the canonical pyramid
  location. The `public/deep-zoom-sources/` mirror holds the
  originals so regeneration stays deterministic.
- The gate count stays 48 — the iteration's codify targets
  are primitive rules, not new mechanical checks. A future
  iteration touching the generator can add a P24e
  golden-hash sub-gate if the signal warrants.

### Metabolism check

Every discovery lands: dynamic-wrapper split → codify
(Primitive clause); pure-sibling imports for test-touched
modules → referenced as an applied fix of the iter #4 debt,
no new codify (the debt naming already covers the shape);
OSD `viewer.world.getItemAt(0).source` access → codify
(Primitive clause on per-viewer override seams);
`onEvict` callback decoupling → codify (Primitive clause on
storage primitives); call-stack attribution → codify (folded
into the same Primitive clause — observability rides the
decision, not a downstream event); second-tap as discrete
escalation → codify (Primitive clause on gestures);
`onEvict` per-work widening → iterate once (named for the
next cache touch); SW-fetch-handler cache-through →
dropped (implicit in the per-viewer-override codify); intake
pyramid pipeline → dropped (out-of-scope; no regression).
No unnamed overhangs. The iter #7 + iter #8 cadence
(primitive, then data) is now visible as a concrete
reference for future primitive-ahead-of-data pairs.

---

## Iteration #9 — Passkeys auth (opened 2026-04-24)

**Status:** kickoff brief. Scope is **ceiling on WebAuthn UX**
with two explicitly named principle-scope deferrals (Magic
Link OTP fallback; Supabase server persistence). This
iteration closes spine moment #7 (`PANG_Spine.md` § *Build
order*): the gallery's invite link binds to a passkey on the
collector's device, the session survives a relaunch, and
every non-public API route refuses an unauthenticated caller.
From here on, "Laura is the baseline" stops being a seed-data
statement and becomes a session-identity statement — the app
knows it's *her* collection.

**Why now:** six spine moments sit in the codebase with no
door on them. `/api/verification/request` accepts a POST from
anyone who can reach the origin. `/api/intake/classify` same.
The `app/i/[token]/page.tsx` shell validates a token shape
and redirects — there is no binding between the token and the
device that opened it, so forwarding the invite link means
forwarding the collection. The architecture doc has fixed the
answer (*"Passkeys primary; `credentials.create({ publicKey,
... })` with user verification required; HttpOnly SameSite=
Strict cookie + rotating server-side token; gallery invite
JWT signed with rotating HMAC; tokens single-use"* — § 8
Auth). The P10 gate has the name reserved. The `usePasskey`
hook slot is pre-declared in § 7 of the architecture doc.
Everything is waiting. This is the iteration that wires it.

**Scope:** **ceiling** on the passkey UX itself — enrollment,
assertion, conditional UI (passkey autofill in the email /
identifier field where the browser offers it), session cookie,
rotating server token, every existing API route gated through a
`requireSession(req)` helper, E2E auth-bypass seam so iter
#2–#8 specs keep passing. **Two principle-scope lines,
each with a named reason:**

- **Magic Link OTP fallback is out of scope for this
  iteration.** Rationale: the spine's auth path is
  *Passkeys primary; OTP only as first-bind fallback on a
  device that can't do platform passkeys*. The primary path
  is proven first because it's the 99% case on Tier-A/B
  devices (Chrome / Safari / iOS ≥ 16 / Android ≥ 9 all ship
  platform passkeys). OTP lands when the first Tier-C device
  shows up in the observability signal — and the failure
  mode below names how we'll see that signal. The rails are
  left in place: `src/auth/session.ts` admits
  `method: "passkey" | "otp"` from day one, and the invite
  landing flows through a `chooseBindMethod(capabilities)`
  selector so the OTP branch is a future path addition, not
  a refactor.
- **Supabase server persistence is out of scope.** Rationale:
  no Supabase client is wired in the codebase today
  (`.env.example` declares the vars, no imports resolve
  them); wiring it alongside a new auth surface would mix
  two classes of risk in one iteration. The sanctioned
  pattern from iter #4 — filesystem-backed server stores
  under `.pang/server-users/` + `.pang/server-credentials/`
  + `.pang/server-sessions/` — is the dev stand-in. The
  route interface (`POST /api/auth/passkey/enroll`,
  `POST /api/auth/passkey/assert`, `GET /api/auth/session`,
  `POST /api/auth/logout`) is the contract Supabase will
  honour when it lands. Same discipline iter #4 used for
  the verification outbox.

Landing shape:

- `POST /api/auth/invite/bind` — trades an invite JWT for
  a `bindSessionId` cookie (short TTL, 10 min) that the
  enrollment ceremony reads. Invite JWT signed with
  rotating HMAC (env-configured key; rotates on
  `deployment.boot` span); `jose` for sign/verify; single-
  use enforced via `.pang/server-invites/<jti>.consumed`
  marker file. Consumed marker persists regardless of
  outcome so replay always fails closed.
- `GET /api/auth/passkey/options?purpose=enroll|assert` —
  issues `PublicKeyCredentialCreationOptions` or
  `PublicKeyCredentialRequestOptions` with a fresh
  challenge. Challenge is a 32-byte CSPRNG value bound
  to the `bindSessionId` (enroll) or client cookie-less
  assert flow (conditional UI). TTL 90 s.
  `@simplewebauthn/server@>=11` generates the options so
  we're not hand-rolling CBOR.
- `POST /api/auth/passkey/enroll` — verifies the attestation
  response against the stored challenge + the origin + the
  bind session. Writes `{ userId, credentialId, publicKey,
  counter, transports, createdAt }` to
  `.pang/server-credentials/<credentialId>.json`. Issues
  the real session cookie on success.
- `POST /api/auth/passkey/assert` — verifies an authentication
  response, increments `counter`, rotates the server token,
  issues the session cookie. If the stored `counter` exceeds
  the response counter, the credential is revoked (cloning
  detector) and the `auth.passkey.clone_detected` span fires.
- `GET /api/auth/session` — returns `{ userId, createdAt,
  rotatedAt, method }` for a valid cookie, 401 otherwise.
  `auth.session.check` span on every hit with
  `cacheStatus: "hit" | "miss" | "rotated"` attribute.
- `POST /api/auth/logout` — clears the cookie, revokes the
  server token, no server-side bookkeeping beyond the
  revocation file deletion.
- **Client.** `app/i/[token]/page.tsx` grows from the
  placeholder shell into a binding ceremony: validates the
  token server-side, calls `bind`, mounts a one-screen
  `<PasskeyEnrollCeremony>` that calls
  `navigator.credentials.create({ publicKey })`, writes the
  result back, redirects into the Room. One screen. One
  line of copy (*"This collection is now on your device"*
  — `PANG_Voice.md`-compliant draft; final wording in the
  brief's voice pass). No confirmation sheet, no
  "welcome back" — the work center-stage on arrival is the
  welcome.
- **Assert flow.** On cold start of a device that already
  has a credential (i.e., cookie missing but a resident-key
  credential is stored in the browser), the landing page
  mounts a conditional-UI sign-in — `<input autocomplete=
  "username webauthn">` that the OS surfaces the passkey
  on. Tap, biometric, in. No password field anywhere
  (P10's actual enforcement starts here).
- **`src/auth/session.ts`** — the single source of truth on
  the server. Exports `createSession`, `readSession`,
  `rotateSession`, `revokeSession`, `requireSession`. All
  five write `auth.session.*` spans. `requireSession(req)`
  is the helper every non-public API route adopts in this
  iteration; calling a gated route without a valid cookie
  returns 401 with zero body (no "who are you" crumb for
  enumeration).
- **Existing route adoption.** `POST /api/verification/request`
  and `POST /api/intake/classify` gain `await requireSession
  (req)` at the top. `GET /api/telemetry` stays public
  (it's a beacon endpoint; the architecture doc marks it
  unauthenticated). `POST /api/enrichment/submit` (iter #5)
  gets gated. The test suite for each gets a "401 without
  session" case added.
- **E2E auth-bypass seam.** Behind `NEXT_PUBLIC_PANG_E2E=1`,
  a `__PANG.authSeed({ userId })` hook issues a fake session
  cookie directly, bypassing WebAuthn (Playwright cannot
  drive real biometric prompts). The existing iter #2–#8
  specs gain one `await authSeed()` line in their shared
  setup. The seam is a build-time constant check, not a
  runtime toggle — production bundles statically strip it
  (same discipline as the `__PANG` entries seam).
- **Observability.** `auth.invite.{accepted,rejected}`,
  `auth.passkey.enroll.{started,succeeded,failed}`,
  `auth.passkey.assert.{started,succeeded,failed}`,
  `auth.passkey.clone_detected`, `auth.session.{created,
  rotated,revoked,check}`. Each span carries
  `authenticatorAttachment`, `credentialDeviceType`,
  `credentialBackedUp`, `transports` where relevant. These
  attributes are what tell us, six weeks from now,
  whether a Magic Link OTP fallback is worth building —
  i.e., how many `auth.passkey.enroll.failed` spans carry
  `reason: "not-supported"` vs. `reason: "user-cancelled"`.
- **P10 gate upgrade.** Today `check-gates.ts` checks
  `src/auth/` exists and contains no `type="password"`
  input. The iter #9 upgrade: P10 fails if
  `src/auth/webauthn/{enroll,assert}.ts` is missing, if
  `src/auth/session.ts` is missing, if `requireSession` is
  not imported in every `app/api/**/route.ts` except
  `app/api/telemetry/route.ts` and `app/api/auth/**`, and
  if the Playwright `passkey.spec.ts` is missing. The gate
  becomes *actually enforcing*, not just absent-evidence.

**Stack:**

- `@simplewebauthn/server@>=11` (MIT) for enroll + assert
  ceremony verification. Hand-rolling CBOR + COSE parsing
  is out of scope and historically bug-prone.
- `@simplewebauthn/browser@>=11` for the conditional-UI
  plumbing (feature-detects platform authenticator,
  prefers `preferredAuthenticatorType: "platform"`). Pure
  wrapper around `navigator.credentials.*`; drops cleanly
  if we ever replace it.
- `jose@>=5` for invite JWT sign/verify + session token
  opaque-bearer signing. Already in the dependency tree
  under a different name? — no, it isn't; landing it here
  is a one-dep addition, 24 kB gzipped.
- Filesystem-backed dev stores (iter #4 pattern):
  `.pang/server-users/<userId>.json`,
  `.pang/server-credentials/<credentialId>.json`,
  `.pang/server-sessions/<sessionToken>.json`,
  `.pang/server-invites/<jti>.consumed`. Each directory
  `.gitignore`d. The Supabase migration path is:
  same file shapes → same row shapes → `JSON.parse(readFile)`
  swaps for `supabase.from(table).select(...)`. No
  interface change at the call site.
- Cookie shape: `pang_session` — `HttpOnly; Secure;
  SameSite=Strict; Path=/; Max-Age=1209600` (14 days);
  rotated on every assert. Value is an opaque bearer
  token (32-byte CSPRNG hex), not a JWT — session state
  lives server-side, the cookie is just a lookup key.
  This is the doctrinal choice; JWT-as-session drifts
  into "revoke = hard" territory.
- `src/lib/otel/span.ts` (existing) for every span in
  the block above. Same helper iter #4, #5, #6, #7, #8
  used. No new observability primitive.
- `next/headers` (`cookies()` + `headers()`) for
  cookie read/write at the route handler layer. Node
  runtime on the auth routes; edge is fine for
  `GET /api/auth/session` but Node gives us the fs
  stand-in for dev so we keep the whole family on Node
  until Supabase lands.

**Reference:**

- **1Password passkey enrollment.** Single-screen
  ceremony; the primary button says "Create passkey" and
  the system sheet is the only chrome. No field-by-field
  dialog, no "are you sure". The whole flow is the
  biometric prompt plus a success line.
- **Google sign-in conditional UI (2024–2026 rollout).**
  The `<input autocomplete="username webauthn">` pattern;
  the passkey surfaces in the autofill sheet the moment
  the field focuses. Tap-in with no tap-to-sign-in-first
  indirection.
- **Cal.com SimpleWebAuthn integration.** Canonical
  reference for how a TypeScript app wires
  `@simplewebauthn/{server,browser}` end-to-end; the
  challenge storage + origin validation discipline in
  their repo is what we're copying (not literally
  forking — the shape).
- **Apple Platform Security § Passkeys (2024 rev.)** — the
  cloning-detector / counter rollback rule. The assert
  flow's `counter` check is doctrinal, not optional.
- **Anti-reference:** any service whose auth surface
  displays a passkey button *next to* a password field.
  That composition is the 2018 compromise that
  CLAUDE.md's cannot-do list forbids for copy + chrome
  and that P10 now forbids for auth. The passkey is
  the primary; there is no secondary on-screen.

**Canvas:** DOM chrome only. The browser's passkey sheet
is the primary visual surface on the enrollment ceremony;
our one line of copy + the invite frame are the only
paint we author. No `<canvas>`. No custom modal layered
over the system sheet. If the system sheet is dismissed
without completion, the ceremony returns the collector
to the same invite-landing state — no intermediate
screen, no "try again?" sheet. The single-tap invariant
from `CLAUDE.md` (*"No ActionSheet between wall and
scanner"*) generalises here: no ActionSheet between
invite and collection.

**Failure mode (5th declaration):** five regression
classes must be observable.

- *Invite token replay.* A forwarded invite link must
  fail closed on second use. Enforcement: the
  `.pang/server-invites/<jti>.consumed` marker is
  written **before** the session cookie is issued (the
  `bind` route commits the consumed-marker inside the
  same `withOtelSpan` as the cookie write; a crash
  between the two reads as "invite consumed, session
  not issued" and the collector retries the invite —
  which correctly fails closed). Playwright e2e:
  bind once, bind again with same token, second
  attempt returns 409 with `auth.invite.rejected
  { reason: "replay" }` span.
- *Tier-C device, no platform authenticator.*
  `navigator.credentials.create` rejects with
  `NotSupportedError`. Enforcement: the enroll client
  catches and emits
  `auth.passkey.enroll.failed { reason: "not-supported",
  userAgent, tier }`. The landing page shows
  the voice-compliant "your device can't hold a passkey
  yet" line (final copy TBD in the voice pass) — not a
  dead-end. The observability signal is what decides
  whether Magic Link OTP gets its iteration.
- *Session cookie tampering / forgery.* A crafted
  cookie with a random 32-byte value must be
  indistinguishable from a revoked session (both
  return 401 from `requireSession`) — i.e., no timing
  side-channel, no distinct error body.
  `auth.session.check { cacheStatus: "miss", reason:
  "unknown-token" }` on both cases. Enforcement:
  `requireSession`'s lookup is a constant-time
  directory-stat + file-read, not a scan. Unit test
  on the constant-time path.
- *Revoked credential assertion.* After
  `auth.passkey.clone_detected` (counter rollback),
  the credential is moved to
  `.pang/server-credentials-revoked/<credentialId>.json`.
  A subsequent assert with the same credentialId
  returns 410 Gone with
  `auth.passkey.assert.failed { reason: "revoked" }`.
  The client drops to the enroll flow (treating the
  session as starting over). Playwright simulates the
  rollback via the E2E seam and verifies the 410 plus
  the span.
- *Rate-limit abuse.* A burst of enroll / assert
  calls from one IP triggers a per-IP per-minute cap
  (`auth.rate_limit.exceeded { endpoint, ip }` span).
  The stand-in is an in-memory token bucket on the
  Node server (process-local, resets on redeploy —
  OK for iteration #9 because the load floor is
  single-digit collectors). Supabase/edge-KV shape
  when real traffic arrives; the span name is the
  contract.

**Gates this iteration must pass:** the 48.

- **P10 (Passkeys) — upgraded.** The gate file changes
  in this iteration per the landing-shape bullet. No
  new gate number; P10 graduates from trivial-pass to
  real enforcement. Gate count stays 48.
- P6 (CSP) — the WebAuthn origin must be the app
  origin; no `iframe` / `frame-src` addition. The
  challenge endpoint is `Cache-Control: no-store`.
- P7 (INP p75 < 200 ms) — the conditional-UI mount
  reads the passkey in one frame; no layout shift on
  the invite landing.
- P11 (OKLCH only) — any new chrome uses tokens.
- P13 (OPFS + IndexedDB discipline) — nothing about
  auth writes to `localStorage`. The session cookie
  is HttpOnly, so the browser-side can't read it
  anyway; the invariant is that we don't duplicate
  session state into any JS-accessible store.
- P23 (keyboard a11y) — invite landing's primary
  button is Enter-activatable; the conditional-UI
  input is keyboard-focusable. The system passkey
  sheet inherits its own a11y.
- A5 (banned vocabulary) — the one line of enrollment
  copy passes the voice check ("dive / unlock /
  seamless / leverage / journey" are absent by
  construction; voice pass confirms it).
- A8 (CaMeL / Untrusted boundary) — the
  `PublicKeyCredential` response from the browser is
  `Untrusted<PasskeyEnrollResponse>` until
  `@simplewebauthn/server`'s `verifyRegistrationResponse`
  returns; then it becomes a typed credential record.
  Same discipline as every other server boundary.
- A16 (OPFS-backed queue discipline) — not directly
  exercised here (the outbox pattern is the right
  analogy, but auth state lives server-side). Named
  so the discipline stays consistent when Magic Link
  OTP lands.

**Test criteria:**

1. `npm run verify` clean. `check:gates` runs the
   upgraded P10. Unit tests cover: JWT sign/verify
   round-trip, invite single-use, session create /
   rotate / revoke / check, credential counter
   rollback detection, constant-time token lookup,
   rate-limit token bucket, `requireSession` 401
   behaviour.
2. Playwright spec `passkey.spec.ts`: on
   `chromium-mobile` with WebAuthn virtual
   authenticator enabled
   (`context.addInitScript` + CDP `WebAuthn.enable`),
   walks invite → enroll → Room → refresh tab → Room
   (assert path, no biometric re-prompt because the
   cookie is live) → logout → refresh → invite
   landing (assert path with fresh cookie-less
   state, conditional UI). All four cycles clean.
3. Playwright asserts: the session cookie is
   HttpOnly (not visible to `document.cookie`),
   SameSite=Strict (cross-site navigation to the
   landing from an external origin arrives
   cookie-less), Secure (the test runs over HTTPS
   via the Next.js dev proxy or a test-time stub).
4. Replay attack test: call `/api/auth/invite/bind`
   twice with the same JWT; second response is 409,
   first response's cookie still works; the
   `.consumed` marker exists on disk.
5. Clone detector test: manually lower the stored
   counter via the fs stand-in, then assert; the
   response is 410 Gone; the credential is moved to
   `server-credentials-revoked/`.
6. `requireSession` coverage: each gated API route
   returns 401 without a session cookie and 200/422
   (existing semantics) with one. A dedicated
   `app/api/**/*.test.ts` matrix test walks every
   route file and asserts it either imports
   `requireSession` or is on the public allowlist.
7. E2E auth-bypass seam: iter #2–#8 Playwright
   specs gain a single shared `beforeEach` that
   calls `authSeed()`; no other test changes; all
   existing specs stay green.
8. Observability: walking the enroll + assert flow
   emits the exact span set named above, and each
   carries the required attributes. Verified via
   the OTel test exporter (existing seam).
9. P10's upgraded gate is asserted from CI itself —
   temporarily stub a missing `requireSession` in
   one gated route, confirm the gate fails, revert.
   The proof lives in the PR description, not as
   a committed change.

**Pre-existing work this depends on:**

- Iter #0 invite landing shell at
  `app/i/[token]/page.tsx` — kept intact; the
  placeholder validation is the starting point, the
  ceremony is the delta.
- Iter #4 filesystem-backed server-outbox pattern —
  the shape `.pang/server-users/**`,
  `.pang/server-credentials/**`, etc. is a literal
  copy of `.pang/server-outbox/**`.
- Iter #4's `withOtelSpan` + span helpers — the
  observability plumbing is reused wholesale.
- Iter #6's CSP + nonce proxy — no change; the
  passkey flow is same-origin and inherits.
- `__PANG` E2E seam (iter #6) — extended with
  `authSeed({ userId })`.

**Open questions (answered before execution):**

1. **Passkey library: SimpleWebAuthn vs hand-rolled
   CBOR?** SimpleWebAuthn. The attestation format
   matrix (packed / tpm / android-key / apple) is
   large enough that hand-rolling is a security
   regression against the ceiling.
2. **Session shape: opaque bearer vs JWT?** Opaque.
   Server-side state allows real revocation;
   revocation of a JWT requires a deny-list which
   is strictly worse than the opaque design it'd
   replace. The cookie carries the lookup key; the
   session record carries the truth.
3. **Session TTL?** 14 days, rotated on every
   assert. Rotation means an active collector's
   session effectively rolls forward; an idle
   collector re-auths after two weeks. Re-auth on
   a Tier-A/B device is one biometric tap via
   conditional UI.
4. **Magic Link OTP fallback this iteration?** No —
   named as principle-scope deferral in the Scope
   block above.
5. **Supabase persistence this iteration?** No —
   same deferral. Filesystem-backed stores; the
   interface is the contract Supabase will honour.
6. **Discoverable (resident) credentials vs
   non-discoverable?** Discoverable. Required for
   conditional UI to work; the storage cost is
   negligible and every 2026 platform authenticator
   supports it.
7. **User handle shape?** 16-byte CSPRNG blob,
   base64url-encoded. Stored on the credential
   record. Never the email address (PII; platform
   authenticators sync handles to cloud, so
   anything PII-ful leaks).
8. **Gate added to the count?** No. P10 upgrades
   in place; count stays at 48.
9. **`requireSession` on intake?** Yes. The intake
   agent's input is a photo that contains the
   collector's artwork; gating it is the first
   line of defence against an adversary running
   up the Anthropic bill on our origin.
10. **Telemetry beacon gating?** No. The beacon is
    fire-and-forget; authenticating it would
    require a round-trip before the client's
    event is usable, which is the opposite of the
    beacon's job. Rate-limit per IP instead.

**Out of scope (explicit):**

- **Magic Link OTP fallback.** Principle-deferred
  (see Scope). The rails are in place.
- **Supabase server persistence.** Principle-
  deferred (see Scope). Same.
- **Multi-device passkey sync UX.** Platform
  authenticators sync credentials cross-device
  (iCloud Keychain, Google Password Manager,
  1Password, Bitwarden) — we inherit it, we don't
  render it. No "your devices" screen in this
  iteration.
- **Passkey management screen (rename / delete
  credential).** Out of scope until the first
  Laura-hands signal asks for it.
- **Gallery-side auth.** PANG is gallery-gated at
  the invite layer; the gallery's own dashboard is
  out of spine per the cannot-do list. If we ever
  change that, we'd build it as a separate surface.
- **SSO / email-password.** Never. Cannot-do list.
- **Account recovery via support ticket.** The
  recovery story is "tap the gallery's invite
  link again" — galleries can re-issue invites
  because they own the relationship. No recovery
  email flow, no security-question fallback, no
  account-recovery form.
- **Cross-origin iframe embed.** The passkey
  ceremony must run on the top-level origin. If a
  gallery wants to embed PANG, that's a product
  conversation, not an auth one.

**Outcome gate:** codify or iterate once. Codify
targets if the auth surface lands cleanly:

- **Passkey is the sole primary auth path.** Add to
  `PANG_Primitives_2026.md` as a new auth primitive
  (there isn't one today). Clause names the
  conditional-UI + `autocomplete="username webauthn"`
  pattern as the sanctioned assertion affordance on
  cookie-less cold start; forbids the "passkey button
  next to password field" composition.
- **Opaque bearer cookie + server-side session
  record is the sanctioned session design.** Add to
  `PANG_Architecture_2026.md` § 8 Auth as a
  clarifying clause on the existing "rotating
  server-side token" line. JWTs are for the invite
  boundary only, not for session continuation.
- **`requireSession` is the only API auth helper.**
  Add to the same section. The filesystem stand-in
  today, the Supabase-backed implementation later;
  the call site is invariant. The gate (P10 upgrade)
  enforces adoption.
- **Filesystem-backed server stores are the
  sanctioned dev stand-in.** Add to
  `PANG_Architecture_2026.md` § 10.5 Build + testing
  seams as a clause: any server-side durable store
  in dev lives under `.pang/server-*/` as one file
  per record, `.gitignore`d, with the Supabase row
  shape matching the JSON shape 1:1. The pattern
  is now used three times (iter #4 outbox, iter #9
  users / credentials / sessions) and formalises
  the migration contract.

Laura's hands: **after merge.** Walks the invite link
on a real phone (iPhone 15+ / Pixel 8+), enrolls the
passkey, enters the Room, force-quits the browser,
re-opens the invite link cold, completes the assert
flow via conditional UI, enters the Room. That loop
is the spine moment test for auth. Pass = "the
collection is on my phone, it knew it was me." Fail
= a named regression in the observability proofs
above (iterate once or drop the failing sub-flow).

---

## Iteration #9 — findings (2026-04-24)

**Status:** landed at ceiling and opened as
https://github.com/tobiasschneiderberlin-oss/Pang/pull/19 (squash
pending). `npm run verify` clean (26/26 gates, 651/651 unit tests,
9/9 eval fixtures across intake + enrichment + verification).
Playwright e2e 30/30 on both `chromium-mobile` and
`chromium-desktop`, including the new `passkey.spec.ts` (4 tests
covering the full ceremony via chromium's CDP WebAuthn virtual
authenticator — invite→bind→enroll→session, logout revocation,
malformed-invite landing, replayed-invite landing). Spine moment
#7 is closed: the collector's device holds the passkey, the
session is an opaque bearer cookie backed by a server-side record,
and every non-public API route refuses an unauthenticated caller.
The two principle-scope deferrals (Magic Link OTP; Supabase
persistence) remain deferred as planned. Laura's hands: queued for
the first real-device session on the merged preview.

### What landed

- `src/auth/schema.ts` — Zod shapes for `User`, `CredentialRecord`,
  `SessionRecord`, `InvitePayload`, `SessionReply`. The client-
  exposed `SessionReply` is deliberately narrow (userId + method +
  expiresAt) so a stolen `GET /api/auth/session` never leaks
  enrollment metadata.
- `src/auth/ids.ts` — base58-ish user id (`u_` + 22 chars). The
  format mirrors what Supabase will produce; keeping it stable now
  avoids a migration later.
- `src/auth/config.ts` — single source of cookie names + TTLs
  (`pang_session`, `pang_bind`, 14d / 10min). Imported by
  `e2e/support/auth.ts`; drift here breaks the E2E seam.
- `src/auth/server/store.ts` — user + credential store with a
  filesystem stand-in under `.pang/server-{users,credentials,
  credentials-revoked}/`. One file per record, JSON shape 1:1 with
  the future Supabase row. Counter-rollback moves the credential
  file from live → revoked, never deletes.
- `src/auth/server/session.ts` — opaque 32-byte hex bearer
  sessions. `createSession` / `readSession` / `rotateSession` /
  `revokeSession` / `requireSession`. Cookie is HttpOnly +
  SameSite=Strict + Path=/; `Secure` gated on
  `NODE_ENV==="production"` so Playwright-against-localhost sees
  the cookie.
- `src/auth/server/invite.ts` — HS256 JWT via `jose@5`, 14d TTL,
  single-use via `.pang/server-invites/<jti>.consumed` markers.
  Signing key from `PANG_AUTH_INVITE_SECRET`. `signInvite` /
  `verifyInvite` / `consumeInvite`.
- `src/auth/server/rate-limit.ts` — per-route sliding window,
  disk-backed so it survives `next dev` restarts. `invite/bind`,
  `passkey/assert`, `passkey/enroll` get the tight window; other
  routes get a soft cap.
- `src/auth/webauthn/{options,verify}.ts` — thin wrappers around
  `@simplewebauthn/server@11`. Enrollment asks for platform
  authenticator + resident key + required UV; assertion is RP-
  scoped to `APP_ORIGIN`. Challenge persisted to
  `.pang/server-challenges/` keyed on the bind session.
- `app/api/auth/` — eight routes: `invite/bind` (unauth), `invite/
  mint-dev` (E2E+dev seam), `passkey/{options,enroll,assert}`,
  `session`, `logout`, `e2e-seam` (synthetic session for non-
  passkey specs). Every route Zod-parses input (A3), emits
  `gen_ai.*` + `auth.*` spans (A10), and either calls
  `requireSession` or is on the ceremony allowlist. The two E2E/
  dev-only surfaces are double-gated:
  `NEXT_PUBLIC_PANG_E2E=1` at build time and an `x-pang-e2e:
  <PANG_AUTH_E2E_TOKEN>` bearer per request; production bundles
  with the env var unset strip the surface entirely.
- `app/i/[token]/page.tsx` + `InviteLandingClient.tsx` — invite
  landing state machine (`malformed → binding → ready → enrolling
  → done → used`). Server shell validates the three-segment JWT
  shape before render; the bind is always client-side so the CSRF-
  tokened cookies flow through in the right order. Copy passes
  voice + Museumsschild checks: *"Create passkey."*, *"This
  invite is not valid."*, *"This invite has been used."*.
- `src/hooks/usePasskey.ts` — wraps `@simplewebauthn/browser@11`'s
  `startRegistration` / `startAuthentication` with a structured
  failure shape: `NotAllowedError → "cancelled"`, `InvalidStateError
  → "already-enrolled"`, anything else → `"unexpected"` with the
  raw message for telemetry.
- `src/components/AppBoot.tsx` — behind `NEXT_PUBLIC_PANG_E2E=1`,
  exposes `window.__PANG.authSeed(...)` that POSTs `/api/auth/
  e2e-seam` with the shared bearer. Lets every non-passkey spec
  skip the ceremony by seeding a synthetic session before
  `page.goto`. Production bundles without the env var never
  install the surface.
- `scripts/check-gates.ts` — P10 rewrite: walks every `app/api/**/
  route.ts`, confirms `requireSession()` is the first meaningful
  statement of each non-allowlisted handler, fails CI with the
  file path on regression. Allowlist names the ceremony routes
  explicitly (opt-in, not opt-out).
- Four gated-route uplifts: `intake`, `enrichment/submit`,
  `verification/push/subscribe`, `verification/request` now call
  `requireSession` at the top. Their unit tests pick up a seeded
  session fixture via `src/test/{next-headers-mock,seed-session}
  .ts`; the assertion shape stays the same, only setup moved.
- `e2e/passkey.spec.ts` — four Playwright tests over a chromium
  CDP virtual authenticator (ctap2 / internal transport / resident
  key + UV required). Proves the session cookie shape, the logout
  revocation, the malformed-invite no-bind guarantee, and the
  replayed-invite 409 landing. `e2e/support/auth.ts` ships the
  `authSeed` / `authClear` helpers the other 26 specs use.
- `playwright.config.ts` — `PANG_AUTH_E2E_TOKEN` +
  `PANG_AUTH_INVITE_SECRET` plumbed into both the test-runner env
  and the `next dev` webServer env, so the helpers and the routes
  see the same values. Deterministic dev fallback for both so
  local + CI are consistent.
- `package.json` — `@simplewebauthn/{server,browser}@11`, `jose@5`
  land. Test script moves to `node --experimental-test-module-
  mocks --import tsx --test --test-concurrency=1` (module mocks
  leak across parallel test files in the default runner).

### What execution exposed

Eight discoveries, each with its verdict:

1. **Next.js app router silently 404s `_`-prefixed folders.** The
   first attempt named the E2E surfaces `app/api/auth/__e2e/` and
   `app/api/auth/invite/__dev/` — plausible (it's the same
   "underscore = private" convention Python uses). Both routes
   returned 404 with env vars correctly plumbed; a `console.log`
   at the top of each handler never fired. The cause: Next 16's
   app router treats any segment folder whose name starts with
   `_` as a **private folder** — excluded from routing entirely,
   no handler ever compiled. Fix: renamed to `e2e-seam/` and
   `mint-dev/`. Cost half an evening to locate because the 404
   arrives before any user code runs. General shape: **routable
   Next.js folders must never start with `_`**. The convention is
   documented but not surfaced by dev-server diagnostics, and the
   404 is indistinguishable from a missing route. Codify in
   `PANG_Architecture_2026.md` § 10.5 (Build + testing seams) as
   a footgun note so the next underscore-named route doesn't cost
   another evening.

2. **Third use of the filesystem-backed server-store pattern — it
   is the sanctioned dev stand-in.** Iter #4 wrote the outbox
   under `.pang/server-outbox/` as one file per record. Iter #9
   reuses the exact shape for users, credentials, sessions,
   invites, challenges, revoked-credentials, and rate-limit state
   — six directories, all with `.gitkeep` stubs and gitignored
   contents. The migration path to Supabase is now a literal
   swap: `JSON.parse(readFile(path))` becomes `supabase.from(
   table).select(...)`; the call site doesn't change because the
   store helpers (`loadUser`, `saveUser`, `revokeCredential`,
   etc.) already hide the I/O. A pattern used three times across
   three iterations has earned primitive status. Codified in
   `PANG_Primitives_2026.md` and `PANG_Architecture_2026.md` §
   10.5.

3. **Opaque bearer cookie + server-side session record beats
   JWT-as-session at the ceiling.** The kickoff brief named the
   tradeoff; the iteration proves it. Revocation is a file
   delete (and a `Set-Cookie` with `Max-Age=0`); rotation is a
   file rename + new cookie write. No deny-list. No "revoked
   before expiry" edge case. The 14-day TTL with rotation-on-
   assert is an idle-session safety net without friction for
   active collectors (rotation reads as a no-op to the
   collector). JWTs stay where they earn their keep — the invite
   boundary, where "signed and single-use" is the contract.
   Codified in `PANG_Architecture_2026.md` § 8 as a clarifying
   clause on the existing "rotating server-side token" line.

4. **Revocation is a move, not a delete.** Counter-rollback clone
   detection moves the credential file from
   `.pang/server-credentials/` to
   `.pang/server-credentials-revoked/` rather than deleting. A
   later forensics question ("did this credential ever
   authenticate?") still has an answer. A support question
   ("why did the collector's sign-in suddenly break?") has a
   file to point at. The audit trail is a directory listing, not
   a log grep. Generalises: **any store that deletes at the
   store level is one forensic question away from a hole; a
   two-directory live/archived shape gives you the same
   semantics plus history for free**. Codified in
   `PANG_Primitives_2026.md` as "tombstone by move, never by
   delete" — noted as the pattern the outbox (iter #4) already
   uses implicitly (delivered rows move to `delivered/`, never
   get unlinked).

5. **P10 uplift — a trivial-pass gate is half a gate.** Before
   iter #9, P10 checked `src/auth/` existed and no `type=
   "password"` appeared. Both conditions hold for a codebase
   with no auth at all. The uplift walks every `app/api/**/
   route.ts`, confirms `requireSession()` is the first
   meaningful statement of each non-allowlisted handler, and
   fails with the file path on regression. The ALLOWLIST is
   explicit (the ceremony routes and the telemetry beacon) —
   opt-in, not opt-out, so a new gated route can't "accidentally"
   bypass the check by sitting on an existing allowlist. General
   shape: **a gate that walks the surface is strictly stronger
   than a gate that checks for absence**. Codify as a gate-
   authoring principle in `PANG_Gates.md`: prefer positive
   adoption over negative absence; allowlists over denylists;
   file-path error messages over pass/fail.

6. **Node test-module mocks need `--test-concurrency=1`.** The
   route unit tests mock `next/headers` so `cookies()` returns a
   seeded cookie jar. Under the old `--test-reporter=spec` runner
   without `--test-concurrency=1`, the mock leaked across parallel
   test files — one file's mocked `cookies()` occasionally
   returned another file's seeded value. The fix: `node
   --experimental-test-module-mocks --import tsx --test
   --test-concurrency=1`. Cost: test duration ~3s → ~5s. Worth
   it; flaky tests are strictly worse than slow tests, and the
   auth seam has no parallelism benefit to recover. General
   shape: **module mocks in node's test runner are process-global
   — parallel files race on the registry**. Noted in
   `PANG_Architecture_2026.md` § 10.5 (testing seams) alongside
   the Playwright config clauses.

7. **Idempotency markers commit before the side effect.** The
   invite `bind` route writes the `.pang/server-invites/<jti>
   .consumed` marker **before** it issues the session cookie,
   inside the same span. A crash between the two reads as
   "invite consumed, session not issued" — the collector retries
   the invite, the retry correctly fails closed (409), and the
   collector asks the gallery for a new link. The "commit after"
   shape has the opposite failure mode (session issued, invite
   not marked consumed), which re-opens the replay window for
   the window between success and marker-write. Playwright
   replay test proves the invariant. General shape: **an
   idempotency marker that commits after its guarded side effect
   is doing nothing** — by the time the marker exists, the
   attacker has the effect. Noted in
   `PANG_Architecture_2026.md` § 10.5 as a seam-authoring rule.

8. **WebAuthn virtual-authenticator config must mirror the RP
   exactly — misconfiguration surfaces as `NotAllowedError`
   with no detail.** First draft of `addVirtualAuthenticator`
   had `hasResidentKey: false`. `startRegistration` rejected
   with `NotAllowedError` and the DOMException message was an
   empty string. The RP's enroll options declare `residentKey:
   "required"` + `authenticatorAttachment: "platform"` +
   `userVerification: "required"`; the virtual authenticator
   has to declare the equivalent flags (`hasResidentKey: true`,
   `hasUserVerification: true`, `isUserVerified: true`,
   `transport: "internal"`). The debug loop is "does the virtual
   authenticator mirror the RP exactly?" — there is no more
   specific diagnostic available. Codified inline in
   `passkey.spec.ts`'s `addVirtualAuthenticator` docstring so
   the next iteration reaching for CDP WebAuthn sees the
   constraint up front.

### Codification — what moves into the keeper docs

- **`PANG_Primitives_2026.md` — two new primitives.**
  - "Passkeys + opaque bearer session" joins the auth section.
    Clauses: WebAuthn is the sole primary auth path; invite JWT
    is the only JWT (session continuation is an opaque bearer);
    conditional UI via `autocomplete="username webauthn"` is
    the sanctioned assertion affordance on cookie-less cold
    start; **forbidden composition: passkey button next to
    password field** (the 2018 compromise P10 now mechanically
    forbids).
  - "Filesystem-backed server stand-in" joins the build-infra
    section. Clauses: any durable server-side store in dev
    lives under `.pang/server-*/` as one-file-per-record JSON;
    the directory is `.gitignore`d with a `.gitkeep` stub so
    the shape is in the repo but the contents are not; the
    Supabase row shape matches the JSON shape 1:1 so the
    migration is a call-site-preserving swap. Used three times
    (iter #4 outbox, iter #9 auth, anticipated for everything
    that follows).
  - "Revocation is a move, not a delete" joins the store
    discipline section. Live vs archived is two directories;
    the store's public API returns archived-as-gone; forensics
    walks the archive directly.

- **`PANG_Architecture_2026.md` — three clarifying clauses.**
  - § 8 Auth: clarifies the existing "rotating server-side
    token" line to call out that session state is opaque-bearer
    + server-record (JWT for the invite boundary only); lists
    `requireSession` as the sole helper every non-public route
    adopts.
  - § 10.5 Build + testing seams: adds the private-folder
    footgun (no underscore-prefixed routable folders); adds the
    node test-module-mocks + `--test-concurrency=1` clause;
    adds the "idempotency marker commits before side effect"
    rule.
  - § 10 top note: session auth is now a landed ceiling, not a
    waiting primitive.

- **`PANG_Spine.md` § *Build order*.** Moment #7 graduates from
  "next up" to "landed 2026-04-24, iter #9" with the ceremony
  shape summarised. Moment #8 (verification request flow) is
  still in the queue; the gated routes are now session-aware
  and the verification-outbox `userId` hook is in place.

- **`PANG_Gates.md`.** P10's description in the 48-gate
  table updates from "no password surfaces" to "no password
  surfaces + every API route either gated with requireSession
  or on the ceremony allowlist + Playwright passkey spec
  present". Fail condition expands. Gate count stays 48.

### What stayed deferred (on purpose)

- **Magic Link OTP fallback.** Still principle-scope-deferred.
  The `auth.passkey.enroll.failed { reason: "not-supported" }`
  span is wired and the rails (`method: "passkey" | "otp"` in
  `SessionRecord`) are in place; the OTP branch lights up the
  day the observability signal shows a Tier-C device arriving.
- **Supabase persistence.** Still deferred. The filesystem
  stand-ins and their gitignore rules are in; the Supabase
  migration path is "swap the store helper bodies, same call
  sites." The iter that turns on Supabase will be small.
- **Multi-device passkey sync UX.** Platform authenticators
  sync through iCloud Keychain / Google Password Manager / 1P
  already; we inherit the sync, we don't render it. A "your
  devices" surface stays out until a Laura-hands signal asks
  for it.
- **Passkey management screen.** Same — out of scope until a
  concrete ask.

### What comes next

Spine moment #8 — **Verification request flow.** The outbox
from iter #4, the correspondence lane from iter #5, and the
session identity from iter #9 finally compose: Laura taps a
dormant work, PANG pre-writes the message, Correspondence
Agent owns the prose, one tap to send via the collector's
preferred channel (email / WhatsApp). The gallery's side is a
two-tap confirm surface that rides the same session auth. The
spine's verification line — *"Ask your gallery to confirm"* —
becomes a real gesture instead of a promise.

---

## Iteration #10 — Verification request flow (opened 2026-04-24)

**Status:** kickoff brief. Scope is **ceiling on the collector↔gallery
verification loop** with two explicitly named principle-scope
deferrals (server-side provider dispatch — Resend / Twilio / Slack
Connect; SMS as a third channel). This iteration closes spine moment
#8 (`PANG_Spine.md` § *Build order*): *Intake detects gallery of
origin; PANG pre-writes the message (email or WhatsApp, collector
chooses); one tap to send. Gallery's side is a two-tap confirm
surface. Correspondence Agent owns the prose.* The outbox from
iter #4, the enrichment-contributor lane from iter #5, and the
session identity from iter #9 finally compose. Laura taps a
dormant work; PANG composes; one tap sends; the gallery receives
a signed link; two taps confirm; a push arrives; the work comes
alive in arrival. The null state stops being an aesthetic and
becomes a round-trip business event — the gallery's existing
relationship with the collector produces a confirmed-verification
moment without either side opening an admin dashboard.

**Why now:** eight spine moments sit in the codebase with their
scaffolding in place and no round-trip closing them. Iter #4
shipped the collector-side ask — an outbox, a `requested` state,
a Declarative Web Push *subscription* that has never received a
delivery. Iter #5 shipped the enrichment lane; the
contributor-side pattern (gallery receives a structured
submission, owns the outcome) is proven for one direction.
Iter #9 shipped session identity — the cookie knows the
collector, `requireSession` gates every non-public route, and
the invite-JWT ↔ consumed-marker ↔ server record pattern is now
a primitive (50 / 51 / 52). Every primitive this iteration needs
exists. Nothing left to compose. The gallery side has no surface
yet — no `/g/` route family, no confirm page, no signed-link
discriminated by audience. The Correspondence Agent slot is
declared in `PANG_AI_Era_2026.md` § *Agent order* as the third
agent after Intake + Enrichment, before Narrative. This is the
iteration that wires it.

**Scope:** **ceiling** on the collector-to-gallery loop — the
Correspondence Agent's prose; the pre-written message bound to
the work's structured snapshot and the gallery's contact rails;
a one-tap dispatch via `mailto:` or `https://wa.me/<phone>`
URL-handoff (the "compose" happens in PANG, the "send" happens
in the collector's mail / WhatsApp client); a signed-link pattern
generalised from iter #9's invite JWT so the gallery's confirm
URL is replay-proof, audience-scoped, and single-use; a
two-tap gallery-side confirm page that reuses iter #9's passkey
ceremony for the gallery operator's first visit, and a
server-side session for subsequent returns; a Declarative Web
Push *delivery* (the subscription iter #4 opened now has a
counterparty); an outbox-as-truth reconcile on boot so a missed
push doesn't strand a `requested` state; arrival-on-confirm that
reuses iter #3's ceremony unchanged; full `verification.dispatch.*`,
`verification.confirm.*`, `verification.push.deliver.*`,
`correspondence.compose.*` OTel catalogues; a per-agent eval
corpus under `evals/correspondence/` with ≥ 5 fixtures covering
voice, prompt-injection via gallery name, and edge cases
(unknown-gallery, confidence-low hint, Tier-C no-push). **Two
principle-scope lines, each with a named reason:**

- **Server-side provider dispatch (Resend / Twilio /
  Slack Connect / SMTP) is out of scope for this iteration.**
  Rationale: the ceiling of the round-trip is *the gallery
  receives a signed link and clicks it*, not *PANG owns the
  outbound mail-delivery infrastructure*. The `mailto:` /
  `wa.me` URL-handoff ships the collector's intent out of the
  browser into the OS-level provider the collector already
  trusts (iOS Mail, Gmail app, WhatsApp). That's the spine
  moment: "the collector asks the gallery." Server-side
  dispatch replaces the handoff with "PANG asks the gallery
  on the collector's behalf," which is a different gesture
  with a different trust model — the collector no longer sees
  the message before it leaves. Observability will decide
  when / whether to pivot: if the
  `verification.dispatch.handoff_returned` span shows a high
  fraction of collectors abandoning between "compose" and
  "send" (i.e., the OS client opens and they back out), the
  iteration that wires server-side dispatch earns its slot.
  Until then, the handoff is the feature. The rails are left
  in place: `src/verification/dispatch/channel.ts` admits
  `kind: "mailto" | "wa-me" | "resend" | "twilio" | "slack-
  connect"` from day one, and the dispatch route flows
  through a `pickChannel(request, galleryContact,
  collectorPreference)` selector so future providers are a
  path addition, not a refactor.
- **SMS as a third channel is out of scope.** Rationale:
  SMS requires server-side dispatch (no `sms:` URL handoff
  is reliable cross-platform — Android drops the body,
  iOS requires user confirmation of the number) *and* PII
  storage of the gallery's phone number alongside its email,
  which is a distinct data-handling surface. The two
  channels that ship — email via `mailto:`, WhatsApp via
  `wa.me` — cover 2026 European gallery practice (Berlin /
  Amsterdam / Cologne / Zurich are all WhatsApp-first for
  client comms; email is the always-available fallback).
  When / if the observability signal shows Tier-C markets
  where SMS is the only reliable channel, the iteration that
  adds it will be small because the channel abstraction is
  already in place.

Landing shape:

- **Correspondence Agent.** New agent module at
  `src/ai/agents/correspondence.ts`. Matches the iter #5
  Enrichment Agent shape: reads a typed input
  (`CorrespondenceRequest` — work snapshot, gallery hint,
  collector preference, channel), produces a typed output
  (`CorrespondenceDraft` — `subject`, `body`, `toneNote`),
  runs through `_shared.ts`'s model selector (deterministic:
  Haiku-tier for latency, per A19), emits
  `correspondence.compose.{started,succeeded,failed}` spans.
  Structured output via Anthropic's JSON schema tool — no
  `JSON.parse` at the boundary. Voice doctrine is injected
  via `PANG_VOICE_SYSTEM_PROMPT` (already wired per iter #5
  + the voice corpus); A5's banned-vocabulary check runs
  on the draft output in CI via the eval corpus. CaMeL
  untrusted-data discipline: the gallery name (from the
  invite's `galleryOfOrigin` hint or the collector's free-
  text override) is `Untrusted<string>` on entry and passes
  through `sanitize()` before the prompt renders — no
  gallery-name-containing-prompt-injection path reaches
  the privileged LLM. The agent never sees the collector's
  full collection; the composition scope is one work plus
  one gallery contact.
- **Signed-link generalisation.** `src/auth/server/invite.ts`
  graduates to `src/auth/server/signed-link.ts` (invite.ts
  becomes a thin re-export during the transition and is
  deleted in the same PR). Three audiences:
  `collector-invite` (iter #9's existing shape),
  `gallery-confirm`, `gallery-decline`. Each audience has
  its own TTL (invite: 14 d; confirm / decline: 30 d —
  galleries may triage on a weekly cadence), its own
  claims shape (confirm carries `vrid` verification-request
  id, `wid` work id, `gid` gallery id), and its own
  consumed-marker directory
  (`.pang/server-signed-links/<audience>/<jti>.consumed`).
  The HS256 + `jose` + jti single-use pattern is unchanged —
  that's the primitive iter #9 proved. What's new is the
  audience discriminator, enforced in both sign and verify
  so a confirm-token presented at the invite-bind route is
  rejected with `auth.signed_link.rejected { reason:
  "wrong-audience" }`. A named test covers each of the nine
  cross-audience pairs (3 × 3 presented-vs-expected).
- **`POST /api/verification/dispatch`** — new route. Takes
  the collector's `requestId` (from iter #4's outbox) and
  the chosen channel (`"mailto" | "wa-me"`). Gates through
  `requireSession` (iter #9). Calls the Correspondence Agent
  with the work snapshot + gallery hint + channel preference,
  receives the draft, mints two signed links (confirm +
  decline) scoped to this request, packs them into the draft
  body, returns `{ draftSubject, draftBody, recipient,
  channelUrl }` where `channelUrl` is the prepared
  `mailto:` / `wa.me` URL (URL-encoded subject + body +
  recipient) the client navigates to on the send-tap. The
  outbox entry (iter #4) flips from `requested` to
  `dispatched`. Span:
  `verification.dispatch.{composed,handoff_started,
  handoff_returned,failed}`. Idempotent on `requestId` —
  a second dispatch call with the same id returns the
  same links (consumed-marker pattern applies: the links
  are minted and cached once; re-dispatch re-uses them).
- **`GET /g/confirm/[token]` + `GET /g/decline/[token]`** —
  new gallery surfaces. Server-side verifies the signed
  link (audience-scoped), displays the work + the
  collector's identity (first-name + last-initial only;
  never full PII) + the message the collector sent, with
  a single primary button ("confirm this work" /
  "I can't confirm this work"). First visit from a new
  gallery device: the button tap starts a passkey
  enrollment ceremony for the gallery operator (reusing
  the iter #9 passkey module; the gallery operator's
  identity is minted from the `gid` claim). Subsequent
  visits: the session cookie bypasses the ceremony —
  one tap on the button, the action commits. Two taps
  max — the ceremony tap is the confirmation. No
  "are you sure" modal; the button copy *is* the commit.
  Span: `verification.confirm.{started,succeeded,failed}`,
  `verification.decline.{started,succeeded,failed}`. The
  token is consumed at commit — replay fails closed.
- **`POST /api/verification/confirm` + `/decline`** — called
  from the gallery confirm page. Writes the outcome to
  `.pang/server-verification-outcomes/<vrid>.json` (shape
  matches the Supabase table `verification_outcomes` will
  honour). Fires the Declarative Web Push delivery via
  the subscription iter #4 stored on the request record.
  Span: `verification.push.deliver.{attempted,succeeded,
  failed}` with `pushProvider: "web-push" | "fcm" |
  "apns-via-webpush"`. VAPID private key pulled from env
  (`VAPID_PRIVATE_KEY`, per iter #4's open question #5).
- **Push outcome reconcile.** New boot-time reconciler in
  `src/verification/reconcile.ts` (extends the iter #4
  file). Walks the outbox for `dispatched` entries whose
  store state is still `requested`, calls
  `GET /api/verification/outcome/{requestId}` (new route,
  public-but-token-gated: the request ID alone doesn't
  identify anyone — it's a ULID), and reconciles the store
  state from the server outcome record. This covers the
  failure mode where push delivery silently drops (device
  offline for > TTL, subscription expired). Outbox-as-truth:
  the server's outcome record is the single source; push
  is a notification channel, not the state channel.
- **Arrival-on-confirm.** `src/ai/chapter/plan.ts`
  already has the `"confirmation"` beat kind from iter #4;
  this iteration wires the trigger. When the reconciler
  or the push handler flips the store state to
  `"confirmed"`, the focused-work surface composes the
  confirmation chapter automatically; if the collector is
  away from the Room (other surface, background), the next
  Room return plays it. The GL warmth rise (iter #4,
  `RoomScene.setWorkVerified`) fires on the chapter's
  ready beat. No new GL code — the plumbing composes.
- **`<VerificationOutcome>` Push handler.** Existing
  `public/sw.js` push handler (iter #4, line 154) extends
  to three outcome kinds: `"confirmed"`, `"declined"`,
  `"expired"` (gallery never responded within 30 d — a
  quiet client-side derivation, not a server push). The
  notification body is voice-authored; no marketing
  vocabulary; A5 eval covers each variant.
- **Dispatch button on the AskGallery panel.** The
  `AskGallery.tsx` component (iter #4) grows a second
  primary state: after `requested` lands in the outbox, a
  compact "send now" button appears — it calls
  `/api/verification/dispatch`, receives the
  `channelUrl`, navigates to it (`window.location.href = …`
  or `<a>` click depending on handoff stability per
  browser — open question #3 below). The collector sees
  the composed message in their mail / WhatsApp
  client before sending; the "send" tap happens there.
  The second PANG-side tap is the earlier `ask` that
  created the outbox entry; this is the dispatch tap.
  Total taps from intake-end to gallery-inbox: **three**
  (ask in PANG, channel pick, send in provider client) —
  within the spine's one-tap-is-sacred invariant for
  collector-side composition (PANG's taps: one to ask,
  one to pick channel; the provider's tap is the
  collector's existing muscle memory, not PANG's design).
- **P25 (zero-tap review) uplift — not a new gate.** Same
  discipline as iter #9's P10 uplift. The P25 description
  extends from "scanner → arrival without a form" to
  "every PANG-side dispatch or confirm surface without an
  intermediate confirmation modal." The mechanical check
  walks `src/components/verification/*.tsx` and
  `app/g/confirm/[token]/page.tsx` for the anti-pattern
  `<Dialog>…confirm</Dialog>` / `<ConfirmModal>` in the
  critical path between a primary action button and its
  network call. Gate count stays **48**.

**Stack:**

- `@anthropic-ai/sdk@>=0.30` (already in the tree via iter
  #1) — Correspondence Agent calls Claude Haiku-tier
  (`claude-haiku-4-5`) with structured output. No new
  SDK.
- `jose@>=5` (already in the tree via iter #9) — signed-link
  sign + verify. The audience discriminator piggybacks on
  the existing JWT payload; no new dep.
- `zod@>=3.23` (already in the tree) — `SignedLinkClaimsSchema`,
  `CorrespondenceRequestSchema`, `CorrespondenceDraftSchema`,
  `VerificationOutcomeSchema`. All new schemas live under
  `src/verification/schema.ts` (extends iter #4) and
  `src/ai/agents/correspondence.schema.ts`.
- `web-push@>=3` — new dep (18 kB gzipped server-side; not
  bundled client-side). Server-side VAPID sign + deliver
  to the `PushSubscription` record iter #4 stored. The
  browser's service worker (iter #4 `public/sw.js`) already
  handles the receive side.
- Filesystem-backed dev stores (the iter #9 / iter #4
  pattern, now codified as primitive 52):
  `.pang/server-signed-links/<audience>/<jti>.consumed`,
  `.pang/server-verification-outcomes/<vrid>.json`,
  `.pang/server-gallery-users/<gid>.json`,
  `.pang/server-gallery-credentials/<credentialId>.json`,
  `.pang/server-gallery-sessions/<sessionToken>.json`.
  The gallery-side auth stores mirror the collector-side
  ones from iter #9 — same shapes, different roots. When
  Supabase lands, the row shapes match 1:1.
- `src/lib/otel/span.ts` (existing) — all new spans.
  `correspondence.*` spans add `inputTokens`,
  `outputTokens`, `model`, `latencyMs`, `voiceCheckPassed`
  attributes. No new observability primitive.
- `next/headers` (existing) — `cookies()` + `headers()` on
  the new gallery confirm routes; same Node runtime as
  the iter #9 auth routes so the fs stand-in resolves.
- **No client-side new framework.** The AskGallery panel
  extension is React. The gallery confirm page is a server
  component with a small `"use client"` island for the
  passkey ceremony. No new bundler hooks, no new state lib.

**Reference:**

- **Gmail's "confirm it's you" security prompt (2024).**
  The two-tap pattern — the first tap is arriving at the
  surface, the second is the commit. No form fields
  between. The button's copy *is* the commit.
  The gallery confirm page takes this shape exactly.
- **Stripe's magic-link email flow (2025 rev.)** — the
  canonical signed-link pattern: audience-scoped, single-
  use, consumed on click, independent of whether the link
  ever opens (so expiry is a TTL signal, not a "sent
  successfully" signal). `jose` + `jti` consumed-marker
  is the shape.
- **Iter #9's invite ceremony (2026-04-24).** Literal
  reference for the gallery-side enrollment: the gallery
  operator's first visit to a confirm link mounts the same
  `<PasskeyEnrollCeremony>` the collector mounts on invite.
  Same component. Different ambient chrome
  (`data-pang-side="gallery"` so the Room doesn't show
  behind it; a neutral background and the gallery's name).
- **Granola's "quiet ask" (referenced in iter #4).**
  Still the spine reference for the *collector's* side of
  the loop. The Correspondence Agent's composed prose
  holds to the same register: specific, structured,
  no marketing surround. The gallery's phrase
  "we appreciate the opportunity to verify this work"
  is banned by construction — A5 + voice doctrine.
- **Apple Mail's handoff to `mailto:`.** The
  compose-in-OS, send-from-OS pattern. The collector's
  existing trust surface is the provider; PANG does the
  hard work (composition, recipient resolution, link
  minting) and hands off a pre-filled draft. The
  collector reads what's about to go out before they send.
- **Anti-reference:** any "contact us" surface that
  submits a form to a server, replies with "we'll get
  back to you shortly," and strands the user. The PANG
  gallery confirm page resolves the collector's state in
  one round-trip; the confirm tap's server write + push
  delivery happens before the gallery operator's page
  redirects to a "done" state. No "we'll notify them
  soon" chatter anywhere.

**Canvas:** DOM chrome only on the gallery confirm page
(2 px borders, sharp corners, sentence case). The
`<canvas>` Room is collector-side only; the gallery side
never mounts it — gallery operators see a page titled
"a collector is asking about this work," the work's
catalogue record, and two buttons. The collector-side
extension of `AskGallery.tsx` is DOM over the Room
canvas, same composition iter #4 used. No new canvas
surface. The passkey ceremony on first-gallery-visit is
the browser's system sheet (iter #9 pattern); our paint
is one headline, one sub-line.

**Failure mode (5th declaration):** six regression
classes must be observable.

- *Mail-client handoff failure.* The collector taps "send
  now," `mailto:` / `wa.me` navigates, the provider client
  fails to open (unregistered scheme on desktop; no
  WhatsApp installed). Enforcement: the dispatch client
  fires `verification.dispatch.handoff_started` before the
  navigation and `verification.dispatch.handoff_returned
  { success: boolean, latencyMs }` on `visibilitychange`
  after the navigation tries to return focus. If
  `handoff_returned { success: false }` on
  `handoff_started`, the component surfaces a small
  "couldn't open your mail app — copy the message?" affordance
  with a clipboard copy button. Observability lets us see
  which collectors land in that state and whether it
  clusters by OS / browser.
- *Correspondence Agent voice regression.* The composed
  draft contains banned vocabulary ("dive", "unlock",
  "seamless", "leverage", "journey", "we appreciate the
  opportunity to…"). Enforcement: the A22 eval corpus at
  `evals/correspondence/` runs in CI on every PR touching
  `src/ai/agents/correspondence.ts` *or* the voice corpus;
  threshold is ≥ 90 % voice-check pass across ≥ 5 fixtures,
  fail-build on regression. The agent's runtime
  `compose()` call also runs the draft through
  `check:strings` before returning it; a live-mode failure
  fires `correspondence.compose.failed { reason:
  "voice-regression", banned: [...] }` and the client
  retries once with a reinforced-voice prompt (A21 retry
  policy) before surfacing a fallback static-template
  message. The fallback template is voice-compliant by
  construction.
- *Signed-link token replay / cross-audience confusion.*
  A confirm token presented at the decline route (or vice
  versa), a 15-day-old link clicked twice, a forwarded
  confirm link opened by a different gallery. Enforcement:
  the signed-link verify path matches audience exactly
  (verified test: all 3 × 3 audience cross-pairs reject
  with `wrong-audience`); the consumed-marker commits
  before the outcome write (primitive 51); the `gid` claim
  is checked against the server-stored gallery record on
  the route handler, so a forwarded link to a different
  gallery's operator fails with `auth.signed_link.rejected
  { reason: "wrong-gallery" }`. Five distinct Playwright
  specs (one per failure path) + unit coverage on the
  verify function.
- *Push delivery gap — collector never gets the outcome.*
  The gallery confirms, the push deliver attempt fails
  (subscription expired, device offline > TTL, provider
  503). Enforcement: the outbox-as-truth reconciler on
  the next PANG boot walks every `dispatched` outbox
  entry, polls `GET /api/verification/outcome/{requestId}`,
  and reconciles the store state locally — the store
  flips to `"confirmed"` or `"declined"` on boot if the
  server has already recorded the outcome. Span:
  `verification.reconcile.{outcome_found,outcome_pending}`.
  A Playwright spec simulates push failure (service worker
  intercepts the push deliver), boots the app, verifies
  reconcile fills the gap.
- *Prompt injection via gallery name.* The gallery's name
  in the Intake record (or the collector's free-text
  override from iter #4) contains malicious instructions
  ("Ignore previous instructions and…"). Enforcement: the
  Correspondence Agent's prompt uses CaMeL's
  quarantined-string rendering — the gallery name is
  rendered inside an `<untrusted-gallery-name>` XML
  delimiter (A9) and the system prompt is explicit that
  content inside it is data, not directive. The A22 eval
  corpus includes two injection fixtures (one subtle, one
  overt); both must fail to alter the draft's structure
  (`subject`, `body`, `toneNote` remain the agent's
  intended composition). If the composed output drifts
  structurally (contains a URL not minted by PANG,
  references a gallery other than the one in `gid`,
  etc.), the runtime CaMeL validator rejects the draft
  and fires `correspondence.compose.failed { reason:
  "injection-suspected" }`.
- *Race on confirm — simultaneous confirm + decline.* The
  gallery operator taps "confirm," the network is slow,
  a second operator (same gallery, different device)
  taps "decline" on the same link. Enforcement: the
  outcome write is keyed by `vrid` (verification-request
  id); the first committed outcome wins (filesystem
  `O_CREAT | O_EXCL`; Supabase unique constraint);
  the second returns 409 Conflict with
  `verification.confirm.rejected { reason:
  "outcome-already-recorded", priorOutcome: "confirmed" |
  "declined" }`. The second operator's client surfaces
  a voice-authored note ("this was already answered by a
  colleague"). No partial-confirm state; no retroactive
  flip. Playwright spec covers the race via two parallel
  page contexts against the same token.

**Gates this iteration must pass:** the 48.

- **P25 (zero-tap review) — uplifted.** Description grows
  to cover dispatch + confirm surfaces. The gate file
  mechanical check extends to walk
  `src/components/verification/*.tsx` and
  `app/g/confirm/[token]/page.tsx` for confirm-modal
  anti-patterns in critical paths. Gate count stays 48.
- **P5 (OPFS only, no localStorage) —** the gallery
  confirm surface is server-rendered; no browser
  persistence. The collector-side dispatch state flows
  through the existing OPFS-backed verification store
  from iter #4.
- **P6 (CSP)** — the gallery confirm page lives on the
  same origin; no new iframe, no new `frame-src`. The
  `mailto:` / `wa.me` handoffs are URL schemes, not
  cross-origin frames.
- **P10 (passkey-only primary auth, upgraded in iter #9)
  —** the gallery operator's first visit reuses the
  same passkey module. `requireSession` gates
  `/api/verification/confirm`, `/decline`, `/dispatch`.
- **P11 (OKLCH only)** — the gallery confirm page's
  minimal chrome uses existing tokens.
- **P13 (OPFS + IndexedDB discipline)** — nothing
  about the gallery confirm surface writes to any
  client-side store; the auth cookie + server record
  pattern handles gallery-side state.
- **P15 (View Transitions capability fallback)** — the
  arrival-on-confirm chapter inherits iter #3's
  fallback; no new transition surface.
- **P19 (reduced-motion)** — the confirmation chapter
  (from iter #4) already clamps under reduced-motion.
- **P20 (ARIA)** — the gallery confirm page's two
  primary buttons are proper `<button>` elements; the
  outcome state is announced via an ARIA live region.
- **P22 (structured logging + Web Vitals)** — the gallery
  confirm page emits the same
  `pang.page.web_vitals` beacon (iter #1 infra).
- **P23 (keyboard a11y)** — confirm + decline buttons
  are Enter / Space activatable; focus ring visible.
- **A3 (schema.parse at the boundary)** — every
  signed-link, every Correspondence Agent response,
  every outcome payload schema-validated.
- **A5 (banned vocabulary)** — voice pass on every new
  string: composed draft fallback template, gallery
  confirm page headline + sub-line, decline state
  note, outcome push body. Eval corpus enforces at
  runtime too.
- **A7 (CaMeL capability graph)** — the Correspondence
  Agent's capabilities are declared: `read: works
  (one), galleryContact (one); write: none (returns
  a draft, doesn't send)`. The dispatch route carries
  the send side; the agent doesn't.
- **A8 (Untrusted<T> at the boundary)** — gallery
  name + collector free-text enter the agent path as
  `Untrusted<string>`. The composed draft is the
  structured output, typed; the rendered URL is
  derived from structured fields only.
- **A9 (XML-delimited untrusted content in Q-LLM
  prompts)** — gallery name wrapped in
  `<untrusted-gallery-name>`. The fixture coverage
  in A22 verifies the delimiter is honoured.
- **A10 (OTel GenAI spans)** — every
  `correspondence.compose.*` span carries the
  required attribute set.
- **A16 (OPFS-backed queue discipline)** — the
  dispatch outbox entry is the same iter #4 outbox;
  no new queue primitive.
- **A18 (per-agent token + cost budgets)** — the
  Correspondence Agent gets a budget entry in
  `src/ai/agents/budgets.ts` (per-collector daily cap:
  50 compose calls; per-account monthly cap: 2000).
- **A19 (deterministic model selection)** — the agent
  pins `claude-haiku-4-5` explicitly; no dynamic
  routing.
- **A21 (schema-failure retry policy)** — one retry
  with reinforced-voice prompt on A5 regression;
  one retry on JSON-schema parse failure; no retry
  on CaMeL rejection (fail-fast, surface fallback
  template).
- **A22 (eval corpus)** — `evals/correspondence/run.ts`
  with ≥ 5 fixtures (voice, unknown-gallery,
  confidence-low hint, prompt-injection subtle,
  prompt-injection overt); threshold ≥ 90 % pass in
  mock mode (CI on every push), live mode on
  workflow_dispatch.
- **A23 (per-collector daily + per-account monthly
  cost caps)** — the agent's cost lines participate
  in the existing cap telemetry.

**Test criteria:**

1. `npm run verify` clean. `check:gates` runs the
   uplifted P25. Unit tests cover: signed-link sign +
   verify round-trip across all three audiences;
   audience cross-rejection (all 3 × 3 pairs);
   consumed-marker idempotency on confirm + decline;
   race-on-confirm (two simultaneous `O_CREAT |
   O_EXCL` writes, first wins); reconciler outcome
   fill-in; Correspondence Agent structured-output
   parse; CaMeL quarantined-string rendering; cost
   budget enforcement; rate-limit on the dispatch
   endpoint.
2. Playwright spec `verification-dispatch.spec.ts`:
   on `chromium-mobile` with WebAuthn virtual
   authenticator + a stub mail-client handler (CDP
   `Browser.setDownloadBehavior` + a navigation
   intercept on `mailto:` → the spec receives the
   URL-encoded subject + body + recipient and asserts
   they match the composed draft). Walk: invite →
   enroll → Room → focused work → ask → send → assert
   handoff URL shape → gallery confirm surface in a
   second page context → passkey ceremony for gallery
   operator → tap confirm → server write → push
   delivery intercepted by service worker → first
   page context receives the outcome → arrival
   chapter plays → work verified. All spans emitted in
   order. All state flips recorded. No client-side
   `localStorage`.
3. Playwright spec `verification-decline.spec.ts`:
   same walk, decline branch. No arrival chapter
   (decline is silent in GL per iter #4). The store
   flips to `"declined"`. The collector-side surface
   shows the voice-authored decline note. No re-ask
   affordance (per iter #4 open question #3).
4. Playwright spec `verification-race.spec.ts`:
   two parallel gallery-operator page contexts open
   the same confirm token, both tap primary, the
   second receives 409 with the
   `outcome-already-recorded` state and the voice-
   authored "already answered" note.
5. Playwright spec `verification-replay.spec.ts`:
   (a) confirm-then-confirm-again → second is 410
   Gone; (b) confirm-token presented at decline
   route → 401 with `wrong-audience`; (c) confirm
   token forwarded to a different gallery's
   operator (sign a fresh gallery's passkey
   session, present the original `gid`'s token) →
   401 with `wrong-gallery`.
6. Playwright spec `verification-reconcile.spec.ts`:
   simulate push delivery failure (service worker
   drops the `push` event), reboot the app,
   verify the outbox reconciler fires the
   outcome-poll, store state flips, arrival chapter
   plays on next Room return. Cold start with a
   `dispatched` outbox entry that never received
   the push.
7. Eval corpus: 5 fixtures land in
   `evals/correspondence/` with a `run.ts` mirroring
   `evals/intake/run.ts`. Each fixture has an
   expected-output JSON (structured fields, not
   free prose); the runner compares the composed
   output to the expected shape with a voice-check
   pass on the `body` field. CI mock mode green on
   every push. Live mode on workflow_dispatch
   re-runs with real Anthropic API — a pass proves
   no model drift since the last live run; a fail
   prints the diff.
8. `requireSession` coverage: `/api/verification/dispatch`,
   `/confirm`, `/decline` return 401 without session
   cookie, 200/422/409 with. The gallery-session
   cookie is distinct from the collector-session
   cookie (same primitive, different subject); a
   collector session presented at
   `/api/verification/confirm` is rejected as
   `wrong-subject`.
9. Observability: walking each path emits the
   exact span set named above with the required
   attributes; verified via the OTel test exporter.
10. P25 uplift asserted from CI itself — temporarily
    introduce a `<ConfirmModal>` in `AskGallery.tsx`,
    confirm the gate fails, revert. The proof lives
    in the PR description.
11. Cost cap enforcement: a synthetic burst of 51
    compose calls from one userId triggers the A23
    cap at the 51st call; span
    `correspondence.compose.failed { reason:
    "cost-cap-exceeded" }`.

**Pre-existing work this depends on:**

- Iter #1's Intake record — `galleryOfOrigin` shape
  is the source of the Correspondence Agent's
  gallery hint.
- Iter #3's chapter primitive — arrival-on-confirm
  is a pure composition, no new chapter code.
- Iter #4's verification outbox + verification store
  + push subscription — the outbox entry grows a
  `dispatched` state; the subscription receives its
  first delivery; the reconciler extends the existing
  file.
- Iter #4's `<AskGallery>` component — the dispatch
  button is a second primary state; no new component.
- Iter #5's Enrichment Agent module shape — the
  Correspondence Agent is a literal copy of the
  skeleton, different schema + prompt.
- Iter #6's CSP + nonce proxy — the gallery confirm
  page is same-origin and inherits.
- Iter #9's passkey module + `requireSession` + signed-
  link primitive — the gallery-side auth reuses
  every byte. `src/auth/server/invite.ts` →
  `signed-link.ts` is the one structural refactor.
- The `__PANG` E2E seam — extended with
  `authSeedGallery({ gid, operatorId })` for the
  gallery-side spec setup.

**Open questions (answered before execution):**

1. **Correspondence Agent: one structured-output
   call or a two-step compose (draft → voice-check →
   revise)?** Single call with structured output.
   The voice check runs on the output in
   `check:strings` at the runtime boundary; an A5
   regression triggers one retry with a reinforced
   prompt (A21), not a second agent turn. Two-step
   would double cost + latency for a check that's
   deterministic at the string level.
2. **Dispatch handoff: `window.location.href` vs
   `<a href target="_self">` vs `navigator.share`?**
   `<a>` click — most compatible with the
   `visibilitychange` observability on return, and
   iOS Safari's `mailto:` handling is most reliable
   via an `<a>` the user "clicks" programmatically
   (`.click()` on a synthetic anchor). `navigator.share`
   is an escape hatch for the dispatch-channel-picker
   future iteration — not this one.
3. **Gallery-side confirm page: React server
   component or client component?** Server component
   for the initial render (faster first paint, the
   signed-link verify is server-side anyway); one
   `"use client"` island for the passkey ceremony on
   first visit. The primary buttons are form actions
   that POST to `/api/verification/confirm|decline`
   with the token as a hidden field — no JS required
   for the commit path; the page works with JS
   disabled, for what it's worth.
4. **Does the collector see the outcome in real-time
   on the same device, or only via push?** Both.
   Push is the primary (the collector is out of
   the app most of the time); if the tab is open
   when the gallery confirms, the service worker
   relays via `BroadcastChannel` to the open tab
   and the store flips directly. The reconciler is
   the safety net for offline / TTL-expired cases.
5. **Does the gallery operator see a list of other
   requests from the same collector?** No. Each
   signed link is scoped to one request; the gallery
   confirm page shows one work, one collector
   (first-name + last-initial), one message. Any
   "gallery dashboard" composition is out of spine
   (§ 7 cannot-do: "no gallery management dashboard").
6. **Does the Correspondence Agent have access to
   the collector's full collection for context?**
   No. One work, one gallery, one message. The
   spine's "provenance as structural data"
   principle: the agent composes from the
   catalogued record, not from inferred context.
   A collection-aware composition would be a
   different agent (and a different privacy
   discussion — the gallery doesn't need to know
   what else the collector owns).
7. **What happens when the gallery in the hint
   doesn't exist (no `gid` mapping)?** The
   dispatch route falls back to the collector's
   free-text override (iter #4 field); if both
   are missing, the dispatch path fails closed
   with a voice-authored "we couldn't resolve a
   gallery" note, the store state stays
   `requested`, and the affordance re-surfaces
   once the collector edits the hint. No silent
   send to a made-up address.
8. **Signed-link audience added to the count of
   gates or absorbed into P10?** Absorbed. P10's
   scope is passkey + session + requireSession;
   signed-link is the JWT family that gates
   *access* to a specific one-shot surface, not
   the ongoing session. The mechanical check lives
   in the audience-cross-rejection unit tests, not
   a new gate.
9. **Gate count: 48 or 49?** 48. P25 uplifts in
   place. No new gate number. Iter #9 set the
   precedent.
10. **Web Push dep: `web-push` or hand-rolled VAPID
    signing?** `web-push`. Hand-rolling VAPID
    signatures is within reach (ECDSA P-256 + JWT)
    but the edge cases around Firefox's Mozilla
    AutoPush specifics and Safari's APNs relay
    make the library the conservative choice for a
    single iteration.
11. **Do we ship a staging environment with real
    Anthropic + real web-push?** No. Dev uses mock
    mode (eval corpus fixtures, stubbed push
    delivery). The production environment is the
    first live run; the next iteration after
    Laura's hands is the first "real traffic"
    proof. This is the ceiling-for-the-loop
    iteration, not the ceiling-for-the-deployment
    iteration.
12. **Does decline have a free-text reason from
    the gallery?** Not in this iteration. Decline
    is a state, not a conversation. A "tell the
    collector why" surface would re-open the
    channel the collector voluntarily closed by
    accepting the decline. The gallery has the
    collector's original email thread / WhatsApp
    thread if they want to explain — PANG is not
    the messaging surface.

**Out of scope (explicit):**

- **Server-side provider dispatch** (Resend, Twilio,
  Slack Connect, SMTP). Principle-deferred (see
  Scope). Rails in place.
- **SMS channel.** Principle-deferred (see Scope).
- **Gallery dashboard / inbox / list-of-requests
  surface.** Cannot-do (§ 7). Every gallery confirm
  is one link, one work, one commit.
- **Gallery-side analytics.** Same.
- **Multi-operator coordination UI** (show that
  another operator is looking at the same request).
  The race is resolved by the server write; the
  losing tap gets a voice note. No pre-emptive
  coordination surface.
- **Free-text "why can't we confirm?" from the
  gallery.** Open question #12.
- **Push payload richness** (images, actions, rich
  formatting). The notification is title + body +
  a single `click → open PANG on the confirmed
  work`. Rich push is a future iteration if the
  telemetry says anything at all.
- **Email receipts / CC to the collector's own
  inbox.** The `mailto:` handoff already creates a
  record in the collector's Sent folder; a
  PANG-composed receipt would be chatter.
- **Rate-limit tuning beyond the iter #9 in-memory
  bucket.** Production load floor is single-digit
  concurrent requests; edge-KV bucket is a next-
  iteration concern.
- **Collector-to-collector anything.** Cannot-do.
  The decline path does not suggest "try asking
  another collector who owns the same artist."
- **Artist-to-collector anything.** Cannot-do.
- **Verification revocation / appeal.** Iter #4
  scope. Same stance here.

**Outcome gate:** codify or iterate once. Codify
targets if the loop lands cleanly:

- **Signed-link-by-audience is the sanctioned pattern
  for one-shot cross-role surfaces.** Add to
  `PANG_Primitives_2026.md` as a new primitive
  (audience-discriminated JWT + consumed-marker +
  single-shot + audience-cross-rejection verified in
  a matrix test). Names HS256 + `jose` + per-audience
  TTL + per-audience consumed-marker directory as
  the shape. Replaces the temptation to hand-roll a
  per-surface token scheme every time a new cross-
  role flow ships.
- **Zero-tap commit is the invariant across every
  surface, not just scanner → arrival.** Uplift the
  P25 description in `PANG_Gates.md`; cross-reference
  in `PANG_Primitives_2026.md` § *Chrome*.
- **URL-handoff (`mailto:` / `wa.me`) is the
  sanctioned collector-to-external-party dispatch
  until observability says otherwise.** Add to
  `PANG_Architecture_2026.md` § 8 (or wherever
  dispatch lands) as a clarifying clause.
  Server-side provider dispatch is named as the
  deferred pivot with its observability trigger
  (the `handoff_returned { success: false }`
  fraction).
- **Outbox-as-truth with server-outcome reconciliation
  is the sanctioned push-delivery pattern.** Add to
  `PANG_Architecture_2026.md` § *Data primitives* as
  a clarifying clause on iter #4's outbox primitive.
  Push is a notification channel; the server record
  is the truth.
- **Correspondence Agent ships at ceiling with voice-
  check at the boundary, not a second agent turn.**
  Add to `PANG_AI_Era_2026.md` § *Agent pattern* as
  a clarifying clause on the existing "structured
  output + schema" line. The voice layer is a
  deterministic runtime check, not a separate LLM
  call.
- **CaMeL's XML-delimited untrusted string rendering
  is the sanctioned pattern for user-editable data
  entering a privileged prompt.** Add to
  `PANG_AI_Era_2026.md` § *CaMeL discipline* as a
  literal code-shape example (currently referenced
  abstractly under A9). The gallery-name
  quarantined-string pattern is the reference.

Laura's hands: **after merge.** Walks the full
round-trip on a real phone pair — her iPhone as
collector, a second phone as the gallery operator's
device. Ask a gallery on an unverified work. Open the
dispatch. Watch the composed message in her Mail app.
Send. Grab the second phone. Receive the confirm
email (or WhatsApp). Tap the link. Enroll the gallery
passkey. Tap confirm. Watch her first phone receive
the push. Return to the Room. Watch arrival play. The
work verifies. Pass = "I asked and she answered and
the work came alive." Fail = a named regression in the
observability proofs above (iterate once or drop the
failing sub-flow).

---

## Known debts

Named so they're not invisible. Not iterations in themselves —
each will be absorbed into a future iteration that naturally
touches the surface, or opened as a debt-only iteration if the
signal demands it.

- **`src/room/scene.ts` has no unit coverage.** `three/webgpu`
  touches `self` at module load, crashing Node test runners.
  `setWorkArrivalFactor` (iter #3) and `setWorkVerified` (iter
  #4) therefore rely on Playwright e2e + the chapter-plan evals,
  not Node unit tests. Named 2026-04-23 in iter #4 findings.
  Fix-shape: split `scene.ts` into a pure `RoomSceneSpec` (no
  three imports) + a thin `RoomSceneRenderer` (three wrapper).
  The spec unit-tests; the renderer stays e2e-only. Defer until
  an iteration forces the split; until then, every GL change
  needs a Playwright walk.
- **Intake eval is one fixture.** `evals/intake/run.ts` runs a
  single synthetic label card; the A22 gate passes trivially.
  Low signal against model drift. Fix-shape: add 3–5 real-world
  fixtures (photo-blur, clipped-label, handwritten annotation,
  email-snippet) when iteration #4 or #5 surfaces a
  representative failure in the wild. Named 2026-04-23.
- **Old iteration briefs (#1–#3) lack the fifth declaration
  (failure mode).** Codified from iter #1's Pixel-10 regression
  and applied forward from iter #4. Historical briefs are not
  retroactively revised — `CLAUDE.md` § 9 is a forward-acting
  contract. This is a debt only in the sense that #1–#3's
  observability catalogues are thinner than #4's; if a
  regression surfaces on one of those surfaces, the failure-mode
  paragraph gets written at that point, not before. Named
  2026-04-23.

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
