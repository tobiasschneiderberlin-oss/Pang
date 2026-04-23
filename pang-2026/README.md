# PANG

Your collection as a space.

A 2026 production PWA for fine-art collectors. Gallery-gated, link-first
distribution. No app-store shell, no marketing copy, no gamification.
See the nine doctrine docs in the parent directory.

## Start here

Read the parent-directory docs in this order before writing code:

1. `PANG.md` — product thesis (verification line, three interactions)
2. `CLAUDE.md` — build doctrine (5 kickoff declarations, cannot-do list)
3. `PANG_Architecture_2026.md` — system shape (stack, state, AI infra)
4. `PANG_Gates.md` — 48 mechanical CI gates (the authority source)
5. `PANG_Primitives_2026.md`, `PANG_Voice.md`, `PANG_Spine.md`, `PANG_Aha_Sprint.md`, `PANG_AI_Era_2026.md` — as the work touches them

This app is gate-driven: every merge passes `npm run verify` locally
and `npm run check:gates` in CI. No gate failures merge to `main`.

## Stack

Next.js 16 (App Router, RSC by default) · React 19.1 · TypeScript 5.7
strict · Tailwind v4.1 · Motion 12 · Zustand 5 · Zod 3.24 · Anthropic
SDK 0.60 · TanStack Query 5.80 · Workbox 7.3 · Playwright 1.55.

## First clone (~10 min to green)

```bash
nvm use                             # picks Node from .nvmrc (22.14.0)
cd pang-2026
npm ci
cp .env.example .env.local          # fill in locally
npm run setup:hooks                 # wire pre-push (verify before push)
npm run verify                      # same gates CI runs; should be green
npm run dev                         # http://localhost:3000
```

## Scripts

```bash
# Dev loop
npm run dev                   # dev server (turbopack)
npm run dev:device            # dev server + LAN QR code for real-device HMR
npm run build                 # production build
npm run start                 # serve the production build

# Local verification (runs the same gates as CI)
npm run verify                # typecheck + lint + manifest + strings + gates + eval
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint
npm run check:manifest        # validate public/manifest.webmanifest (P1)
npm run check:strings         # voice doctrine audit (A5)
npm run check:gates           # full gate runner (P1–P10, P23–P25, A1–A4, A7, A8, A16, A21)
npm run check:eval            # A22 eval in mock mode (no API calls)

# Tests
npm run test                  # unit (tsx --test)
npm run test:e2e              # Playwright (builds if needed)
npm run test:e2e:ui           # Playwright UI mode (debug-friendly)

# AI eval corpus (A22)
npm run eval:intake:mock      # CI-safe: canned responses
npm run eval:intake           # live: costs cents, needs ANTHROPIC_API_KEY

# Utilities
npm run rebuild:voice-prompt  # regenerate PANG_VOICE_SYSTEM_PROMPT
npm run setup:hooks           # one-time: wire pre-push hook in this clone
```

### The pre-push hook

`npm run setup:hooks` points `git config core.hooksPath` at
`scripts/git-hooks/`. After that, every `git push` runs
`npm run verify` (~30–60 s) before sending. Catches broken gates
locally instead of burning CI cycles. Skip an individual push with
`git push --no-verify` — for example, when pushing CI-config fixes
that intentionally break verify.

### Testing against a Vercel preview

```bash
PANG_E2E_BASE_URL=https://pang-gamma-<hash>.vercel.app npm run test:e2e
```

Skips the local webServer; Playwright hits the preview URL directly.
Useful for verifying Vercel-specific behaviour (edge runtime, CDN
cache headers, regional routing) that `npm run start` doesn't catch.

## Directory map

```
app/            — Next.js App Router routes
  globals.css   — Tailwind @theme + reset + View Transitions scaffold
  layout.tsx    — root layout (font, manifest, AppBoot)
  page.tsx      — The Room (canvas mount lands iteration #4)
  i/[token]/    — invite landing (passkey enrollment lands iter #1)
  healthz/      — plaintext uptime probe

src/design/     — the locked base + nine knobs
  locked.ts     — compile-time constants (OKLCH, SPACING_PX, etc.)
  knobs.css     — the nine bounded knobs as custom properties
  preferences.ts  — Zustand slice + :root projector
  fonts.ts      — three-register loader (Instrument Serif + Geist + Geist Mono)

src/lib/        — runtime services (opfs, sw, capability)
src/hooks/      — client-only hooks
src/components/ — UI surfaces; AppBoot is the only boot island
src/stores/     — Zustand stores (non-design)

public/
  manifest.webmanifest  — P1 manifest
  sw.js                 — hand-authored service worker (P3/P4)
  icons/                — 192, 512, 512-maskable
  (fonts are loaded from Google Fonts; no local font files)

scripts/
  check-gates.ts      — mechanical enforcement (P1–P10, P23–P25)
  check-manifest.ts   — focused P1 runner
  check-strings.ts    — voice doctrine audit
  build-sw.ts         — sw build hook (Workbox migration TBD)
  dev-device.ts       — LAN HMR + QR for real-device dev (Tier 4)
  git-hooks/pre-push  — runs `verify` before push (opt in via setup:hooks)

evals/
  intake/             — A22 corpus (fixtures, mocks, scorer, runner)

e2e/                  — Playwright specs (Tier 2)
```

## CI / deploy

- **CI (every push):** `.github/workflows/ci.yml` runs the gates job
  (typecheck, lint, manifest, strings, gates, build, A22 mock eval),
  then the e2e job (Playwright against the built app). `.next/` is
  shared between jobs as an artifact; Playwright browsers are cached.
- **Live eval (dispatch + weekly):** `.github/workflows/eval.yml` runs
  the A22 corpus against real Anthropic models. Costs cents per run.
  Sunday 04:00 UTC cron + manual dispatch.
- **Deploy:** Vercel auto-deploys `main` → prod, PRs → preview URLs.
  `fra1` region (Frankfurt). See `vercel.json` for headers + install
  command. `.vercelignore` keeps Playwright + eval artifacts out of
  the upload.
- **Deps:** Dependabot runs weekly on `npm` + `github-actions`
  ecosystems, groups dev-tooling minor/patch into one PR, opens
  major bumps individually.

## Environment

```bash
NEXT_PUBLIC_SUPABASE_HOST=<project>.supabase.co
ANTHROPIC_API_KEY=<server-only>
SUPABASE_SERVICE_ROLE_KEY=<server-only>
```

`NEXT_PUBLIC_*` values land in client bundles; everything else must be
server-only (used by RSC or route handlers).

## Fonts

Three-register stack per DS Chapter 03. All open-source; loaded from
Google Fonts via `<link rel="preconnect">` + stylesheet in `app/layout.tsx`:

- **Instrument Serif** — display + editorial (titles, chapter headers).
- **Geist** — UI register (buttons, labels, body).
- **Geist Mono** — data + gate IDs (hashes, confidence bars, CI output).

The DS token file (`src/styles/tokens.css`) declares the stacks by
their literal family names; the preconnect keeps the first paint
fast. No commercial licence, no local `public/fonts/` step on fresh
clone.

## Gates

48 mechanical gates (P1–P25 + A1–A23). `npm run check:gates` runs the
iteration-#0 subset (P1–P10, P23, P24) plus the iteration-#1 A-gate
subset (A1–A4, A7, A8, A16, A21). Full coverage plugs in as each
gate's subject matter lands — see `PANG_Gates.md` in the parent
directory and `.pang/gates.yaml` for the CI-authoritative list.

## Doctrine

See `CLAUDE.md` in the parent directory. The short version:

> If a decision makes the collector's relationship to their collection
> *louder*, it is wrong. If it makes the relationship *clearer*, it
> is right.
