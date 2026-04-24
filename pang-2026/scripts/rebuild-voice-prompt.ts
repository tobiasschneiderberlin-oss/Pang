#!/usr/bin/env node
/**
 * PANG — rebuild `PANG_VOICE_SYSTEM_PROMPT`.
 *
 * `src/ai/prompts/voice.ts` is a deterministic artifact of this
 * script. The script reads the six canonical samples from
 * `PANG_VOICE_STRINGS` (via `resolveCanonical`) and writes the
 * "Voice examples" block into `voice.ts`. Every other line of
 * `voice.ts` is stable prose that doctrine owns — the script
 * preserves it byte-for-byte between two markers:
 *
 *   <!-- EXAMPLES:BEGIN -->
 *   … (generated block) …
 *   <!-- EXAMPLES:END -->
 *
 * Flags:
 *   --dry-run   exit 0 if voice.ts already matches, 1 if it would change
 *               (this is how `check:voice-prompt` runs in CI)
 *   --stdout    print the rebuilt file to stdout instead of writing
 *               (useful for `diff <(rebuild --stdout) voice.ts`)
 *
 * Why the script, not a runtime assembly: the Anthropic prompt cache
 * wants a stable string on every call. A runtime template that
 * shuffles substrings would evict cache and pay the miss. Baking the
 * examples into a static `const` string keeps the cache hot and
 * makes the seed grepable.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CANONICAL_SAMPLE_ADDRESSES,
  resolveCanonical,
} from "../src/ai/prompts/strings";

const ROOT = process.cwd();
const TARGET = "src/ai/prompts/voice.ts";
const BEGIN = "// EXAMPLES:BEGIN (rebuilt by scripts/rebuild-voice-prompt.ts)";
const END = "// EXAMPLES:END";

/**
 * Short, human-readable labels for each canonical slot — the lines
 * that appear *before* the slot value inside the seed, giving the
 * model context for why the example is an example. Doctrine lives in
 * `PANG_Voice.md` § *The four registers*.
 */
const SLOT_LABELS: Record<string, string> = {
  "invite.greeting": "the invite greeting, shown when a collector first opens the link",
  "ask_gallery.action": "the ask-gallery affordance, one tap from the artwork detail",
  "outcome.confirmation": "the wall-caption after the gallery confirms",
  "push.offer": "the single-use push-subscribe offer, shown once under the requested chip",
  "dispatch.email_label": "the email subject line templated from the artwork fields",
  "arrival.placement": "the wall-text that frames a newly placed work",
};

/**
 * Assemble the generated examples block. One line per slot — short,
 * labelled, quoted. The block sits inside the seed between BEGIN/END
 * markers and is the only mutable region of `voice.ts`.
 */
function buildExamplesBlock(): string {
  const lines = [BEGIN];
  lines.push("// Canonical voice samples — six doctrine slots, one line each.");
  lines.push("// Edit `src/ai/prompts/strings.ts` and re-run `bun run rebuild:voice-prompt`.");
  lines.push("//");
  for (const addr of CANONICAL_SAMPLE_ADDRESSES) {
    const label = SLOT_LABELS[addr] ?? addr;
    const value = resolveCanonical(addr);
    lines.push(`//   ${addr} — ${label}`);
    lines.push(`//     ${JSON.stringify(value)}`);
  }
  lines.push(END);
  return lines.join("\n");
}

/**
 * Rebuild the whole `voice.ts` file in-memory. The header comment,
 * the `export const PANG_VOICE_SYSTEM_PROMPT` body, and the tail
 * are stable text owned by doctrine; only the BEGIN/END block
 * changes when a canonical slot changes value.
 */
function buildFileContents(): string {
  const header = `/**
 * PANG — the voice seed.
 *
 * Prepended as a cached system message to every user-facing Anthropic
 * call (A4, A6, A24). This file is a **generated artifact** — do not
 * hand-edit the examples block. Edit \`src/ai/prompts/strings.ts\` (or
 * the domain corpus it re-exports from) and run:
 *
 *     bun run rebuild:voice-prompt
 *
 * CI (\`check:voice-prompt\`) fails the build if the committed file
 * drifts from what the bundle would produce. The seed does three
 * things:
 *
 *   1. Establishes character — a room, not a chatbot.
 *   2. Names the register — Muji for generated prose.
 *   3. Bans vocabulary by example — the runtime check lives in
 *      \`src/ai/camel/banned.ts\`; this file gives the model the
 *      "why" and shows canonical samples from the voice corpus.
 */
`;

  const block = buildExamplesBlock();

  const prompt = `export const PANG_VOICE_SYSTEM_PROMPT = \`
You are writing strings that will appear inside PANG, a quiet gallery
app for private art collectors. The writing surface is a room, not
a chatbot. The collector has stepped into a small lit space with
their collection; your words are the wall text, not the greeter.

Register:
- Sentence case. One optical weight. No title case.
- Observational, not evaluative. Describe, do not praise.
- Two sentences maximum for any bio or note unless asked otherwise.
- Warm when it is warm. Cool when it is cool. Never loud.

Never use:
- Marketing vocabulary ("amazing", "powerful", "unlock", "magical",
  "delightful", "welcome back", "get started").
- Evaluative language about artworks ("stunning", "striking",
  "breathtaking", "iconic"). Describe what is, not how it lands.
- First-person plural ("we", "our", "us"). The app does not have a
  team behind the glass.
- Emojis. Anywhere. Ever.

Voice examples (the register):
- YES: "Oil on canvas, 1987. Signed lower right."
- YES: "Purchased from Galerie Droste, Berlin, 2004."
- NO:  "A truly stunning piece that showcases the artist's mastery."
- NO:  "Welcome back! Your beautiful collection awaits."

When extracting facts into a tool call, return the facts. When
writing any free-form prose field (bioMuji, arrivalLine), keep it
short, specific, and non-evaluative. If you do not know a value,
return null — do not invent.
\`.trim();
`;

  return `${header}\n${block}\n\n${prompt}`;
}

async function readExisting(): Promise<string> {
  return readFile(join(ROOT, TARGET), "utf8");
}

interface Options {
  dryRun: boolean;
  stdout: boolean;
}

function parseFlags(argv: readonly string[]): Options {
  return {
    dryRun: argv.includes("--dry-run"),
    stdout: argv.includes("--stdout"),
  };
}

async function main(): Promise<void> {
  const opts = parseFlags(process.argv.slice(2));
  const next = buildFileContents();

  if (opts.stdout) {
    process.stdout.write(next);
    return;
  }

  const existing = await readExisting().catch(() => "");

  if (opts.dryRun) {
    if (existing === next) {
      console.log("voice-prompt: ok (in sync with PANG_VOICE_STRINGS)");
      return;
    }
    console.error(
      `voice-prompt: drift — ${TARGET} is stale. Run:\n  bun run rebuild:voice-prompt`,
    );
    // Print a tiny diff summary (counts only) so CI logs stay short.
    const before = existing.split("\n").length;
    const after = next.split("\n").length;
    console.error(`  lines: ${before} committed -> ${after} rebuilt`);
    process.exit(1);
  }

  if (existing === next) {
    console.log(`voice-prompt: ${TARGET} already in sync`);
    return;
  }

  await writeFile(join(ROOT, TARGET), next, "utf8");
  console.log(`voice-prompt: wrote ${TARGET} (rebuilt from PANG_VOICE_STRINGS)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
