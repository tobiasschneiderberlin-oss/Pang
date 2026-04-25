# Demo seed — removal procedure

This `src/demo/` directory + the three small wiring touches below
are an **opt-in test affordance** for product development before
real gallery + Artlogic integrations land. The cold-install
production experience is unchanged: visiting `/` shows the
empty grid (per the doctrine's "Laura is the baseline" rule).

When the gallery side ships and real demo / sandbox accounts are
available, **delete this entire affordance**. The procedure is
designed to take five minutes and leave zero residue.

## What to delete

### 1. This directory

```
rm -rf src/demo/
```

That removes:
- `works.ts` — the 15 demo entries
- `seed.ts` — the seeder + clearer functions
- `REMOVAL.md` (this file)

### 2. The AppBoot wiring

In `src/components/AppBoot.tsx`, locate the block guarded by the
comment `// iter #22: demo seed (REMOVE WITH src/demo/)` and
delete it (it is roughly 15 lines, including its import).

### 3. (No CSP changes to revert)

The demo uses inline SVG data URIs for tile images — no external
fetches, no CSP edits. The `img-src 'self' data: blob:` directive
in `proxy.ts` and `next.config.ts` already covers them. Nothing to
revert.

### 4. (Optional) Dependency check

The demo uses no extra npm dependencies — only the shapes already
declared in `src/stores/works.ts` and `src/verification/schema.ts`.
Nothing to uninstall.

## Verification after removal

```bash
npm run typecheck    # should pass
npm run lint         # should pass
npm run check:gates  # P6 (CSP) should still pass — Wikimedia gone, no orphan reference
```

Visit `/?seed=demo` after removal: it should be a no-op (the
seeder file is gone; the AppBoot guard is gone; the URL parameter
is silently ignored). Visit `/`: empty wall, as designed.
