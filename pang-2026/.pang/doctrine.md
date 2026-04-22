# PANG — Doctrine

> Manifesto + appendices mirror. Authority for *why*.
> Gates (`.pang/gates.yaml`) are authority for *what blocks a merge*.
> The rendered design system (`docs/PANG_DS.html`) is authority for *how it looks and reads*.

When this document and the code disagree, **the code wins** — and the doctrine
is updated the same day (§ Edit protocol, below).

---

## Sources of truth

| Authority | Lives at | Read when |
|---|---|---|
| 1 · Build doctrine (how we build) | `../CLAUDE.md` at the app root, `../../CLAUDE.md` at the workspace root | Every session start |
| 2 · Design system (chapters + appendices) | `../docs/PANG_DS.html` | Before writing any UI or string |
| 3 · Gates (the 48, structured) | `./gates.yaml` | CI; every PR |
| 4 · Tokens (OKLCH, type, motion) | `../src/styles/tokens.css` | Before writing any CSS |
| 5 · Nine source docs (product, spine, voice, gates, AI era, primitives, architecture, aha) | `../../PANG*.md` at the workspace root | Before starting a sprint |

If a decision makes the collector's relationship to their collection
*louder* (marketing, chatter, chrome), it is wrong. If it makes the
relationship *clearer* (provenance, scale, quiet), it is right.

---

## Non-negotiables

Lifted from the handoff `CLAUDE.md` and Appendix B of the design system.
CI enforces each one; the doctrine explains the *why*.

- **OKLCH colour only** (P11). No hex, `rgb()`, `hsl()` literals. Use
  tokens from `src/styles/tokens.css`; colour outside the token system
  is colour outside the language.
- **Sharp corners** (P9). Containers `border-radius: 0`. Chrome 2px.
  Nothing between. A rounded container is an app trying to look
  friendly; a sharp container is a wall.
- **OPFS, not localStorage** (P5, P21). State and binaries persist to
  OPFS. `localStorage` is forbidden — it is the quiet signal of 2018
  code wearing 2026 copy.
- **`light-dark()` with `color-scheme`** (P12). No class flips, no prop
  drilling. The OS already knows what mode the collector is in.
- **AI output is `Untrusted<T>` at the boundary** (A8), and
  `schema.parse()`'d before any caller reads it (A3). `JSON.parse` on a
  model response is a silent failure waiting to ship.
- **Voice seed in every user-facing prompt** (A4). Chapter 01's ten
  lines are baked into `src/ai/prompts/`. Voice drift is model drift —
  the seed is the anchor.
- **No banned vocabulary** (A5). "dive", "unlock", "seamless",
  "leverage", "journey" are lint failures in prompt output. These are
  the words of a brochure, not a wall label.
- **No title case** (P14). Sentence case for body; `MONO-CAP-SPACED`
  for labels. Title case belongs on a newsletter.
- **No emojis**. Anywhere. Ever.
- **CaMeL dual-LLM** (A7) — untrusted content enters through a
  quarantined pass before any privileged tool call sees it.

See `docs/PANG_DS.html#apx-b` for the DS-sourced 47; `./gates.yaml`
for the CI-authoritative 48 (adds P25 — zero-tap review — codified
2026-04-22 from iteration #1; DS HTML revision pending).

---

## The one test

If Laura picks up PANG via the gallery's link and uses it for five
minutes without being told what it does, she should feel she walked
into *a collection*, not that she opened an app.

Every chapter, every gate, every token serves that sentence.

---

## How the wall holds while we iterate

Guardrails are subtractive; iteration is discovery. The nine source
docs and this doctrine describe *what kind of thing falls outside the
wall.* Inside the wall, every iteration is a discovery loop.

1. **Gates check; docs teach.** The 48 gates are mechanical — CI fails
   the build on regression. The docs are read for orientation.
2. **The kickoff brief is the freedom-and-constraint joint.**
   Scope / Stack / Reference / Canvas — four declarations commit the
   iteration to the 2026 surface; test criteria and outcome gate let
   it iterate without re-planning.
3. **Codify / Iterate once / Drop is the metabolism.** Every discovery
   during a build becomes a doc line + gate (*codify*), a single
   second pass (*iterate once*), or a subtraction (*drop*).
4. **Docs grow by subtraction.** A landed sprint should make the
   relevant doc *tighter*, not longer.

---

## Edit protocol (Appendix F mirror)

The doctrine is edited when, and only when, one of these conditions
holds. A code change that triggers one of these without a paired
doctrine edit is reverted.

A doctrine edit is required when:

- Introducing a new component to Appendix C of `PANG_DS.html`.
- Adding a new top-level folder in Appendix D of `PANG_DS.html`.
- Changing a token value in `src/styles/tokens.css`.
- Adding, removing, or rewording a gate in `.pang/gates.yaml`.
- Removing an item from the cannot-do list in the workspace
  `CLAUDE.md` — which requires naming what replaced it.

A doctrine edit is **not** required when:

- Adding a component that fits an existing pattern.
- Fixing a bug without changing a token, gate, or folder.
- Tuning copy that stays inside the voice seed and the banned-vocab
  filter.
- Running an iteration whose findings land in
  `../../PANG_Aha_Sprint.md`.

Edits land in the same PR as the code. A merge that separates the
two produces a documentation drift the next contributor pays for.

---

## Pending doctrine edits

The DS HTML (`../docs/PANG_DS.html`) ships at 400 permissions —
read-only from the project side. Edits to it are authored by the DS
author and land in a separate PR. The items below are doctrine
edits that the code already requires; this section is the
**CI-authoritative staging ground** until the DS HTML catches up.

### Appendix C addition — `Viewfinder`

- **Component path** · `src/components/scanner/Viewfinder.tsx` (an
  admissible home until the scanner surface absorbs into
  `src/components/ai/` per DS Appendix D's `components/ai/` note
  for the intake input — deferred to the scanner-in-room sprint).
- **Role** · The live camera surface behind iteration #1's intake
  flow. Renders the rectified rectangle + torch + focus ring as the
  single pre-capture affordance.
- **Gates referenced** · `P19` (canvas-is-the-surface), `P20`
  (worker-CV off the main thread), `A16` (OPFS-backed intake
  queue), `P25` (zero-tap review).
- **Codified** · 2026-04-22 with the iteration-#1 intake landing.
  Staged here pending DS revision.

### Appendix B addition — `P25` (zero-tap review)

Already mirrored in `./gates.yaml` (see family
`canvas_data_observability`, range `[P19, P25]`). The DS HTML
Appendix B still lists 47; the YAML lists 48. The code is at 48;
doctrine edits catch up to code same-day.

---

## When in doubt

Read, in order: `../../PANG.md`, `../../PANG_Spine.md`,
`../../PANG_Voice.md`, `../../PANG_Architecture_2026.md`,
`../../PANG_Gates.md`, then this file, then
`../docs/PANG_DS.html`.

If the answer isn't in those, the question is probably out-of-spine
and belongs in `../../_archive/`.
