#!/usr/bin/env tsx
/**
 * PANG — narrative tick (dev cron, iter #14).
 *
 * One-shot CLI that runs the narrative pipeline for a single
 * collector. Mirrors what the Vercel cron (not yet enabled) will do
 * once per month per collector.
 *
 *   npm run narrative:tick -- --collector=laura \
 *       --state=./tmp/laura-state.json
 *
 * `--state` is a path to a JSON file with `NarrativeCollectorState`
 * shape — `verifiedWorks`, `provenanceEntries`, `bioMujiParagraphs`.
 * The dev script validates the file against the tick request schema
 * and then steps through the same pipeline the route exposes:
 *
 *   1. Skip if `hasCurrentMonth(collectorId)` — cached.
 *   2. Assemble. A skip here commits a skipped marker.
 *   3. Hash compare. Same as last month → "unchanged-collection".
 *   4. Call `runNarrative`. null → "agent-failure".
 *   5. Success → commit the paragraph marker.
 *
 * The script does NOT call the HTTP route — it invokes the same
 * library functions. This way the dev cron works offline (no dev
 * server required), and the library + route share semantics by
 * construction.
 *
 * Cron wiring lives in `docs/narrative-cron.md`. The production
 * rollout is deferred until the collector-state store lands (iter
 * #15+); this script is the scaffolding for that rollout.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NarrativeTickRequestSchema,
  type NarrativeTickRequest,
  type NarrativeMarker,
  type NarrativeSkipReason,
} from "@/narrative/schema";
import {
  assembleNarrativeInput,
  monthOf,
  type NarrativeCollectorState,
} from "@/narrative/input";
import {
  getCurrentMonth,
  getPriorMonthHash,
  hasCurrentMonth,
  putCurrentMonth,
} from "@/narrative/store";
import { runNarrative } from "@/ai/agents/narrative";

interface Args {
  readonly collector: string;
  readonly statePath: string | null;
  readonly dryRun: boolean;
}

function parseArgs(): Args {
  let collector: string | null = null;
  let statePath: string | null = null;
  let dryRun = false;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--collector=")) collector = raw.slice(12);
    else if (raw.startsWith("--state=")) statePath = raw.slice(8);
    else if (raw === "--dry-run") dryRun = true;
    else if (raw === "--help" || raw === "-h") {
      console.log(
        [
          "Usage: npm run narrative:tick -- --collector=<id> --state=<path>",
          "",
          "  --collector=<id>    Stable collector identifier",
          "  --state=<path>      Path to a NarrativeCollectorState JSON file",
          "  --dry-run           Run the pipeline but do not commit a marker",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  if (!collector) {
    console.error("narrative-tick: --collector=<id> is required");
    process.exit(2);
  }
  if (!statePath) {
    console.error("narrative-tick: --state=<path> is required");
    process.exit(2);
  }
  return { collector, statePath, dryRun };
}

function readState(
  path: string,
  collectorId: string,
): NarrativeCollectorState {
  const raw = readFileSync(resolve(process.cwd(), path), "utf-8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to parse ${path}: ${msg}`);
  }
  // Validate through the tick-request schema so the file shape
  // matches what the HTTP route would accept. The file may omit
  // `collectorId` — we inject the CLI arg in that case so the same
  // state file can drive ticks for any collector in dev.
  const candidate = parsedJson as Partial<NarrativeTickRequest>;
  const parsed = NarrativeTickRequestSchema.safeParse({
    collectorId: candidate.collectorId ?? collectorId,
    verifiedWorks: candidate.verifiedWorks ?? [],
    provenanceEntries: candidate.provenanceEntries ?? [],
    bioMujiParagraphs: candidate.bioMujiParagraphs ?? {},
  });
  if (!parsed.success) {
    throw new Error(
      `state file failed validation: ${parsed.error.toString()}`,
    );
  }
  const { verifiedWorks, provenanceEntries, bioMujiParagraphs } = parsed.data;
  return {
    collectorId,
    verifiedWorks,
    provenanceEntries,
    bioMujiParagraphs,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const collectorId = args.collector;
  const now = new Date();
  const month = monthOf(now);
  console.log(`narrative-tick: collector=${collectorId} month=${month}`);

  // --- 1. Cached? ------------------------------------------------
  if (await hasCurrentMonth(collectorId, now)) {
    const existing = await getCurrentMonth(collectorId, now);
    console.log(
      `  cached: marker kind=${existing?.kind ?? "?"} — nothing to do`,
    );
    return;
  }

  // --- 2. Assemble -----------------------------------------------
  if (!args.statePath) {
    console.error("narrative-tick: state file is required (see --state)");
    process.exit(2);
  }
  const state = readState(args.statePath, collectorId);
  const assembled = assembleNarrativeInput(state, now);
  if (assembled.kind === "skip") {
    const reason: NarrativeSkipReason = assembled.reason;
    console.log(`  assembler-skip: reason=${reason}`);
    if (args.dryRun) return;
    const marker: NarrativeMarker = {
      kind: "skipped",
      collectorId,
      month,
      // Assembler skips (empty-collection, thin-provenance) carry no
      // canonical hash — the sentinel matches the route's commitSkip
      // shape so store-layer filters stay simple.
      collectionHash: "skip-no-hash-0000",
      reason,
      decidedAt: new Date().toISOString(),
    };
    await putCurrentMonth(collectorId, marker, now);
    console.log("  committed skipped marker");
    return;
  }

  const input = assembled.input;

  // --- 3. Hash compare -------------------------------------------
  const priorHash = await getPriorMonthHash(collectorId, now);
  if (priorHash !== null && priorHash === input.collectionHash) {
    const reason: NarrativeSkipReason = "unchanged-collection";
    console.log(`  hash-match: reason=${reason}`);
    if (args.dryRun) return;
    const marker: NarrativeMarker = {
      kind: "skipped",
      collectorId,
      month,
      collectionHash: input.collectionHash,
      reason,
      decidedAt: new Date().toISOString(),
    };
    await putCurrentMonth(collectorId, marker, now);
    console.log("  committed skipped marker");
    return;
  }

  // --- 4. Agent --------------------------------------------------
  console.log("  running narrative agent…");
  const result = await runNarrative(input);
  if (result === null) {
    const reason: NarrativeSkipReason = "agent-failure";
    console.log(`  agent returned null: reason=${reason}`);
    if (args.dryRun) return;
    const marker: NarrativeMarker = {
      kind: "skipped",
      collectorId,
      month,
      collectionHash: input.collectionHash,
      reason,
      decidedAt: new Date().toISOString(),
    };
    await putCurrentMonth(collectorId, marker, now);
    console.log("  committed skipped marker");
    return;
  }

  // --- 5. Commit paragraph ---------------------------------------
  console.log(`  agent produced paragraph (${result.paragraph.length} chars)`);
  if (args.dryRun) {
    console.log("  (dry-run: skipping marker commit)");
    console.log(result.paragraph);
    return;
  }
  const marker: NarrativeMarker = {
    kind: "paragraph",
    collectorId,
    month,
    collectionHash: input.collectionHash,
    paragraph: result.paragraph,
    decidedAt: new Date().toISOString(),
  };
  await putCurrentMonth(collectorId, marker, now);
  console.log("  committed paragraph marker");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
