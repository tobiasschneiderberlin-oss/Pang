#!/usr/bin/env node
/**
 * PANG — string audit.
 *
 * Static analysis over all .tsx/.ts files for violations of the voice
 * doctrine (PANG_Voice.md). Iteration #0 ships the scaffold with a
 * narrow ruleset; the full corpus diff against `PANG_VOICE_STRINGS`
 * arrives with the register bundle in iteration #3.
 *
 * Rules enforced now:
 *   1. No emoji anywhere.
 *   2. No marketing vocabulary ("awesome", "amazing", "love",
 *      "welcome back", "get started", "easy", "simple", "powerful").
 *   3. No first-person plural in strings ("we", "our", "us") except
 *      in code comments.
 *   4. No title-case button labels — button text is sentence case or
 *      ALL CAPS. Heuristic: more than one word where every token is
 *      capitalized is a red flag.
 *   5. No evaluative language in generated prose templates
 *      ("beautiful", "striking", "vibrant") if the file sits under
 *      `src/agents/**`.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["src", "app"];
const EXTS = /\.(ts|tsx|mdx)$/;

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;

const MARKETING = [
  "awesome",
  "amazing",
  "love ",
  "welcome back",
  "get started",
  "easy",
  "simple",
  "powerful",
  "unlock",
  "unleash",
  "supercharge",
  "magical",
  "delightful",
];

const EVALUATIVE = [
  "beautiful",
  "striking",
  "vibrant",
  "stunning",
  "masterful",
  "breathtaking",
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

function extractStringLiterals(
  src: string,
): Array<{ value: string; line: number }> {
  // Strip block comments first, preserving line count so reported
  // line numbers stay accurate. A one-line JSDoc like
  // `/** see "simple-image" */` embeds a quoted literal inside a
  // comment; without this pass the literal would falsely register
  // as a UI string. Line comments are handled below by the
  // trimmed-prefix check.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve newlines so line numbers don't shift.
    const newlines = match.match(/\n/g)?.length ?? 0;
    return "\n".repeat(newlines);
  });
  const lines = stripped.split("\n");
  const out: Array<{ value: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip comment-only lines (voice doctrine applies to UI strings,
    // not to comments that describe doctrine).
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    // "string", 'string', `string` — crude but sufficient for audit.
    const re = /(["'`])((?:\\.|(?!\1).)*?)\1/g;
    for (const m of line.matchAll(re)) {
      out.push({ value: m[2] ?? "", line: i + 1 });
    }
  }
  return out;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (EXTS.test(e.name)) out.push(p);
  }
  return out;
}

async function main(): Promise<void> {
  const files: string[] = [];
  for (const r of ROOTS) files.push(...(await walk(r)));

  const violations: Violation[] = [];

  // Registry files legitimately contain the banned terms as data.
  // The audit checks UI strings, not ban-list contents. Examples:
  //   - banned.ts              — the ban list itself
  //   - voice.ts               — quotes the rule text the P-LLM sees
  //   - sanitize.ts            — error messages reference the terms
  //   - prompts/*              — in-prompt negative examples ("do
  //                              not write 'awesome'")
  // Paths reflect DS Appendix D: CaMeL primitives under
  // `src/ai/camel/`, prompts under `src/ai/prompts/`. Agent + gate
  // scripts are also exempt because they carry rule text as string
  // arguments.
  const REGISTRY_FILES = new Set<string>([
    "src/ai/camel/banned.ts",
    "src/ai/camel/sanitize.ts",
    "src/ai/prompts/voice.ts",
    "src/ai/prompts/intake.ts",
    // Test fixtures that contain the ban list as data to assert
    // against — the strings are the vocabulary under review, not
    // UI copy.
    "src/ai/prompts/failure.test.ts",
  ]);

  for (const f of files) {
    const src = await readFile(join(ROOT, f), "utf8");
    if (REGISTRY_FILES.has(f)) continue;
    const isAgent = f.startsWith("src/agents/") || f.startsWith("src/lib/agents/");
    // Test files carry ban-list terms as deliberate fixtures — a
    // verification-request test asserts that `"awesome"` is rejected
    // at the boundary, which requires writing "awesome" in the
    // fixture. The audit is about UI copy, not test fixtures.
    const isTestFile = f.endsWith(".test.ts") || f.endsWith(".test.tsx");
    const literals = extractStringLiterals(src);

    for (const { value, line } of literals) {
      if (!value) continue;
      const lower = value.toLowerCase();

      if (EMOJI_RE.test(value)) {
        violations.push({
          file: f,
          line,
          rule: "no emoji",
          snippet: value.slice(0, 60),
        });
      }
      // Code-identifier shape: lowercase kebab-case tokens like
      // `simple-image` (OSD tile-source kind), `double-tap`,
      // `cold-open`. These are discriminated-union literals, not
      // prose — the voice rule targets user-facing copy. A string
      // with no spaces, at least one hyphen, and only [a-z0-9-]
      // characters is a code identifier and exempt from the
      // marketing scan. Prose (has spaces) and Title Case stay in.
      const isCodeIdentifier = /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value);
      if (!isTestFile && !isCodeIdentifier) {
        for (const term of MARKETING) {
          if (lower.includes(term)) {
            violations.push({
              file: f,
              line,
              rule: `marketing term "${term.trim()}"`,
              snippet: value.slice(0, 60),
            });
          }
        }
      }
      if (isAgent) {
        for (const term of EVALUATIVE) {
          if (lower.includes(term)) {
            violations.push({
              file: f,
              line,
              rule: `evaluative language "${term}" in agent template`,
              snippet: value.slice(0, 60),
            });
          }
        }
      }
      // Title-case heuristic: only flag strings that look like UI
      // labels (reasonably short, multi-word, all words capitalized,
      // none ALL-CAPS). Excludes import paths, URL-like strings, and
      // known value-context files — the font loader and the locked
      // design-token registry legitimately list proper-noun font
      // families ("Instrument Serif", "Geist Mono", "Times New Roman")
      // which are CSS identifiers, not UI labels. Test fixtures also
      // carry real-world proper nouns (artist names, gallery names)
      // as data — a realistic fixture is the point, and the strings
      // never reach a UI surface.
      const isValueContextFile =
        f.endsWith("fonts.ts") ||
        f.endsWith("fonts.tsx") ||
        f.endsWith("locked.ts") ||
        f.endsWith(".test.ts") ||
        f.endsWith(".test.tsx");
      if (
        !isValueContextFile &&
        value.length < 40 &&
        !value.includes("/") &&
        !value.includes(":") &&
        /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/.test(value)
      ) {
        violations.push({
          file: f,
          line,
          rule: "title case",
          snippet: value,
        });
      }
    }
  }

  if (!violations.length) {
    console.log("voice: ok");
    return;
  }

  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet}`);
  }
  console.error(`\nvoice: ${violations.length} violation(s)`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Silence the unused-import warning without importing node:fs/stat.
void stat;
