# PANG

> What this is: the product, in one document. If it's not here, it
> doesn't exist yet. For HOW we build it, read `CLAUDE.md`. For the
> strategic contract (Laura's journey through the app), read
> `PANG_Spine.md`.
>
> Last updated: 2026-04-25 — v1 build pipeline closed; spine items
> 0–11 in `main`. Iter #21 (post-Laura test) added a grid view as
> the default home with the Room as a one-tap toggle: PANG opens
> as a familiar overview, the Room is the depth on top. See
> `PANG_Spine.md` for the contract and `PANG_Aha_Sprint.md` §
> Status for the iteration map.

---

## What PANG is

A free Progressive Web App where art collectors build, verify, and
deepen their private collection. Gallery-powered, collector-owned. The
collection gets richer as trust accrues through verification.

The collector receives PANG as an invite link from their gallery. They
tap the link, the PWA installs itself to the home screen, and on first
open they are standing inside their collection as a space. No
download, no App Store, no signup form. The gallery is the
distribution; the browser is the runtime.

---

## The verification line

This is the central concept. Everything in PANG exists on one side or
the other.

**Unverified** — the collector added it themselves. A photo, some
metadata, a personal record. Useful. Private. Flat.

**Verified** — a gallery confirmed it. Now the work comes alive:
provenance, documents, artist context. It counts in the collector's
stats, identity, and the quiet reading of the collection's shape.

The line creates the incentive: collectors want verification,
verification requires a gallery, galleries join because collectors ask
them to.

Every unverified work is a dormant growth trigger. The app makes
crossing the line effortless and inevitable.

---

## Three interactions

Everything else is depth that emerges from these.

**Scan** — Add a work. Live camera, photo roll, forwarded email,
photographed certificate. The Intake Agent (Claude Vision + structured
output + CaMeL safety) handles recognition and extraction. No forms.
No typing. If confidence is high, it just does it. This is onboarding,
daily use, and the "show a friend" moment — one gesture.

**Verify** — Request gallery confirmation. PANG detects the gallery
of origin from the intake data, pre-writes the message (email or
WhatsApp, collector chooses), one tap to send. The gallery receives,
confirms, the work crosses the line. This is the virality trigger.

**Collection** — The quiet view of everything owned. Verified works
have depth. Unverified works show what's possible (*"3 collectors own
works by this artist — connect your gallery to join"*). This is the
emotional home.

---

## Two intake paths

**Path 1: Gallery-prepared.** Gallery is on PANG. Artlogic (or
equivalent) sync pre-populates the collector's collection. Zero
effort. Open the link, your collection exists. This is the magic first
impression.

**Path 2: Collector-added.** For works from galleries not yet on
PANG. Share a photo. Forward a purchase email. Photograph a
certificate. The Intake Agent extracts everything. The work appears.
PANG auto-detects the gallery and prepares a verification request.

Path 1 is the onboarding wow. Path 2 is the growth engine.

---

## Virality loop

Gallery A onboards → its collectors receive invite links → collectors
also own works from Gallery B → they request verification from B →
Gallery B onboards → B's collectors receive invite links → they own
works from Gallery C → repeat.

The intake itself is the trigger. Adding a work from an unconnected
gallery naturally flows into requesting verification. No separate
"growth feature" needed.

---

## Gallery onboarding

Must be frictionless regardless of what system the gallery uses.

**Minimum viable onboarding:** Gallery receives a verification
request. They confirm: *yes, this work belongs to this collector.*
Done. Any gallery can do this in 30 seconds, whether they use
Artlogic, ArtButler, FileMaker, or a notebook.

**Enhanced onboarding:** Gallery connects their Artlogic feed (or
other system). Full catalog syncs. All their collectors get
pre-populated collections. Optional but powerful.

The minimum path preserves the virality loop. The enhanced path
deepens the experience. Never gate growth on a technical integration.

---

## Business model

**Collectors:** Free. Always. Pay only for premium transactions
(blockchain verification, special certificates, extended services).
No subscription.

**Galleries:** Small subscription. Not Artlogic / Artsy pricing. Easy
to say yes to. They get: collector engagement, verification tools,
presence in their collectors' most personal digital space.

**Start free. Monetize after the network has value.**

---

## What PANG is not

- Not a gallery management tool (Artlogic does that)
- Not a marketplace (no transactions, no prices)
- Not a social network (no posts, likes, follows, messages between
  collectors)
- Not a direct artist-to-collector channel — provenance is the
  structural answer; no party in a work's history gets a direct
  voice channel to the collector
- Not a subscription product for collectors
- Not ambient audio by default (spatial audio and haptics are opt-in,
  silent until the collector turns them on)
- Not a themeable product. PANG ships one opinionated base design;
  the collector tunes it through nine bounded knobs (time source,
  warmth intensity, wall density, room scale, motion, audio,
  haptics, display name, light/dark). No custom colors, no custom
  fonts, no layout injection. See `PANG_Architecture_2026.md` § 1.5.
- Not a native app (PWA only — no Capacitor, no App Store, no Play
  Console, no TWA wrapper)
- No push notifications beyond gallery-originated verification
  outcomes the collector explicitly subscribed to
- No emojis, no gamification, no badges, no follower counts, no
  streaks

---

## How it's built (reference only — detail in `CLAUDE.md`)

- **PWA at the ceiling.** Next.js 16 + React 19 + Tailwind v4. WebGPU
  with WebGL 2 fallback for primary art surfaces. Camera, passkeys,
  OPFS, Navigation API, View Transitions, Declarative Web Push — all
  browser primitives.
- **Distribution = gallery-shared link.** Link opens the PWA; the
  install prompt fires after the first arrival ceremony.
- **AI is the interface.** Four agents: Intake (live now), Enrichment,
  Narrative, Correspondence. See `PANG_AI_Era_2026.md`.
- **Camera-first, confirm-not-create, no typing.**
- **Build at the ceiling, not the floor.** Every surface aims for its
  ambitious implementation by default. Proof-of-principle probes are
  legitimate but explicit.
- **The prototype *is* the product** — built once at ceiling, learned
  from, iterated. Not a throwaway on the path to a "real" version.
- **Primary art surfaces render on `<canvas>`, not DOM.** React adapts
  around them.
- **48 gates** enforce this mechanically. See `PANG_Gates.md`.

---

## The documents layer

Least visible, always available. Everything needed from an admin and
legal side — CoA, invoices, condition reports, insurance — digitized,
in one place. Not the headline feature. The safety net. Available
when the insurance company calls or when planning an estate.

---

## Open questions

- **Artlogic architecture:** Read the feed live on demand (leaner)
  vs. sync into our own DB (offline-capable). Tradeoff between
  simplicity and independence. Decided in the iteration that needs
  it.
- **Voice layer scope:** How narrow does PANG's voice stay? One
  character, observational, non-evaluative — but what does it *not*
  speak to, even when data is available? `PANG_Voice.md` is the
  landing.
