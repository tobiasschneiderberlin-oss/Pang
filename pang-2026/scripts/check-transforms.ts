#!/usr/bin/env node
/**
 * PANG — CSS-scale-transform scanner (iteration #7, P24 extension).
 *
 * Primitive §21 says: deep zoom lives behind OpenSeadragon. The
 * 2018-era regression class is a CSS `transform: scale(2)` on a flat
 * JPEG — crisp at 1×, mush at 2×. This scanner fails CI if any file
 * under `src/` or `app/` (outside the sanctioned DeepZoom adapter
 * directory) uses:
 *
 *   - CSS `transform: scale(...)`, `scaleX(...)`, `scaleY(...)`, or
 *     `scale3d(...)` in a style literal or `.css` file.
 *   - Tailwind `scale-*` utilities (`scale-50`, `scale-125`,
 *     `scale-[1.5]`), including the `scale-x-*` / `scale-y-*`
 *     variants.
 *
 * What we still accept (by design):
 *
 *   - `transform: scale(...)` inside `src/components/deep-zoom/**`
 *     (the sanctioned adapter, which in practice never uses one).
 *   - `matrix(...)` / `matrix3d(...)` — these show up in
 *     Three.js-adjacent code paths and are not the 2018 regression
 *     target.
 *   - Non-transform uses of the word "scale": variable names,
 *     renderer scale factors, OSD's `navigatorSizeRatio`. The regex
 *     binds only to CSS-transform syntax and Tailwind utility
 *     syntax.
 *
 * Exported as a function so `check-gates.ts` can fold it under P24
 * without the extra tsx-spawn cost. Also runnable standalone:
 *
 *     node --import=tsx scripts/check-transforms.ts
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ScanResult {
  readonly ok: boolean;
  /** First offending `path:line` + the match text. Empty when `ok`. */
  readonly violations: ReadonlyArray<{
    readonly path: string;
    readonly line: number;
    readonly match: string;
  }>;
  /** Files scanned (for sanity-check assertions in tests). */
  readonly scanned: number;
}

const ROOT = process.cwd();

const DEFAULT_ROOTS: readonly string[] = ["src", "app"];
const DEFAULT_EXEMPT: readonly string[] = [
  "src/components/deep-zoom",
  // `scripts/check-transforms.test.ts` lives under `scripts/`, not
  // `src/` or `app/`, so it's outside the scan roots by default.
  // The scanner itself can also appear in its own fixture — exempt
  // fixture paths below.
];
const EXTS = new Set(["ts", "tsx", "css"]);

/**
 * CSS transform-scale regex. Captures:
 *   1. `transform:` or `transform = ` in style objects
 *   2. Any scale function: `scale(...)`, `scaleX(...)`, `scaleY(...)`,
 *      `scale3d(...)`
 *
 * Case-sensitive — CSS property names + the scale family are all
 * lowercase in idiomatic code. Style-object values in React are
 * `scale`/`scaleX`/... (camel-ish, but still starts lowercase).
 */
const CSS_TRANSFORM_SCALE_RE =
  /transform\s*[:=]\s*['"`][^'"`]*\bscale(?:X|Y|3d)?\s*\(/;

/**
 * Tailwind scale utility regex. Matches:
 *   - `scale-0`, `scale-50`, `scale-100`, `scale-125`, …
 *   - `scale-x-100`, `scale-y-90`
 *   - Arbitrary values: `scale-[1.5]`, `scale-x-[0.75]`
 *
 * Requires a word boundary + the class-list syntax (space or quote)
 * before `scale-` so a variable named `scaleBounds` does not match.
 */
const TAILWIND_SCALE_RE =
  /(?:^|[\s'"`=])scale(?:-[xy])?-(?:\d+|\[[^\]]+\])\b/;

/**
 * Walk `roots`, collecting file paths with allowed extensions. Paths
 * rooted under any `exempt` prefix are skipped before file read (so
 * even a large exempt directory stays cheap).
 */
async function walk(
  roots: readonly string[],
  exempt: readonly string[],
): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string): Promise<void> {
    if (exempt.some((e) => dir === e || dir.startsWith(`${e}/`))) return;
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        await visit(p);
      } else {
        const ext = e.name.split(".").pop();
        if (ext && EXTS.has(ext)) out.push(p);
      }
    }
  }
  for (const r of roots) await visit(r);
  return out;
}

export async function scanForTransformScale(
  opts: {
    roots?: readonly string[];
    exempt?: readonly string[];
    maxViolations?: number;
  } = {},
): Promise<ScanResult> {
  const roots = opts.roots ?? DEFAULT_ROOTS;
  const exempt = opts.exempt ?? DEFAULT_EXEMPT;
  const maxViolations = opts.maxViolations ?? 5;
  const files = await walk(roots, exempt);
  const violations: { path: string; line: number; match: string }[] = [];
  for (const f of files) {
    const raw = await readFile(join(ROOT, f), "utf8");
    // Strip JS block + line comments so prose in a doctrine
    // annotation ("reject `transform: scale(2)`") does not trip.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:\/])\/\/.*$/gm, "$1");
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const cssMatch = CSS_TRANSFORM_SCALE_RE.exec(line);
      if (cssMatch) {
        violations.push({
          path: f,
          line: i + 1,
          match: cssMatch[0],
        });
        if (violations.length >= maxViolations) break;
        continue;
      }
      const twMatch = TAILWIND_SCALE_RE.exec(line);
      if (twMatch) {
        violations.push({
          path: f,
          line: i + 1,
          match: twMatch[0].trim(),
        });
        if (violations.length >= maxViolations) break;
      }
    }
    if (violations.length >= maxViolations) break;
  }
  return {
    ok: violations.length === 0,
    violations,
    scanned: files.length,
  };
}

// Standalone runner. `check-gates.ts` imports `scanForTransformScale`
// directly and folds the result into P24; running this file alone
// also prints a short report for manual debugging.
async function main(): Promise<void> {
  const result = await scanForTransformScale();
  if (result.ok) {
    process.stdout.write(
      `check-transforms — ok (${result.scanned} files)\n`,
    );
    return;
  }
  process.stderr.write(
    `check-transforms — ${result.violations.length} violation(s):\n`,
  );
  for (const v of result.violations) {
    process.stderr.write(`  ${v.path}:${v.line}  ${v.match}\n`);
  }
  process.exit(1);
}

// Execute the main function when run directly (not when imported).
// Works under `tsx` + `node --import=tsx`.
const entry = process.argv[1] ? fileURLToPath(import.meta.url) : null;
if (entry && entry === process.argv[1]) {
  void main();
}
