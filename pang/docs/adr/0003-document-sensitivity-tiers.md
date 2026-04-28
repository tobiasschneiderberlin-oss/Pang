# ADR-003: Document Sensitivity Tiers

**Status:** Accepted
**Date:** 2026-04-28
**Refines:** [ADR-001 § Sub-decision 4 (File Storage)](0001-backend-architecture.md)

---

## Context

PANG documents include certificates of authenticity, invoices, condition reports, insurance valuations, and provenance attestations. Some are sensitive enough that some collectors will eventually want zero-knowledge storage — the server cannot read them. The question for ADR-001 Q6 was: is end-to-end encryption (E2EE) required at launch, and if not, how do we leave room for it?

A research dive on 2026-04-28 (sources in commit history) found:

- **No regulator requires E2EE for art-collector documents.** GDPR Art. 32 (risk-based + state-of-the-art); German § 147 AO and GwG actively require **retrievability**, which conflicts with E2EE for tax-relevant and AML-relevant docs. Washington Principles for Nazi-looted-art provenance argue for *more* openness, not less.
- **Industry practice is server-side encryption only.** ArtBinder, Articheck (notably 128-bit, behind 2026 norms), Artwork Archive. Christie's was breached May 2024 (RansomHub, 500k clients); Sotheby's was breached July 2025 (names, SSNs, financial accounts). The threat model is server compromise, not regulator audit.
- **WebAuthn PRF is now broadly supported** (macOS 15+, iOS 18+, Android, Windows 11 25H2 + Feb 2026 patch). Passkey-derived encryption keys are a real production primitive.

The right answer: meet the legal floor with standard server-side encryption now; reserve a schema slot for opt-in locked-tier E2EE later; invest the engineering budget in defense-in-depth at the platform layer (per-tenant KMS, signed-URL TTLs, audit logging, anomaly detection).

## Decision

Two-tier model defined in schema; **only the standard tier is implemented at launch**.

```ts
type SensitivityTier = "standard" | "locked";
```

### Standard tier (launch)

| Aspect | Implementation |
|---|---|
| Storage | Supabase Storage with server-side encryption-at-rest (AES-256). |
| Authorization | Row-Level Security gates on collector ownership + gallery membership. |
| Access | Signed URLs with **5-minute TTL**. |
| Search | Full-text search over OCR'd content (when implemented). |
| Preview | Thumbnails generated server-side. |
| Audit | Every fetch logged: who, when, from where, which document, what action. |
| File types | PDF, PDF/A, JPG, PNG, HEIC, MP4. |
| Per-document hard cap | 25 MB. |
| Per-artwork soft cap | 20 documents. |
| Per-collector storage | 10 GB at pilot tier (renegotiable per gallery). |
| Soft-delete window | 30 days before permanent purge. |

### Locked tier (post-MVP, on demand)

| Aspect | Implementation |
|---|---|
| Storage | Opaque AES-256-GCM ciphertext blob. |
| Encryption key | Derived from the collector's passkey via WebAuthn PRF extension. |
| Recovery | Mandatory written recovery code at first lockdown enable. Without it, key loss is permanent. |
| Authorization | Server cannot decrypt; only client-side. |
| Search | **Not searchable.** |
| Preview | **No thumbnails.** |
| Audit | Server logs document existence, size, access timestamps; cannot log content. |
| Multi-device | Each registered passkey is enrolled separately at lockdown enable; recovery code re-enrolls a new passkey. |

### Hard exclusions from the locked tier

A document **cannot** be marked `locked` if it is tagged with any of:

| Tag | Why locked is forbidden |
|---|---|
| `tax-relevant` | § 147 AO: retrievable for 6–10 years on tax audit. |
| `aml-relevant` | GwG § 8: producible to FIU on request. |
| `verification-pending` | Gallery must read the doc to perform verification (the trust-layer flow). |

The frontend surfaces this as "this document type can't be locked" with a link to the rationale.

### Defense-in-depth that complements (not replaces) standard-tier encryption

These six measures matter more than E2EE for the actual threat model (Christie's-style server compromise, ransomware, insider risk):

1. **Per-tenant encryption keys at gallery level.** Year-1 milestone, not pilot. Each gallery's documents wrapped with a tenant-specific KMS key (Supabase Vault or external KMS). A leak of one tenant's key doesn't compromise others.
2. **5-minute signed-URL TTL.** Already in the standard-tier table. Short enough to deter sharing-by-paste.
3. **Audit log on every document access.** Append-only table; useful for breach forensics + collector transparency ("your gallery viewed this CoA on 2026-04-22").
4. **Anomaly detection on bulk-download patterns.** Nightly query: any user downloading >20 documents in <1h triggers an alert.
5. **Bot-resistant rate limits on document fetch endpoints.** Lifts cleanly from the deferred `rate-limit.ts` salvage when KV lands.
6. **No PII in URLs.** Document IDs are opaque; collector / artwork / gallery context comes from auth, not URL.

## What to build now (2026-04-28 onward)

- `documents.sensitivity_tier` column in Drizzle schema, default `"standard"`, enum-constrained to `"standard" | "locked"`.
- `documents.locked_meta` JSON column reserved for future PRF-derived metadata (kept null at launch).
- Type union in API admits both values; the `"locked"` branch is `never` until enabled.
- Document type tags (`tax-relevant`, `aml-relevant`, etc.) defined in the same schema migration so the exclusion rules are enforceable from day one.

## What to build later (~7 days when triggered)

- WebAuthn PRF integration in `lib/auth/webauthn/` (when webauthn lift from `fd07758^` lands).
- AES-256-GCM wrap/unwrap helpers in `lib/storage/locked.ts`.
- Recovery-code UX: modal at first lockdown enable, copy/print/QR options, required to proceed.
- Tests covering: passkey lost + recovery available, passkey lost + no recovery, multi-device sync, recovery code mis-typed.

## Consequences

### What this enables

- The platform meets the GDPR / German tax / AML legal floor at launch without E2EE.
- Forward-compatible schema means adding the locked tier is additive, not migrational.
- Collectors with sensitive-document concerns can be reassured on the roadmap; the answer is "yes, in flight" rather than "no, never."
- Engineering budget concentrates on defense-in-depth (per-tenant KMS, audit logging, anomaly detection) which addresses the actual breach threat model.

### What this costs

- The locked tier is real engineering when it lands (~7 days). Better to know that now than discover it later.
- The hard exclusions (tax / AML / verification-pending) need clear UX or collectors will be confused when they can't lock a document. Surface the rationale at the moment of attempt.

### What we'll need to revisit

- Whether per-tenant KMS keys belong before or after multi-gallery production rollout. Decide at month 4–6 once gallery count is real.
- Whether the soft-delete window of 30 days is the right balance between undelete recovery and storage cost. Revisit at month 6.

## Status

Accepted. Standard tier ships at launch; locked tier ships on first user demand.
