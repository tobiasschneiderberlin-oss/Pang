# PANG

Your collection as a space.

A 2026 production PWA for fine-art collectors. Gallery-gated, link-first
distribution. No app-store shell, no marketing copy, no gamification.
See the nine doctrine docs in the parent directory.

## Stack

Next.js 16 (App Router, RSC by default) · React 19.1 · TypeScript 5.7
strict · Tailwind v4.1 · Motion 12 · Zustand 5 · Zod 3.24 · Anthropic
SDK 0.60 · TanStack Query 5.80 · Workbox 7.3.

## Scripts

```bash
npm run dev              # dev server (turbopack)
npm run build            # production build
npm run start            # serve the production build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run check:manifest   # validate public/manifest.webmanifest (P1)
npm run check:strings    # voice doctrine audit
npm run check:gates      # full gate runner (P1–P10, P23, P24)
npm run rebuild:voice-prompt  # regenerate PANG_VOICE_SYSTEM_PROMPT
```

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
  check-gates.ts      — mechanical enforcement (P1–P10, P23, P24)
  check-manifest.ts   — focused P1 runner
  check-strings.ts    — voice doctrine audit
  build-sw.ts         — sw build hook (Workbox migration TBD)
```

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
