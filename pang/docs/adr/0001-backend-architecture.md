# ADR-001: Backend Architecture & Tech Stack for PANG PWA

**Status:** Proposed
**Date:** 2026-04-28
**Deciders:** Tobias (engineering + product)

---

## Context

PANG is a 2026 Progressive Web App for art collectors, distributed via gallery-issued invite links. The frontend (Next.js 16 / React 19 / Tailwind v4) is built and locked. We now need to make it real: backend, auth, storage, AI pipeline, deployment, observability.

### What's distinctive about this domain

These shape every architectural choice. Read them before evaluating options.

1. **Invite-only, gallery-curated.** No public signup. No SEO. Acquisition channel is the gallery's existing relationship. Auth is invite-driven from day one.
2. **High-value items, low transaction volume.** A single artwork can be worth six figures. A gallery has hundreds of collectors, not millions. Database throughput is irrelevant; data integrity, audit trails, and tamper-evidence are everything.
3. **Verification is the crown jewel flow.** Gallery says "yes, this is real." The signature behind that "yes" is the entire product's trust layer.
4. **Provenance is append-only.** Once a provenance entry is recorded, it cannot be silently mutated. This wants careful audit logging or event-sourcing, not last-write-wins.
5. **Documents are sensitive.** Certificates of authenticity, insurance valuations, invoices. Encryption at rest, signed URLs, access logs are not optional.
6. **Mobile-first PWA with Camera + AI.** Service Worker strategy, background sync for uploads, offline reads, and a 2–5s synchronous AI scan with structured output.
7. **Solo developer + AI pair.** The ideal stack maximizes leverage per piece of cognitive overhead. Every additional service is a thing to remember.

### Constraints

- Time-to-production: weeks, not months.
- Budget: <$200/mo at single-gallery scale.
- Frontend is locked; backend must adapt to the existing TypeScript types in `lib/data.ts`.
- Solo maintainer; minimum five-year support horizon.

### Non-functional requirements

| Requirement | Target |
|---|---|
| Scan latency (capture → confirmable result) | < 5s p95 |
| Page navigation | < 100ms |
| Verification fan-out (gallery confirms → collector sees) | < 2s |
| Document download | Signed URL, < 1s TTFB |
| Concurrent collectors per gallery | 1,000 |
| Artworks per collector | up to 500 |
| Storage per gallery | 100 GB images + 20 GB documents |
| Data residency | EU (Galerie Droste is German) |
| Uptime | 99.5% (SLA-grade not required) |

---

## Decision

Build on **Supabase + Vercel + Anthropic + Drizzle + Cloudflare R2**, with passkeys-via-invite for auth, RLS for multi-tenancy, and a single edge route for the AI scan pipeline.

The reasoning is below as four sub-decisions. Each was evaluated against named alternatives.

---

## Sub-decision 1: Backend Platform

### Options Considered

| | Supabase | Convex | Roll-your-own (Neon + tRPC + Lucia) | Pocketbase |
|---|---|---|---|---|
| Postgres? | Yes | No (proprietary) | Yes | No (SQLite) |
| RLS for multi-tenancy | First-class | Manual in functions | Manual | Limited |
| Auth (passkeys) | Native (WebAuthn beta) | Via Clerk add-on | Lucia handles it | Manual |
| File storage + signed URLs | Native | Native | Add S3/R2 | Native |
| Realtime | Postgres CDC | First-class | Add Pusher/Ably | WebSocket |
| EU data residency | Yes (Frankfurt) | US-only currently | Anywhere | Self-host |
| Cognitive load (1–5) | 2 | 2 | 4 | 3 |
| Lock-in risk | Low (Postgres exits cleanly) | High (proprietary DB) | None | Low |
| Cost at single-gallery scale | $25/mo | $25/mo | $30–50/mo | $5/mo (VPS) |

### Recommendation: **Supabase**

**Why Supabase wins for this app specifically:**

1. **Postgres + RLS is the right fit for sensitive multi-tenant data with complex visibility rules.** The data model (gallery → staff → collectors → artworks → documents with per-document visibility) is naturally expressed in row-level policies. Convex would require manual gating in every function, with no compile-time guarantee.

2. **Provenance wants relational integrity.** Append-only tables with foreign keys and triggers are a Postgres home game. SQLite (Pocketbase) or proprietary (Convex) make this harder to audit later.

3. **EU residency is non-negotiable for a German gallery.** Supabase Frankfurt region is one click. Convex is US-only as of early 2026.

4. **Exit ramp matters.** If Supabase ever becomes wrong, the database is plain Postgres — `pg_dump` and move. Convex's data is locked behind their proprietary engine.

5. **The stuff Convex would win on (real-time TS-end-to-end DX) we don't actually need much of.** Real-time matters for *one* flow: verification status. Postgres CDC via Supabase Realtime handles that.

### What we explicitly give up

- Convex's reactive queries everywhere — replaced by tRPC over Drizzle queries with React Query for caching. More wiring, but composable with Server Components.
- Self-hosted simplicity — Supabase is a vendor and pricing is theirs to change. Mitigation: monthly Postgres backups to R2.

---

## Sub-decision 2: Authentication

### Options Considered

| | Passkeys + invite | Magic link + invite | Clerk | Auth0 |
|---|---|---|---|---|
| Phishing-resistant | Yes | No | Yes (with passkeys) | Yes |
| UX for non-technical collector | Medium (depends on device) | Easy | Easy | Easy |
| Cost at 1k MAU | $0 (Supabase native) | $0 | $25/mo | $240/mo |
| Vendor lock-in | None | None | Medium | High |
| Lost-device recovery | Hard | Easy | Built-in | Built-in |

### Recommendation: **Passkeys (primary) + email magic link (fallback), both gated by invite token**

The flow:

1. Gallery generates an invite token, sends as a deep link: `https://pang.app/invite/<jwt>`
2. Collector taps the link → token verified server-side → routes to passkey registration
3. Passkey created against the collector's email (extracted from JWT) and bound to their device's authenticator
4. On subsequent visits: passkey prompt is automatic via WebAuthn conditional UI
5. Lost device → magic link to the email on file → re-register passkey

**Why this combination:**

- Galleries get a clean invite mechanism that's tamper-resistant (HMAC-signed JWT, single-use token).
- Collectors get the best UX 2026 has — Face ID / Touch ID, no passwords. Both iCloud Keychain and Google Password Manager sync now, so device loss is rare in practice.
- Magic link is the recovery path, not the primary. We never send passwords.
- The old PANG stack already had `signInvite` / invite-mint logic — that code is reusable.

### What we explicitly give up

- Anonymous browse mode. Every entry point requires an invite. This is intentional for the verification trust model.
- OAuth providers (Google, Apple). Adding them later is one Supabase config change, but they're not part of the gallery-issued-invite premise.

---

## Sub-decision 3: AI Scan Pipeline

### The flow

```
Camera capture → JPEG → upload to /api/scan → Claude Vision (structured output)
  → Zod parse → return artwork candidate → user confirms → write to DB
```

### Options Considered

**Option A: Synchronous edge route**
- Single Next.js API route on the edge runtime
- Receives JPEG, calls Anthropic, returns parsed result
- 2–5s p95 acceptable for a single scan

**Option B: Async with queue**
- Upload returns a job ID immediately
- Background worker (Vercel Cron / Inngest) processes
- Client polls for result
- Better for batch / unreliable networks

**Option C: Direct browser → Anthropic**
- Rejected: requires exposing API key. Non-starter.

### Recommendation: **Option A (synchronous) for MVP, with Option B's foundations laid**

For a single scan, synchronous is the right UX — the user sees the bracketed frame, captures, and waits ~3s with a confidence loader. They don't want to background it.

But we structure the route so async is one config flip away:

```
/api/scan (edge runtime)
  → uploadToStorage(image) → returns ScanJob{ id, imageUrl }
  → queueScan(job) → currently runs inline via Promise.all
  → updateScanResult(id, result) → returns to client
```

When batch upload becomes a feature (gallery onboards 200 existing artworks), we move `queueScan` to Inngest and the client polls `/api/scan/:id`. No client refactor.

### Critical hardening (these are not optional)

1. **Structured output, not free-form prose.** Anthropic's structured output API with a Zod schema bound at the call site. Never `JSON.parse(text)`.
2. **Untrusted at the boundary.** Treat Claude's response as `Untrusted<ArtworkCandidate>` until validated. Carry through TS types so accidental usage of unvalidated data is a compile error.
3. **Prompt versioning in repo, not in dashboard.** Prompts live in `prompts/scan-artwork.v3.ts`. Hash the prompt text + model + schema and log the hash with every call. CI runs an eval corpus on prompt changes (10–20 known images with expected outputs).
4. **Cost cap per request.** Reject images >5MB, downscale client-side to 2048px max edge before upload. Budget is ~$0.04 per scan with Sonnet 4.6.
5. **Audit log every call.** Request hash, response hash, prompt version, cost, latency, user. This is invaluable for prompt regression debugging.

---

## Sub-decision 4: File Storage & Image Delivery

### Options Considered

| | Supabase Storage | Cloudflare R2 + Images | Self-host | Keep Artlogic CDN |
|---|---|---|---|---|
| Egress cost | $0.09/GB | **$0** | varies | $0 (theirs) |
| Image transforms | Yes (paid) | Yes (Images $5/mo) | Add Sharp | None |
| Signed URLs | Yes | Yes | Manual | No |
| Encryption at rest | Yes | Yes | Manual | Unknown |
| Setup complexity | Trivial (same SDK) | Low (S3-compatible) | High | None today, fragile |

### Recommendation: **Documents on Supabase Storage; artwork images on Cloudflare R2 + Images**

**Why split:**

- **Documents** (PDFs of certificates, invoices) are low volume, high sensitivity. Supabase Storage gives us RLS-aligned signed URLs with the same auth context as the database. One vendor, one auth model.
- **Artwork images** are the high-traffic asset. R2 has zero egress fees, which matters when the gallery has 200 collectors each loading 50 thumbnails on first paint. Cloudflare Images adds on-the-fly transforms (variants for thumb/grid/full) that beat anything Supabase ships at the same price.

### Migration path away from Artlogic CDN

Phase 1 (immediate): Build a `getArtworkImageUrl(artwork)` helper that today returns Artlogic URL. Phase 2: A scheduled job mirrors Artlogic images to R2 on first access (read-through cache). Phase 3: New uploads go straight to R2; Artlogic mirror retires.

This means we never have a "big migration day." Artlogic risk is bounded from week one.

---

## The Recommended Stack (concretely)

```
┌─ Frontend (already built, locked) ─────────────────────────┐
│  Next.js 16 / React 19 / Tailwind v4 / shadcn/ui / vaul    │
│  PWA: manifest, service worker, background sync            │
└────────────────────────────────────────────────────────────┘
              │
              │  fetch / Server Actions
              ▼
┌─ Edge / Server (Vercel) ───────────────────────────────────┐
│  Next.js API routes + Server Actions                       │
│  Drizzle ORM (typed SQL over Supabase Postgres)            │
│  tRPC for client-server contract (where SA's don't fit)    │
│  Zod everywhere at boundaries                              │
└────────────────────────────────────────────────────────────┘
              │
              ├─────────► Anthropic API (Claude Sonnet 4.6 vision)
              │           Structured output, prompt-versioned
              │
              ├─────────► Supabase
              │           - Postgres (data, RLS)
              │           - Auth (passkeys + magic link)
              │           - Realtime (verification status only)
              │           - Storage (documents)
              │
              └─────────► Cloudflare R2 + Images (artwork images)

┌─ Observability ────────────────────────────────────────────┐
│  Sentry (errors)                                           │
│  PostHog (product analytics, EU instance)                  │
│  Helicone or self-hosted (AI call audit log)               │
│  Vercel Analytics (web vitals)                             │
└────────────────────────────────────────────────────────────┘
```

### Cost projection

| Stage | Galleries | Collectors | Cost/mo |
|---|---|---|---|
| Pilot | 1 | 100 | ~$75 |
| Early growth | 5 | 500 | ~$200 |
| Established | 25 | 2,500 | ~$700 |

---

## Trade-off Analysis

**What this stack optimizes for:**

- **Solo-dev cognitive economy.** Five vendors, one auth context (Supabase), one deployment target (Vercel), one ORM (Drizzle). Every concept can be held in one head.
- **Data sovereignty.** Postgres is portable. Documents and images can move (R2 is S3-compatible). The whole stack has clean exits.
- **Time to first verified work.** Scaffold to production in 2 weeks because Supabase + Drizzle + Vercel is the most-paved path in 2026.

**What it pays in trade:**

- **Vendor count.** Five vendors instead of one (Convex). Mitigated by each having a clear, narrow responsibility.
- **RLS complexity.** Postgres row-level policies are powerful but easy to mis-write. Mitigation: every RLS policy gets a Vitest spec that asserts "user X cannot read row Y" before merge.
- **Real-time isn't first-class.** Convex would give it free; Supabase needs explicit channel subscriptions. Acceptable because we only need it for verification.

---

## Consequences

### What becomes easier

- Adding a second gallery (Heinzel? Sprüth Magers?) — RLS already isolates them.
- Auditing AI calls — every prompt + response is logged with cost and latency.
- Compliance asks (GDPR, German privacy law) — EU data residency is one config; deletion is one Postgres query.
- Frontend-backend contract — Drizzle types flow into Server Actions, frontend imports them directly.

### What becomes harder

- Multi-region. EU-only is fine for Droste; US galleries would need a region-per-tenant story we don't have.
- Workflows that need long-running background jobs. We'll add Inngest the day we need batch enrichment, not before.

### What we'll need to revisit

- The split between documents (Supabase Storage) and images (R2). If R2 + Images proves overkill for our actual traffic, consolidate to Supabase Storage. Decide at month 6.
- AI cost as Sonnet 4.6 rolls forward. Track cost-per-scan; if it drifts above $0.10, switch to Haiku for the first-pass extraction with Sonnet only for ambiguous results.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase pricing change | Low | Med | Postgres backups to R2 weekly; can self-host Postgres in 1 week if needed |
| Anthropic outage | Low | High | Fall back to manual entry path on scan failure; queue retries with exponential backoff |
| Artlogic URLs break before R2 mirror completes | Med | High | Mirror critical seed artworks to R2 in week 1 before public launch |
| RLS policy bug exposes data across galleries | Low | Critical | Every policy gets a deny-by-default test; pen-test before production |
| Passkey UX confuses non-technical collectors | Med | Med | Always-available magic link fallback; in-app explainer at first registration |
| TypeScript errors hidden by `ignoreBuildErrors` | High (already true) | Med | Week 1: flip the flag, fix what surfaces, before any backend work |

---

## Action Items

### Week 1 — foundation
1. [ ] Flip `typescript.ignoreBuildErrors` to `false`; fix all surfaced errors  *(done — see code-review-2026-04-28.md)*
2. [ ] Confirm location of `/collection` route; complete app router map
3. [ ] Provision Supabase project (Frankfurt region)
4. [ ] Set up Drizzle schema mirroring `lib/data.ts` types
5. [ ] Write RLS policies for `artworks`, `documents`, `collectors`, `galleries`
6. [ ] Write deny-by-default RLS test suite (Vitest + Supabase test client)

### Week 2 — auth + first real data
7. [ ] Implement invite token mint + verification (reuse old PANG `signInvite`)  *(harvested into pang/lib/auth/server/)*
8. [ ] Wire passkey registration via Supabase Auth WebAuthn
9. [ ] Implement magic link fallback
10. [ ] Replace `lib/data.ts` mock arrays with Drizzle queries through Server Actions
11. [ ] Seed one gallery (Droste) + 12 real artworks → R2 mirror

### Week 3 — AI scan pipeline
12. [ ] Build `/api/scan` edge route with Claude Vision + structured output
13. [ ] Wire `ArtworkScanner` capture to the route
14. [ ] Replace `Math.random()` frame detection with real confidence from Claude response
15. [ ] Build prompt eval corpus (20 known images) + CI gate

### Week 4 — verification + observability
16. [ ] Build gallery-staff verification flow (separate auth context)
17. [ ] Wire Supabase Realtime for verification status fan-out
18. [ ] Sentry + PostHog + Helicone wiring
19. [ ] Pen-test RLS with two-collector / two-gallery scenarios
20. [ ] Production deploy behind a single invite link to Tobias's email

---

## Open questions blocking action items 7, 11, 16

These six need answers before week 2 work proceeds:

1. **Auth model** — do gallery staff share collector auth with role flags, or live in a separate auth context?
2. **Data ownership** — collector or gallery? Affects deletion, export, and account-closure semantics.
3. **Multi-gallery** — is the pilot single-gallery only, or do RLS policies pre-empt multi-tenant from day one?
4. **Collector circle semantics** — can collectors see each other? Within a gallery only? Never?
5. **AI extraction target** — exactly which fields does Claude extract from a scan? (Drives prompt design, schema, eval corpus.)
6. **Document budget** — what counts as a "document"? Hard size cap? Encryption-at-rest mandatory or best-effort?

Once these resolve, week 1 starts.
