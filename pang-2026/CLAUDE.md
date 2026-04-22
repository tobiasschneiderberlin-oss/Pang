# Claude Code — Start here

Read `docs/PANG_DS.html` cover to cover before writing any code.
It is the source of truth for tokens, gates, components, and doctrine.

## The shape of the document

- Chapters 01–12 — manifesto. Voice, colour, type, motion, room, AI, chrome, a11y.
- Appendix A — tokens. Paste A.1 into `src/styles/tokens.css` verbatim.
- Appendix B — the 47 DS-sourced gates with fail conditions. Mirrored to `.pang/gates.yaml`, which adds P25 (zero-tap review, codified 2026-04-22 from iteration #1 — pending DS revision) for a CI-authoritative 48.
- Appendix C — component inventory (18). Paths in this list are canonical.
- Appendix D — repo layout. Create every directory on first scaffold.
- Appendix E — first-boot checklist. Nine steps, ~20 min to passing CI.
- Appendix F — doctrine edit protocol. What requires a doctrine edit and how.

## Authority

When this document and the code disagree, **the code wins** — and the
doctrine is updated the same day (Appendix F). Gates (`.pang/gates.yaml`)
are the CI authority; a commit that fails a gate does not merge.

## Non-negotiables

- OKLCH colour only (P11). No hex, rgb(), hsl() literals.
- Containers have `border-radius: 0`. Chrome has 2px. Nothing between.
- `localStorage` is forbidden (P5). Use OPFS.
- AI output is `Untrusted<T>` at the boundary (A8) and `schema.parse()`'d
  before use (A3).
- No "dive, unlock, seamless, leverage, journey" in user-facing copy (A5).

## The one test

If Laura picks up PANG via the gallery's link and uses it for five minutes
without being told what it does, she should feel she walked into *a
collection*, not that she opened an app.
