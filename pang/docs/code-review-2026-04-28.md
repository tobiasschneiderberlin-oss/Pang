# Code Review — 2026-04-28 (pre-rename, then `b_3gmUyvQpair/`, now `pang/`)

**Status after this pass:** typecheck clean (`npm run typecheck` passes), build clean (`npm run build` passes with `ignoreBuildErrors: false`), no compiler warnings, all 18 routes generate.

This document records the 12 fixes that landed before the rename to `pang/` and the 10 follow-ups deliberately deferred. The fixes themselves are visible in commit history under the `add: pang/` commit (the directory was already in this state when added to the new repo).

---

## What was fixed (12 changes)

### TypeScript errors (3) — silently masked by `ignoreBuildErrors: true`

| # | File:line | Issue | Fix |
|---|---|---|---|
| 1 | `app/(app)/patterns/page.tsx:23` | `artwork.movement` doesn't exist on the `Artwork` type — every artwork fell through to "Contemporary", making the *movements* stat permanently show "1 movement" | Added `movement?: string` to `Artwork` in `lib/data.ts` |
| 2 | `components/search-modal.tsx:43` | `window.webkitSpeechRecognition` not in lib.dom typings | Cast through `any` for the constructor lookup; commented why |
| 3 | `components/share-sheet.tsx:90` | `if (navigator.share)` is always-truthy because TS sees the method as defined | Switched to `'share' in navigator` feature gate (also applied in `handleNativeShare`) |

### Real logic bugs (5)

| # | File:line | Bug | Fix |
|---|---|---|---|
| 4 | `app/artwork/[id]/page.tsx:22` | `const pathname = useRouter;` — typo assigned the *function reference*, not a call. Dead code that ran every render | Removed; also pruned 6 unused imports (`Clock`, `MapPin`, `Play`, `X`, `collectors`, `Collector`, `CollectorCard`, `ProvenancePhotos`) |
| 5 | `components/search-modal.tsx:57` | Voice search committed transcript only when `event.isFinal` was truthy — but `isFinal` lives on each `SpeechRecognitionResult`, not on the event. Result: voice search **never** populated the input | Walk results, set `isFinal` from any final `results[i]`, commit then |
| 6 | `components/fullscreen-viewer.tsx:54` | Pinch zoom divided by `initialDistance`. If `touchmove` fired before `touchstart` recorded a starting pair, `initialDistance === 0` → `distance / 0 = Infinity` → `NaN` scale → image stuck | Added `if (initialDistance === 0) return;` guard |
| 7 | `components/artist-media.tsx:20` | Audio `play()` returns a Promise that rejects under autoplay restrictions. State flipped to "playing" anyway, browser logged unhandled rejection | Promise chain: `setIsPlaying(true)` only on resolve, `setIsPlaying(false)` on reject |
| 8 | `components/artwork-scanner.tsx:40` | Same pattern: `await videoRef.current.play()` could throw in detached/interrupted states. Also: if user closes scanner mid-`getUserMedia`, the resolved stream was leaked because `videoRef.current` was null | Wrapped `play()` in try/catch; added `else` branch that stops tracks if the video element disappeared during the await |
| extra | `app/artwork/[id]/page.tsx:220` | `{artist && (artist.voiceNotes?.length \|\| artist.videos?.length) && (...)}` — if both are empty arrays, expression resolves to `0`, which React renders as the literal text **"0"** | Wrapped in `Boolean(...)`, defaulted with `?? 0` |

### Project hygiene (4)

| # | What | Why |
|---|---|---|
| 9 | Deleted `hooks/use-toast.tsx` | Custom 100-line toast impl that was never imported anywhere — pure dead code |
| 10 | Deleted `components/ui/use-toast.ts` | Byte-identical duplicate of `hooks/use-toast.ts`; the one canonical import is `@/hooks/use-toast` |
| 11 | Deleted `components/ui/use-mobile.tsx` | Byte-identical duplicate of `hooks/use-mobile.ts` |
| 12 | `next.config.mjs` + `package.json` | Flipped `ignoreBuildErrors: true → false` so future type errors block CI; removed deprecated `eslint` config key (Next 16 dropped it); added `turbopack.root` to silence the workspace-root warning; replaced the broken `lint: "eslint ."` script with `typecheck: "tsc --noEmit"`; removed the stray `package-lock.json` left from a prior install (project uses pnpm) |

---

## What was deliberately not fixed (and why)

These are real but either out-of-scope for "fix bugs" or want a design call before touching:

1. **Filters incomplete** in `app/(app)/collection/page.tsx:78–93`. Selecting "By Artist", "By Medium", or "By Year" falls through to the default sort with no actual grouping. Three filters do nothing visible. Needs design intent (group headers? sub-pages?) before guesswork.

2. **Toaster never mounted** in `app/layout.tsx`. The shadcn `<Toaster />` and `sonner` `<Toaster />` are both available; neither is rendered. **No bug today** because nothing calls `toast()` anywhere — but the moment anyone tries, nothing will appear. Mount one in the root layout when first toast call lands.

3. **`hooks/use-analytics.ts`** writes to `localStorage` on every navigation (synchronous, blocking). Fine at this scale; replace with the upcoming backend's analytics service.

4. **`touchstart`/`touchend` swipe handlers** in artwork detail (lines 41–53) and long-press detection in collection (lines 51–60). Functional, but Pointer Events handle multi-touch / mouse / pen identically and won't blow up on iOS gesture-cancel edge cases. One sweep before public launch.

5. **`ArtworkInsights` and `artistCollectorMap`** at the bottom of `app/artwork/[id]/page.tsx` (lines 379–425) are defined but never rendered. Dead code from an earlier iteration. Tree-shaken by the bundler since they're unreferenced exports of a Client Component module — but worth deleting for grep noise.

6. **`useEffect` with `stream` in deps** in `components/artwork-scanner.tsx:71`. Calling `setStream` triggers the same effect to re-run, which calls `startCamera` again. Doesn't crash but can call `getUserMedia` 2× per open. Fix is to track the stream in a ref for cleanup; small refactor, didn't want to risk regression in the same pass.

7. **`document-scanner.tsx` analyze-on-last-callback pattern** (lines 31–47). Uses parallel `FileReader`s and triggers AI analysis on the callback whose count matches `files.length`. Currently correct but fragile — easy to break on the next edit. Re-implement with `Promise.all([...readers])` later.

8. **`<iframe>` video embed** in `components/artist-media.tsx:VideoModal`. Only works for embed URLs (YouTube `/embed/`, Vimeo `/video/`). Direct `.mp4` URLs in `videos[].url` won't play. Probably fine because all current data uses YouTube embeds — but document the contract.

9. **All artwork images on Artlogic CDN.** Already covered in ADR-001 — Phase 1 helper, Phase 2 R2 mirror, Phase 3 own storage.

10. **`localStorage` everywhere** (onboarding flag, accent color, analytics, auth/logout). Functionally fine; we replace with Supabase Auth context + OPFS (or just stay with localStorage — the old PANG's hard line on this was ideological, not pragmatic).

---

## Recommended next steps

In order:

1. **Add ESLint properly.** Next 16 dropped `next lint`; you'll want a flat `eslint.config.mjs` using `eslint-config-next` to catch what TS doesn't (a11y, React hooks rules, dead deps in `useEffect`). The `lint` script slot was left empty rather than guess at the config.

2. **Wire the seven open architectural questions** asked earlier (auth model, data ownership, multi-gallery, collector circle semantics, AI extraction target, document budget, collection page route confirmation) — without those, the backend is a guessing game. *(Six of these now sit in ADR-001.)*

3. **Decide the filter design** for collection (item 1 above) before launch. Empty filters are worse than no filters.

4. **Mount a `<Toaster />`** in `app/layout.tsx` so the first `toast()` call actually appears. One line.

---

## Verification at end of pass

```
$ npm run typecheck
> tsc --noEmit
✓ (no output, exit 0)

$ npm run build
✓ Compiled successfully in 1.4s
✓ Running TypeScript ... Finished TypeScript in 3.0s
✓ Generating static pages (15/15)
(no warnings, all 18 routes generated)
```

The frontend is now green-light ready for backend work to begin.
