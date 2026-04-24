# Narrative tick — dev cron wiring

The narrative agent produces at most one observational paragraph per
collector per calendar month. In development this runs as a one-shot
CLI (`scripts/narrative-tick.ts`); production cron wiring is deferred
until the collector-state store lands (iter #15+).

## Dev usage

```sh
# Run the pipeline for a single collector against a JSON state file.
npm run narrative:tick -- \
  --collector=laura \
  --state=./tmp/laura-state.json

# Dry run: step through the pipeline but do not commit a marker.
npm run narrative:tick -- \
  --collector=laura \
  --state=./tmp/laura-state.json \
  --dry-run
```

The state file is a JSON document with three keys:

```json
{
  "verifiedWorks": [
    { "id": "w1", "title": "Harbour Light", "artistId": "a-hojgaard",
      "artist": "Jens Hojgaard", "year": 1972, "medium": "oil on canvas" }
  ],
  "provenanceEntries": [
    { "workId": "w1", "kind": "acquisition", "year": 1975,
      "summary": "Acquired from Galleri Nord, Copenhagen." }
  ],
  "bioMujiParagraphs": {
    "a-hojgaard": "Jens Hojgaard (1928-1994) painted landscapes along …"
  }
}
```

The script validates the file against `NarrativeTickRequestSchema`
(same shape the HTTP route accepts). An omitted `collectorId` in the
file is filled from the `--collector` CLI flag so the same state file
can drive ticks for any collector in dev.

## Pipeline

1. **Cached?** `hasCurrentMonth(collectorId, now)` — if a marker
   exists for the current calendar month the script exits silently.
2. **Assemble.** `assembleNarrativeInput(state, now)` applies the
   CaMeL boundary and the thin-provenance floor. An assembler skip
   commits a `kind: "skipped"` marker with the reason.
3. **Hash compare.** `getPriorMonthHash(collectorId, now)` — if the
   prior month's collectionHash equals this month's, commit a
   `kind: "skipped"` marker with reason `"unchanged-collection"`.
4. **Agent.** `runNarrative(input)`. `null` → commit an
   `"agent-failure"` skip.
5. **Commit.** `putCurrentMonth(collectorId, marker, now)` writes the
   paragraph marker. Primitive 51: the marker is the side effect.

## Production cron (deferred)

The production cron will run at `0 4 1 * *` (UTC — 04:00 on the 1st
of each month) via Vercel Cron. It walks the collector-state store
(iter #15+) and issues one tick per active collector. Failure
handling is per-collector: a single agent failure does not block the
next collector's tick.

No vercel.json entry is wired in iter #14 — only the scaffolding.
Enabling the cron is a follow-up that lands alongside the
collector-state store.

## Environment

- `ANTHROPIC_API_KEY` — required for real agent calls. A missing key
  causes `runNarrative` to throw at the Anthropic client construction.
- `PANG_NARRATIVE_STORE_DIR` — optional. Overrides the default
  marker storage directory. Used by the unit tests to isolate
  per-test state; in dev, leave unset to use the real filesystem
  stand-in under `.pang/narrative/`.

## Observability

Each tick emits a `pang.narrative.generate` OTel span with:

- `pang.narrative.month` (YYYY-MM)
- `pang.narrative.verified_work_count`
- `pang.narrative.provenance_entry_count`
- `pang.narrative.collection_hash`
- `pang.narrative.paragraph_length` (on success)
- `pang.narrative.failure_reason` (on skip)

Skip reasons are typed (`NarrativeSkipReasonSchema` in
`src/narrative/schema.ts`) so telemetry can group cleanly (primitive
62).
