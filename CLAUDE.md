# PANG — Build Doctrine

> How we build. Not what we build.
>
> WHAT we build lives in `PANG.md` (product), `PANG_Spine.md` (strategic
> contract), `PANG_Voice.md` (character + strings), and
> `PANG_Aha_Sprint.md` (active iterations). HOW lives in this file,
> `PANG_Architecture_2026.md`, `PANG_Primitives_2026.md`, `PANG_Gates.md`,
> and `PANG_AI_Era_2026.md`.
>
> Nine docs. No more. Everything else is in `_archive/` because it was
> distracting us from building the app.
>
> Last updated: 2026-04-22 (second pass) — gates extended to 48
> (P25 — zero-tap review — codified from iteration #1; see
> `PANG_Gates.md` and `.pang/gates.yaml`). Earlier the same day:
> gates extended to 47 (P23 a11y floor, A21 retry policy, A22
> eval corpus, A23 cost cap); new § 6 on how guardrails and agile
> iteration coexist.

---

## 1. What PANG is, in one paragraph

PANG is a **2026 production Progressive Web App** that art collectors
receive as an invite link from their gallery. They open the link, the
app installs itself on the home screen, and they enter *their
collection as a space*. Verified works come alive with provenance,
documents, and artist context. Unverified works are dormant growth
triggers: every unverified work wants a gallery behind it, and
requesting verification is a one-tap gesture. The collector never pays.
The gallery pays a small subscription. The app is silent between
sessions — no push nudges, no growth tricks, no gamification.

If a decision you are about to make makes the collector's relationship
to their collection *louder* (marketing, chatter, chrome), it is
wrong. If it makes the relationship *clearer* (provenance, scale,
quiet), it is right.

---

## 2. The pivot: PWA at the ceiling, no native shell

PANG is **a PWA, period**. Not a React Native app. Not a Capacitor
shell around a web view. Not a Flutter port. The browser is the
runtime, and in 2026 the browser is enough — WebGPU (with WebGL 2
fallback), WebAuthn passkeys, OPFS + IndexedDB, View Transitions,
Navigation API, Declarative Web Push, Anchor Positioning + Popover API,
the Web Codecs family, a camera with `ImageCapture` focus + torch
control, haptics through `navigator.vibrate`. Everything the spine
asks for has a browser primitive behind it.

Distribution is **gallery-gated and link-first**. The gallery shares
one URL. The URL opens the PWA. The PWA prompts install at the right
moment (after the first arrival ceremony, not on landing). There is no
App Store submission, no Play Console, no TWA wrapper, no signing
identity to renew annually. The gallery's existing relationship with
the collector *is* the acquisition channel.

The pivot forecloses a large family of defaults (Capacitor plugins,
hybrid splits, two-codebase paranoia) so the 2026-native ones can
surface. See `PANG_Architecture_2026.md` for the full stack.

---

## 3. The nine docs (the only docs)

| # | Doc | What's in it | Read when |
|---|-----|--------------|-----------|
| 1 | `CLAUDE.md` | This file. Doctrine, process, cannot-do list | Every session start |
| 2 | `PANG.md` | Product definition — verification line, three interactions, virality | Onboarding new contributors |
| 3 | `PANG_Spine.md` | Strategic contract — Laura's journey, layers, build order | Before starting any sprint |
| 4 | `PANG_Voice.md` | Character + full string reference | Before writing any string |
| 5 | `PANG_Aha_Sprint.md` | Iteration log — kickoff briefs, findings, codify/drop | Every iteration |
| 6 | `PANG_Architecture_2026.md` | Stack, distribution, state, AI infra, cannot-do | Before touching infra |
| 7 | `PANG_Primitives_2026.md` | 20+ 2026-native primitives with enforcement | Before writing any UI |
| 8 | `PANG_Gates.md` | 48 mechanical gates (P1–P25 PWA + A1–A23 AI) | CI; every PR |
| 9 | `PANG_AI_Era_2026.md` | Four-agent architecture, AI-era UI primitives | Before wiring any Claude call |

Everything else — old sprint plans, API landscape reviews, wireframe
exports, gallery reference HTML, simulated-Marc interviews, the old
`pang/` prototype — lives in `_archive/`. If an archived doc proves
load-bearing for a decision, either **the decision is wrong** or **the
doc should be absorbed into one of the nine.** Absorb; do not
re-surface.

---

## 4. Option B: Intake Agent first

The build resumes with **one agent before any others**: the Intake
Agent. It is the agent that turns a photo, a forwarded email, or a
certificate scan into a structured artwork record the collector can
confirm with one tap.

The rationale is surgical. Intake:

- Hits every P-gate (PWA primitives) because the live camera + OPFS
  staging + View Transitions to arrival chapter exercise the full
  stack.
- Hits every A-gate (AI) because Claude Vision + structured output +
  prompt-level untrusted-data discipline + observability spans are all
  load-bearing from the first frame.
- Produces the spine's first "wow" moment on a cold install, which is
  what the gallery needs its invite link to deliver.
- Is measurable. Either Laura scans her first work in under 90 seconds
  and ends inside arrival, or she doesn't.

Intake lands at the **full 48-gate ceiling**. No "we'll add OPFS
later." No "observability is a v2 thing." No "we'll ship a form first
and camera second." The kickoff brief declares scope = ceiling, stack =
per Architecture doc, reference = catalogued in Primitives doc,
canvas = `<canvas>` for viewfinder + DOM chrome. A missing declaration
produces the training-mean implementation; the brief will not sign
without all four.

Enrichment, Narrative, and Correspondence agents follow in that
order. Each earns its slot by landing Intake's next spine-adjacent
moment. See `PANG_AI_Era_2026.md` § *Agent order*.

---

## 5. Reach forward, not back

Models trained on prior code skew toward prior code. Shelf-packs,
`columns: 2` masonry, `touchstart` handlers, Framer Motion tweens,
`backdrop-filter: blur(40px)`, `JSON.parse(response)` without a schema,
a REST route per AI call — every one of them defensible individually,
and together a 2018 app wearing 2026 copy.

Four moves are the enablers. They appear in every kickoff brief.

1. **Constrain the stack, not the concept.** "WebGPU with WebGL 2
   fallback" forecloses the default; "spatial" leaves it open and a
   shelf-pack quietly shows up.
2. **Name a reference, not an adjective.** Apple Liquid Glass, Photo
   Memories, Bruno Simon, Arc Browser, Granola confidence, Cursor diff
   UI. A reference points outside the training mean; adjectives point
   at it.
3. **Question the canvas before committing to it.** React is one
   possible canvas, not automatically the canvas. Primary art
   surfaces (The Room, the viewfinder, arrival chapter) render on
   `<canvas>`; React adapts around them.
4. **Scope sessions by ambition, not timeline.** Proof-of-ceiling is
   the default. Proof-of-principle is legitimate but explicitly named
   in the kickoff brief with a defensible reason. Unnamed ambition
   loses to the timeline every time.

See `PANG_Primitives_2026.md` for the catalogued references. See
`PANG_Gates.md` for the mechanical enforcement of each move.

---

## 6. Guardrails are subtractive; iteration is discovery

The goal of the nine docs is not to specify what to build. It is to
specify what **kind of thing falls outside the wall.** Inside the
wall, every iteration is a discovery loop. The docs are
constitutional, not legislative: they constrain the *space* of
permissible solutions; the solution itself is found by building.

This is the balance we commit to: **hard guardrails against 2018
regression, full freedom inside the guardrails.** A waterfall spec
and a trackless field are both failure modes. The nine docs are
neither.

### Four mechanics make this work

1. **Gates check; docs teach.** The 48 gates are mechanical — CI
   fails the build on regression. The docs are read for orientation.
   You cannot ship code that drifts to 2018, but you can ship any
   2026 code you can imagine.

2. **The kickoff brief is the freedom-and-constraint joint.**
   Scope / Stack / Reference / Canvas commit the iteration to the
   2026 surface. Test criteria + out-of-scope + outcome gate let it
   iterate without re-planning. Within those rails, the
   implementation is yours to find.

3. **Codify / Iterate once / Drop is the metabolism.** Every
   discovery during the build lands somewhere — it becomes a doc
   line + gate (*codify*), a single second pass (*iterate once*), or
   a subtraction (*drop*). No discovery sits as a "we should think
   about this" indefinitely.

4. **Docs grow by subtraction.** A landed sprint should make the
   relevant doc *tighter*, not longer (`PANG_Spine.md` operating
   rule #5). New learning that doesn't subtract is editorial;
   editorial belongs in the iteration's findings, not in the keeper
   docs.

### What this enables

- A new 2026 browser API appears mid-build → name a primitive, add
  a gate, ship. Hours, not weeks.
- A spine moment doesn't survive contact with Laura → drop it from
  `PANG_Spine.md` § *What the spine eats*. The drop is a positive
  event, not a failure.
- A planned iteration's stack turns out wrong → re-write the stack
  declaration in the brief and continue. Briefs are working
  documents, not contracts.
- An agent's prompt regresses → the eval gate (A22) fails CI → fix
  or revert. No human review overhead.
- Laura's hands reveal a gesture PANG didn't plan → add it to the
  brief, iterate once, codify if it lands.

### What this forbids

- **Skipping the kickoff brief.** Unnamed ambition loses to the
  timeline (§ 5). No brief = default-mean implementation.
- **Skipping gates "just for this PR."** Gates are the floor, not
  a review checklist. A gate failure is the code being wrong.
- **Bringing a 2018 default "just for now."** The cannot-do list
  is non-negotiable. "Temporary" defaults stay forever.
- **Specs disguised as docs.** If a doc starts reading like a
  recipe (*"then add a button that does X"*), subtract it. Keeper
  docs hold principles, constraints, and primitives — not
  prescriptions.

### The rhythm

```
Brief (4 declarations) → Build (free inside the rails) → Laura → Codify | Iterate once | Drop
```

The wall holds. Inside the wall, you move.

---

## 7. The cannot-do list

Things we do not build, ever, regardless of how reasonable they sound
in the moment. Each was proposed at some point; each is now explicitly
out of scope. If a sprint plan violates one of these, the sprint plan
is wrong.

- **No native app shell.** PWA only. No Capacitor, no React Native,
  no SwiftUI port, no Compose port. One codebase, one runtime, one
  distribution.
- **No app-store distribution.** No App Store, no Play Console, no
  TWA wrapper. Gallery sends link; link installs PWA.
- **No push notifications** beyond Declarative Web Push for
  gallery-originated verification outcomes the collector explicitly
  subscribed to. Never marketing, streaks, or "we miss you."
- **No gallery management dashboard.** One invite mechanism.
  Verification confirms in two taps. No admin CMS, no analytics
  panel.
- **No gamification.** No points, badges, streaks, levels,
  leaderboards, progress celebrations, endowed-progress tricks.
- **No collector-to-collector surfaces.** PANG is not a social
  network. No posts, likes, follows, messages between collectors.
- **No artist-to-collector channel.** Provenance is the structural
  answer. No party in a work's history gets a direct voice channel
  to the collector.
- **No ActionSheet between wall and scanner.** One tap to live
  camera is sacred.
- **No batch document upload as a primary flow.** Admin affordance
  at most.
- **No ambient audio by default.** Spatial audio + haptics are
  opt-in, silent until turned on.
- **No emojis.** Anywhere. Ever.
- **No title case.** Sentence case or `ALL CAPS`. See `PANG_Voice.md`.
- **No marketing vocabulary inside strings.** See `PANG_Voice.md` §
  *Marketing phrasing*.
- **No first-person pronouns.** Exception: *you / your* at the
  ownership moment.
- **No evaluative language in generated prose.** Enforced in
  `PANG_VOICE_SYSTEM_PROMPT`.
- **No seed data, no demo collector.** Empty on fresh install.
  Laura is the baseline. Marc is retired.
- **No DOM for primary art surfaces.** `<canvas>` + React adapter.
- **No `JSON.parse` of AI output.** Structured output + runtime Zod.
- **No raw untrusted content into a privileged LLM.** CaMeL pattern
  from day one.

This list grows by subtraction only. Adding an item is a decision;
removing one requires naming what replaced it.

---

## 8. The aha loop

Iterations in `PANG_Aha_Sprint.md` follow a strict loop:

**Develop → Test on Laura's hands → Codify, iterate once, or drop.**

Dropping is a first-class outcome. No iteration carries more than one
round of "it's close" before it either ships or is cut. When an aha
move lands, the principle it proved gets written into one of the nine
docs. When it doesn't, it leaves the queue — including the code, which
goes to `_archive/legacy_prototype/`.

Ceiling is the default scope. Principle is an explicit down-scope
with a named reason. Unnamed ambition loses to the timeline.

---

## 9. Process: Plan → Execute → Review, each in its own context

1. **Plan.** Produce a written kickoff brief for the iteration.
   Four declarations — scope, stack, reference, canvas. Open
   questions listed. Gates named. Test criteria named. No code yet.
2. **Execute.** Write code strictly against the brief in a clean
   context. Don't mix planning with debugging in the same session.
3. **Review.** In a fresh session, compare what was built against
   the brief. Run the gates. Hand to Laura.

Never carry conversational history or debugging context into a new
execution phase. The prompt cache is not a substitute for a written
plan.

Separate the AI pipeline into isolated nodes: classifier, validator,
storage, database writer, observer. If one fails, the others don't
re-run. Retry strategies apply per node, not per workflow.

---

## 10. The Museumsschild test

Every hand-authored string, every generated sentence, every button
label, every error message must be something that could hang as a
small, quiet sign on a gallery wall without looking out of place.
`PANG_Voice.md` is the inner logic. The test is the hard check.

If you are about to write a string that fails the test, stop. You
are either writing in the wrong register or papering over a design
failure (a string apologizing for a UX choice that should be
reconsidered instead).

---

## 11. Metrics that matter

**Primary: Time to First Verified Work (TTFVW).** Minutes from
opening the gallery's invite link to the first work crossing the
verification line. Under 5 minutes, the intake + verify loop works.
Over 30 minutes, something in the ability chain broke.

**Secondary:**
- Arrival-ceremony completion rate
- Unprompted 24-hour return rate
- Paint-depth rate (pinch past the obvious zoom level)
- Verification-request-to-confirm latency

**Banned:** vanity metrics (opens, taps, sessions), engagement
proxies (time-in-app), growth-hack metrics. Behavior change only.

---

## 12. The test that matters

If Laura picks up PANG via the gallery's link and uses it for five
minutes without being told what it does, does she feel she walked
into *a collection*, not that she opened an app? The spine is what
makes that possible. The gates are what stop us from shipping a
sketch of it.

---

## 13. When in doubt

Read the five keeper docs in order: `PANG.md`, `PANG_Spine.md`,
`PANG_Voice.md`, `PANG_Architecture_2026.md`, `PANG_Gates.md`.

If the answer isn't in those five, the question is probably
out-of-spine and belongs in `_archive/`.
