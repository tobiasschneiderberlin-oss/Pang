# PANG — The Spine

> The single continuous experience PANG delivers. Not a feature list —
> a journey. If a feature doesn't appear in the spine, it doesn't
> belong in the app. The spine is the contract.
>
> Sits above `CLAUDE.md` in priority. `CLAUDE.md` is *how* we build.
> `PANG_Spine.md` is *what* we build.
>
> Last updated: 2026-04-24 — iteration #9 landed: spine moment #7
> (Passkeys auth) is wired end-to-end. The collector's invite link
> binds to a passkey on their device; `requireSession` gates every
> non-public API route; the session rides an opaque bearer cookie
> backed by server-side state. "Laura is the baseline" now means
> session identity, not seed data. Earlier 2026-04-22 — iteration
> #1 findings codified: the scanner review form is dropped (intake
> is zero-tap from capture to arrival; fields are editable later on
> the detail surface). See gate P25.

---

## The spine

Laura receives an invite link from her gallery. She taps it on her
phone. The PWA installs itself to the home screen on the tap after the
first arrival ceremony — by then the app has already earned it.

She opens PANG and enters her collection as a space. The room breathes
with the time of day — warmer in morning, cooler at night. Works hang
at their true relative sizes. A work with something alive is lit
slightly warmer; her eye finds it without being told. PANG speaks one
line, quietly: *"Lee opens in Brussels tomorrow."* Then silence.

Laura approaches a work. The room doesn't exit — it zooms. Provenance
surfaces as the work fills her field of view: images of the work in
past contexts (museums, fairs, studios, other homes) fade in as she
spends time with it. PANG names one fact: *"Painted during the
Copenhagen residency, 2019."*

She pinches into the paint. Brushstrokes, canvas weave, the artist's
hand. Pinch out returns her to the room in one motion.

Around the work, documents exist as evidence — the CoA with its
actual signature, the invoice with its real price, condition reports
as photographs. Tactile, gesture-accessed, not a grid of
administrative slots.

When Laura adds a work, the live camera opens immediately. Rectangle
detection tracks the artwork edges; non-rectangular works (sculptures,
objects, stretched canvases off the wall) are held by a segmentation
fallback. Auto-capture fires on stability. The Intake Agent — Claude
Vision with structured output and CaMeL safety on anything
document-sourced — pre-fills what it can read. **Arrival is the next
thing Laura sees.** No review form, no field-by-field confirmation.
The work appears center-stage, lit; PANG speaks one specific line —
*"Your first Japanese artist"* or *"Your fourth Hojgaard, the
largest"* — and the work's provenance images and pre-filed documents
arrive as artifacts, one by one. The work then hangs itself in the
room. Anything the agent could not read surfaces on the detail
surface as editable later, in Laura's time. Laura is back in the
spine, with one more work.

Occasionally, PANG offers Laura a short reading of the collection —
one paragraph, monthly at most. Observation, not evaluation. Something
she might show her partner.

Between sessions, PANG is quiet. No push notifications beyond
gallery-originated verification outcomes she explicitly subscribed to.
No transactional prompts. She decides when to enter.

---

## Cross-cutting layers

Not features. Horizontal concerns every surface participates in. Built
once, consumed everywhere.

1. **PANG Voice.** One character speaks everywhere. Specific,
   observational, literate, quiet. Never evaluative, never commercial,
   never generic. Claude generates; PANG speaks. Laura never sees
   Claude. See `PANG_Voice.md`.

2. **Time.** A single clock shapes room light, arrival field warmth,
   detail surface tint, the rotation of ambient copy. One palette,
   pervasive.

3. **Provenance.** Structured data contributed by every gallery,
   museum, fair, estate, and auction house in a work's life. Surfaces
   as timeline, as arrival chapter content, as PANG's narrator facts,
   as spatial hints in the room. **Contributors supply data; they do
   not speak.** This is the structural guarantee against commercial
   capture — no party in a work's history has a direct voice channel
   to the collector.

4. **Gestures.** One grammar. Pinch in = closer to a work. Pinch out
   = back toward the room. No modal interruptions. No
   confirm-for-confirm's-sake. Consistent from the room to the paint
   and back.

5. **Trust.** The verification line is visible at the level of each
   work. Verified = alive, with depth. Unverified = present, but
   flat. The path from flat to alive is one tap (*Ask your gallery to
   confirm*).

---

## Operating rules

1. **The spine is the contract.** If a feature doesn't appear in the
   spine, it doesn't belong. Reframe it or drop it.

2. **Every feature connects to at least two others.** Before starting
   a sprint, name what the feature pulls from (existing state/data)
   and pushes to (the next surface). Islands get reframed or dropped.

3. **Cross-cutting concerns are global.** Voice, time, provenance,
   gestures, trust are built as horizontal layers every surface reads
   from. They don't live inside any one feature.

4. **End-to-end walk at every sprint close.** Open link → install →
   room → approach work → detail → paint → document → back → scan →
   arrival → new work in room. Does the iteration live *in* this walk
   or *beside* it? If beside, it's wrong.

5. **The spine doc shortens as the app strengthens.** A landed sprint
   should make this document tighter, not longer. Accumulation is the
   failure mode.

6. **Aim for the ceiling.** The spine describes 2026 experiences; the
   implementation has to reach them. Every surface brief declares
   four things before code starts — scope, stack, reference, canvas
   — and a missing declaration produces the training-mean
   implementation by default. See `CLAUDE.md` § *Reach forward, not
   back* and `PANG_Primitives_2026.md`.

7. **48 gates are mechanical, not editorial.** P1–P25 (PWA +
   primitives + design tokens + zero-tap review) + A1–A23 (AI) are
   checked in CI, not in review comments. See `PANG_Gates.md`.

8. **Moments never stand behind forms.** If a spine moment is
   meant to *be felt* — arrival, approach, paint-depth — no input
   field, dropdown, or required confirmation sits between the
   gesture that opens it and the moment itself. Fields belong on
   the detail surface, where editing is the explicit intent. This
   is the principle behind P25 and it generalises: every future
   moment is checked against it before a review UI is proposed.

---

## What the spine eats

Making the spine explicit consolidates the queue. Several items stop
being features and become moments inside the spine:

- **The pulse strip** — eaten by spatial lighting (alive works lit
  warmer)
- **The 2-column grid as home** — demoted to a fallback; the room is
  home
- **The wall-level noteworthy reweight** — eaten by spatial
  positioning
- **The arrival ceremony as a standalone screen** — eaten by the
  arrival chapter inside the room
- **The scanner review form** — eaten entirely by the arrival
  chapter. There is no review step between capture and arrival; the
  work appears on Laura's wall immediately and anything the agent
  could not read is editable later from the detail surface. A review
  form forces the collector into cataloger mode at the exact moment
  she is meant to be arriving. Codified 2026-04-22 (iteration #1).
  Enforced by gate P25.
- **The Earned Wall (progressive feature disclosure)** — dropped; not
  in the spine
- **Ask the Collection (text input)** — parked; not in the spine
- **Gallery News (commercial channel)** — parked; explicitly separate
  from the spine if we ever build it
- **Native app shell** — dropped 2026-04-21; PWA is the runtime
- **App-store distribution** — dropped 2026-04-21; gallery-shared
  link is acquisition

The spine is the move. Everything else is either an ingredient of the
spine or a branch we have chosen not to build.

---

## Feature challenges — out of spine

The cuts below are not deferrals — they are out-of-spine items that
produce queue rot if left as "maybe later." Each has a rationale tied
to a spine property.

- **Collector-to-collector surfaces (dropped).** PANG is not a social
  network (see *What PANG is not*). Collector-to-collector surfaces
  compete with the room-as-residence posture. Gallery-mediated
  inquiries, if they ever return, are a separate lane — not a feature
  inside the spine.
- **Artist-to-collector channel (dropped).** Provenance is the
  structural answer. No party in a work's history — gallery, museum,
  artist, estate, auction house — gets a direct voice channel to the
  collector. That's the guarantee against commercial capture (§
  *Provenance*).
- **The ActionSheet between wall and scanner (dropped).** One tap
  from the collection surface to the live camera is sacred. Any menu
  that sits between them converts the scanner from a gesture into a
  choice.
- **Batch document upload as a primary flow (dropped as a headline
  feature).** Documents arrive pre-filed via gallery supply and
  one-at-a-time via scan. A standalone batch importer doesn't belong
  at the front.
- **The wall as a separate home surface (demoted).** The Room is
  home. The grid wall is a low-end-device fallback.
- **Magic Link OTP as the auth floor (upgraded to Passkeys).**
  One-gesture-to-open is a product feature. Email round-trips break
  the contract that PANG is ambient, not transactional.
- **Audio on by default (cut).** Spatial audio in iteration #11 is
  opt-in. Silence is the default.
- **Native shell (dropped).** The browser is the 2026 runtime. PWA
  + WebGPU + WebAuthn + OPFS + View Transitions cover the spine at
  ceiling.
- **App-store distribution (dropped).** The gallery's invite link is
  acquisition and install in one gesture. No App Store, no Play
  Console, no TWA.
- **Platform bridge (dropped).** `navigator.vibrate` covers the
  haptic vocabulary; WebAuthn platform authenticators cover
  biometrics. No plugin earns its keep.

The discipline is that each of these leaves the planning space, not
just the build queue.

---

## Build order (Option B — Intake Agent first)

This order is derived from the spine, not from chronology. Every
sprint is named for the spine moment it advances, and every sprint
aims for the ceiling unless the kickoff brief explicitly down-scopes.

**Two infrastructural iterations lead.** They don't advance a spine
moment directly, but every later ceiling depends on them.

**0. PWA reset.** Delete the old `pang/` prototype (moved to
`_archive/`). Stand up Next.js 16 + React 19 + Tailwind v4. Ship
`manifest.webmanifest`, service worker with Workbox + Navigation
Preload, OPFS bootstrap, CSP headers, installability check.
`/healthz` passes P1–P10. No UI yet.

**1. Intake Agent (Option B).** The canonical "wow moment." Live
camera on entry (one tap from wall → viewfinder), rectangle detection
in a Web Worker, stability-based auto-capture, perspective warp on
device, Claude Vision structured output with Zod validation, CaMeL
pattern for any document-sourced content, arrival chapter on confirm.
Lands the full 48-gate ceiling for a single vertical slice. See
`PANG_AI_Era_2026.md` § *Intake agent* for the architecture and
`PANG_Aha_Sprint.md` iteration #1 for the kickoff brief.

**Then the spine moments, roughly in the order the collector
encounters them.**

2. **The Room — ceiling.** The home surface at its upper bound:
   WebGPU (with WebGL 2 fallback) via Three.js on `<canvas>`, orbital
   camera, works at true relative size in a navigable space,
   time-of-day lighting and alive-works-lit-warmer rendered in the
   canvas itself. Eats the pulse strip, the grid-home, and the wall
   reweight.

3. **Arrival as chapter v2.** Rebuild the ceremony into a 30–45s
   chapter inside the Room. PANG's voice narrates, pre-filed
   documents arrive as artifacts, the work hangs itself. Depends on
   Voice and the Room.

4. **Enrichment Agent.** Backend + minimal gallery/museum UI for
   uploading provenance images and structured notes on owned works.
   No freeform prose from contributors. Powers the "approach a work"
   moment.

5. **Documents as evidence v1.** Rebuild the 5-slot grid into a
   tactile, gesture-accessed archive around the work. Actual
   signature on the CoA, actual price on the invoice.

6. **Deep Zoom, collection-wide.** *Landed 2026-04-24, iter #7 +
   iter #8.* OpenSeadragon on `<canvas>` behind `<DeepZoom>` in
   iter #7; three seeded works (Vermeer, Van Gogh, Rembrandt) at
   ≥ 4000px long edge with build-time DZI pyramids, OPFS
   tile-cache with cold/warm attribution, and Room second-tap
   escalation in iter #8. Laura can stand in front of her Van
   Gogh and see the paint strokes.

7. **Passkeys auth.** *Landed 2026-04-24, iter #9.* WebAuthn primary
   via `@simplewebauthn/{server,browser}@11`; invite JWT (HS256 via
   `jose`, 14d TTL, single-use via consumed-`jti` markers) trades for
   a short-TTL bind cookie; platform-authenticator + resident-key +
   required-UV enrollment; opaque 32-byte bearer cookie
   (HttpOnly+SameSite=Strict+Path=/, `Secure` in prod) backed by
   server-side session records; counter-rollback clone detection
   revokes the credential to a separate directory (audit trail
   preserved). `requireSession()` gates every non-public API route;
   P10 uplifts from trivial-pass to mechanical enforcement across
   `app/api/**/route.ts`. Magic Link OTP remains principle-deferred
   until observability shows Tier-C devices arriving.

8. **Verification request flow.** Intake detects gallery of origin;
   PANG pre-writes the message (email or WhatsApp, collector
   chooses); one tap to send. Gallery's side is a two-tap confirm
   surface. Correspondence Agent owns the prose.

9. **PANG Voice v1.** *Landed 2026-04-24, iter #12 + audit sweep
   iter #13.* Tone reference (already in `PANG_Voice.md`) +
   `PANG_VOICE_SYSTEM_PROMPT` wired into every Claude call + audit
   of every hand-authored string. The voice layer every other moment
   consumes. A24 (seed on every privileged P-LLM call) + A25 (every
   user-facing string resolves through `PANG_VOICE_STRINGS` under
   the default-pipeline smoke) land as mechanical gates. Iter #13's
   audit sweep closed 58 → 0 A25 violations; the commit log is the
   audit log.

10. **Narrative Agent — monthly reading v1.** *Landed 2026-04-24,
    iter #14.* One paragraph, observational, never evaluative.
    Monthly cadence enforced by a filesystem-backed idempotency
    marker (`primitive 68`); unchanged-collection branch short-
    circuits the P-LLM round-trip via a SHA-256 shape-hash gate
    (`primitive 70`). Delivered in the Room as a quiet overlay with
    passive-surface semantics (`primitive 69`) — visible because
    the collector arrived and hasn't dismissed this month, not
    because a "show" event fired. Closes the four-agent
    architecture (Intake, Enrichment, Correspondence, Narrative).

11. **Spatial audio + haptics (opt-in).** *Landed 2026-04-24, iter
    #15.* The Room acquires an acoustic body; arrival acquires a
    physical one. Silence is the default; sound happens only when
    Laura turns it on. Web Audio graph (brown noise → 400 Hz low-
    pass → HRTF `PannerNode` → master `GainNode`) tracks focused-
    work position; a guarded `AudioContext` factory
    (`primitive 71`) is the only door. `navigator.vibrate` flows
    through a four-kind dispatcher (`primitive 72`) at four call
    sites: scanner rectangle-lock, capture shutter, Room focus,
    ArrivalChapter settle. Both opt-ins default `"off"`
    (`primitive 73`) and persist through OPFS. Shipping chrome
    affordance: `SettingsOverlay` via Popover API + CSS Anchor
    Positioning.

12. **Verify-for-club (conditional).** Only if post-Laura signal
    supports it. Otherwise dropped.

Everything outside this list — Voice Notes, Time Machine, Ambient
Mode, Ask the Collection, Earned Wall, collector-to-collector
surfaces, artist-to-collector channel, ActionSheet, BatchUpload as a
primary flow, native shell — is parked or dropped per § *Feature
challenges* above.

---

## The one test

If Laura picks up PANG via the gallery's link and uses it for five
minutes without being told what it does, she should feel she walked
into *a collection*, not that she opened an app. The spine is what
makes that possible.
