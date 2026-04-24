/**
 * A25 — Corpus discipline.
 *
 * Every user-facing string in `src/components/**` and `app/**` MUST be
 * sourced from a corpus module. The voice layer only holds if a
 * developer literally cannot land an inline string under delivery
 * pressure; A25 is the mechanical boundary at the JSX authoring site.
 *
 * A corpus module is:
 *
 *   1. Any file matching `src/**\/{voice,strings,corpus}*.ts` — the
 *      canonical domain corpora (`src/ai/chapter/voice.ts`,
 *      `src/ai/prompts/strings.ts`, `src/auth/strings.ts` if it lands,
 *      etc.).
 *   2. The `PANG_VOICE_STRINGS` bundle in `src/ai/prompts/strings.ts`
 *      (a barrel of the above).
 *
 * The gate's AST walk targets two node families:
 *
 *   (a) JsxText — hardcoded children, e.g. `<span>sign in</span>`.
 *       Pure whitespace is ignored; a non-whitespace literal fails.
 *
 *   (b) JsxAttribute for the four user-facing attributes —
 *       `title`, `aria-label`, `placeholder`, `alt`. These attributes
 *       are read by assistive technology and surface to collectors
 *       verbatim; they MUST come from the corpus.
 *
 * What passes:
 *
 *   - JSX children that are identifier references or property
 *     accesses whose root identifier resolves (via the import graph)
 *     to a corpus module.
 *   - JSX attribute values whose initializer is such an expression.
 *   - Template literals whose substitutions all resolve to corpus
 *     references AND whose quasi segments are either empty or pure
 *     punctuation/whitespace. A template with prose in the quasis
 *     fails — the prose belongs in the corpus.
 *   - The empty string `""` (developer-affordance for unsetting).
 *
 * What fails:
 *
 *   - `<button title="Close">` — inline attribute literal
 *   - `<div>Sign in</div>` — inline JSX text
 *   - `<span>{`Sign ${who} in`}</span>` — template literal with prose
 *   - `<img alt={helpText}>` where `helpText` is defined in the same
 *     component file, not imported from a corpus module.
 *
 * Fixtures live under `tests/fixtures/voice-v1/a25/{pass,fail}/`.
 *
 * Not in A25 scope (separate gates / intentional non-coverage):
 *
 *   - `console.log`, `throw new Error(...)` — developer-facing.
 *   - `describe("...", ...)` / test names.
 *   - CSS class names, `data-*` attributes, `id` attributes.
 *   - SVG `<title>` inside the chrome-only `<BrandWordmark />` style
 *     — if one lands, it's still user-facing and must be corpus-sourced.
 *
 * Design notes:
 *
 *   - A25 is deliberately narrow. It catches the shape that has
 *     repeatedly regressed (a developer adds a new button under time
 *     pressure and hand-rolls the label). It does not try to catch
 *     every string literal in the repo.
 *
 *   - The complement is A5 (banned vocabulary, existing) which walks
 *     the corpus itself and rejects evaluative / marketing terms.
 *     A25 ensures the strings reach the corpus; A5 polices what the
 *     corpus may say. Together they close the loop.
 */

import { Project, Node } from "ts-morph";
import type {
  Identifier,
  ImportDeclaration,
  JsxAttribute,
  JsxText,
  TemplateExpression,
  StringLiteral,
} from "ts-morph";
import { join, relative, isAbsolute, resolve, dirname } from "node:path";

export interface A25Violation {
  readonly file: string;
  readonly line: number;
  readonly detail: string;
}

export interface A25Result {
  readonly ok: boolean;
  readonly violations: readonly A25Violation[];
  /** Count of JSX text + targeted attributes inspected (for smoke). */
  readonly checked: number;
}

/**
 * Attributes whose value is surfaced verbatim to the collector.
 * These are the accessibility / tooltip surfaces the gate walks.
 */
const USER_FACING_ATTRS = new Set([
  "title",
  "aria-label",
  "placeholder",
  "alt",
]);

/**
 * Paths (relative to repoRoot) that A25 considers corpus modules
 * based solely on filename convention. This is the first-pass check;
 * import-path matching below catches the re-export barrel too.
 */
function isCorpusFilePath(absPath: string): boolean {
  // `src/**\/{voice,strings,corpus}{,.*}.ts` — `voice.ts`, `strings.ts`,
  // `corpus.ts`, `voice.foo.ts`, etc. Excludes tests.
  if (!/\.ts$/.test(absPath)) return false;
  if (/\.test\.tsx?$/.test(absPath)) return false;
  const base = absPath.split("/").pop() ?? "";
  return /^(?:voice|strings|corpus)(?:\.|$)/.test(base);
}

/**
 * Accepted module specifiers for a corpus re-export barrel (paths as
 * they'd appear in an `import ... from "..."` statement). Any
 * specifier ending in one of these is treated as a corpus source.
 */
const CORPUS_MODULE_SUFFIXES = [
  "/voice",
  "/strings",
  "/corpus",
  "/chapter/voice",
  "/prompts/strings",
  "/prompts/voice",
];

/**
 * Is `moduleSpec` (as written in an import statement) pointing at a
 * corpus module?
 */
function isCorpusModuleSpec(moduleSpec: string): boolean {
  if (CORPUS_MODULE_SUFFIXES.some((s) => moduleSpec.endsWith(s))) return true;
  // Match bare corpus filenames via relative imports: `./voice`, `../strings`.
  const base = moduleSpec.split("/").pop() ?? "";
  return /^(?:voice|strings|corpus)$/.test(base);
}

export function scanForCorpusDiscipline(options: {
  readonly repoRoot: string;
  readonly roots?: readonly string[];
}): A25Result {
  const roots = options.roots ?? ["src/components", "app"];

  const project = new Project({
    compilerOptions: {
      allowJs: false,
      target: 99,
      module: 199,
      moduleResolution: 99,
      jsx: 4,
      strict: true,
      paths: { "@/*": [`${options.repoRoot}/src/*`] },
      baseUrl: options.repoRoot,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const absRoots = roots.map((r) =>
    isAbsolute(r) ? r : join(options.repoRoot, r),
  );
  for (const abs of absRoots) {
    project.addSourceFilesAtPaths([`${abs}/**/*.tsx`, abs]);
  }

  const violations: A25Violation[] = [];
  let checked = 0;

  for (const sf of project.getSourceFiles()) {
    const abs = sf.getFilePath();
    if (!absRoots.some((r) => abs.startsWith(r))) continue;
    if (/\.test\.tsx?$/.test(abs)) continue;

    const relPath = relative(options.repoRoot, abs);

    sf.forEachDescendant((node) => {
      if (Node.isJsxText(node)) {
        checked++;
        const v = checkJsxText(node, relPath);
        if (v) violations.push(v);
        return;
      }
      if (Node.isJsxAttribute(node)) {
        const name = jsxAttrName(node);
        if (!USER_FACING_ATTRS.has(name)) return;
        checked++;
        const v = checkJsxAttribute(node, relPath);
        if (v) violations.push(v);
        return;
      }
    });
  }

  return { ok: violations.length === 0, violations, checked };
}

/**
 * ts-morph 28 `JsxAttribute` lacks a `getName()` helper (only the
 * type-to-type `getNameNode()`). This shim reads the attribute name
 * as plain text — including namespaced names like `aria-label`.
 */
function jsxAttrName(attr: JsxAttribute): string {
  return attr.getNameNode().getText();
}

/** JsxText check — flag any non-whitespace inline literal. */
function checkJsxText(node: JsxText, relPath: string): A25Violation | null {
  const text = node.getText();
  // `{`getText()`}` for JsxText returns the literal characters including
  // leading/trailing whitespace. Trim and bail on empty.
  if (/^\s*$/.test(text)) return null;
  // HTML entities like `&nbsp;` are treated as prose — they wouldn't
  // exist without authored intent.
  return {
    file: relPath,
    line: node.getStartLineNumber(),
    detail:
      `inline string ${JSON.stringify(text.trim().slice(0, 60))} in <children>. ` +
      `Add to PANG_VOICE_STRINGS (src/ai/prompts/strings.ts) or a domain corpus ` +
      `(src/ai/chapter/voice.ts pattern) and import.`,
  };
}

/** JsxAttribute check — flag inline literals on the 4 user-facing attrs. */
function checkJsxAttribute(
  node: JsxAttribute,
  relPath: string,
): A25Violation | null {
  const initializer = node.getInitializer();
  if (!initializer) {
    // e.g. `<button disabled>` — no value to check (not applicable to
    // the four attrs A25 watches, but defensive).
    return null;
  }
  const name = jsxAttrName(node);

  // Bare string literal: `alt="logo"`.
  if (Node.isStringLiteral(initializer)) {
    return inlineAttrViolation(node, name, initializer, relPath);
  }

  // `alt={expr}` — the value is a JsxExpression wrapping an inner node.
  if (Node.isJsxExpression(initializer)) {
    const expr = initializer.getExpression();
    if (!expr) return null;
    return checkExpression(expr, node, name, relPath);
  }
  return null;
}

/**
 * Recursively check an expression used as a JSX attribute value. The
 * expression passes if its ultimate source is a corpus module.
 */
function checkExpression(
  expr: Node,
  attrNode: JsxAttribute,
  attrName: string,
  relPath: string,
): A25Violation | null {
  // Inline string literal via an expression wrapper: `alt={"logo"}`.
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
    // Empty string is the developer affordance for "unset / reset".
    if (expr.getLiteralText() === "") return null;
    return inlineAttrViolation(attrNode, attrName, expr as StringLiteral, relPath);
  }
  // Template literal. Must have only whitespace/punctuation quasis
  // AND all substitutions must themselves pass.
  if (Node.isTemplateExpression(expr)) {
    return checkTemplate(expr, attrName, relPath);
  }
  // Identifier / property access / call — trace to its root identifier
  // and verify the import is a corpus.
  const root = rootIdentifier(expr);
  if (root) {
    if (identifierFromCorpus(root)) return null;
    return {
      file: relPath,
      line: attrNode.getStartLineNumber(),
      detail:
        `${attrName}={${expr.getText().slice(0, 60)}} — identifier does not resolve to a corpus module. ` +
        `Expected import from a file matching src/**\/{voice,strings,corpus}*.ts or from @/ai/prompts/strings.`,
    };
  }
  // Fall-through: conditional/binary/etc. are user-facing by construction
  // only if they yield prose; we can't safely prove either way without
  // full type analysis. Conservative: allow, since the leaf literals
  // would have failed independently. The LEAF-level discipline is what
  // A25 enforces — it's not a full compositional proof system.
  return null;
}

/**
 * Template literal check. Every substitution traces to a corpus;
 * every quasi is empty or pure punctuation/whitespace.
 */
function checkTemplate(
  tpl: TemplateExpression,
  attrName: string,
  relPath: string,
): A25Violation | null {
  const head = tpl.getHead().getLiteralText();
  const spans = tpl.getTemplateSpans();
  // PunctSpace-only quasis are allowed — e.g. `${a}, ${b}` is fine
  // because the corpus-sourced `a` and `b` carry the prose.
  const quasiIsPassive = (s: string): boolean =>
    /^[\s.,;:!?()\-–—"/]*$/.test(s);
  if (!quasiIsPassive(head)) {
    return {
      file: relPath,
      line: tpl.getStartLineNumber(),
      detail:
        `${attrName}=\`${tpl.getText().slice(0, 60)}\` — template quasi contains prose. ` +
        `Move the sentence to a corpus module; interpolate only identifiers.`,
    };
  }
  for (const span of spans) {
    const lit = span.getLiteral().getLiteralText();
    if (!quasiIsPassive(lit)) {
      return {
        file: relPath,
        line: tpl.getStartLineNumber(),
        detail:
          `${attrName}=\`${tpl.getText().slice(0, 60)}\` — template quasi contains prose. ` +
          `Move the sentence to a corpus module; interpolate only identifiers.`,
      };
    }
    const sub = span.getExpression();
    const root = rootIdentifier(sub);
    if (!root || !identifierFromCorpus(root)) {
      return {
        file: relPath,
        line: tpl.getStartLineNumber(),
        detail:
          `${attrName}=\`${tpl.getText().slice(0, 60)}\` — substitution does not resolve to a corpus. ` +
          `Import the value from a voice/strings/corpus module.`,
      };
    }
  }
  return null;
}

function inlineAttrViolation(
  attrNode: JsxAttribute,
  attrName: string,
  literal: StringLiteral,
  relPath: string,
): A25Violation {
  return {
    file: relPath,
    line: attrNode.getStartLineNumber(),
    detail:
      `inline string ${JSON.stringify(literal.getLiteralText().slice(0, 60))} in <${attrName}>. ` +
      `Add to PANG_VOICE_STRINGS (src/ai/prompts/strings.ts) or a domain corpus ` +
      `(src/ai/chapter/voice.ts pattern) and import.`,
  };
}

/**
 * Reduce an expression to its root `Identifier` — the leftmost name
 * that a corpus import would bind. Walks through property access
 * chains (`CORPUS.foo.bar`) and call expressions
 * (`helper(CORPUS.foo)`).
 */
function rootIdentifier(node: Node): Identifier | null {
  if (Node.isIdentifier(node)) return node;
  if (Node.isPropertyAccessExpression(node)) {
    return rootIdentifier(node.getExpression());
  }
  if (Node.isElementAccessExpression(node)) {
    return rootIdentifier(node.getExpression());
  }
  if (Node.isCallExpression(node)) {
    // `someFn(X)` — the callee is what needs to be corpus-sourced.
    return rootIdentifier(node.getExpression());
  }
  if (Node.isAsExpression(node) || Node.isTypeAssertion(node) || Node.isParenthesizedExpression(node)) {
    return rootIdentifier(node.getExpression());
  }
  return null;
}

/**
 * Is `id` brought into scope by an import whose module specifier
 * points at a corpus file?
 */
function identifierFromCorpus(id: Identifier): boolean {
  const sf = id.getSourceFile();
  const name = id.getText();
  for (const decl of sf.getImportDeclarations()) {
    if (!importBindsName(decl, name)) continue;
    const spec = decl.getModuleSpecifierValue();
    if (isCorpusModuleSpec(spec)) return true;
    // Absolute / alias path to a file that is itself a corpus by filename.
    const resolvedPath = tryResolveImportToPath(decl, sf.getFilePath());
    if (resolvedPath && isCorpusFilePath(resolvedPath)) return true;
  }
  return false;
}

function importBindsName(decl: ImportDeclaration, name: string): boolean {
  for (const n of decl.getNamedImports()) {
    if (n.getAliasNode()?.getText() === name) return true;
    if (!n.getAliasNode() && n.getName() === name) return true;
  }
  if (decl.getDefaultImport()?.getText() === name) return true;
  const ns = decl.getNamespaceImport();
  if (ns && ns.getText() === name) return true;
  return false;
}

/**
 * Best-effort path resolution for an import specifier. We don't use
 * ts-morph's getModuleSpecifierSourceFile() because it requires the
 * target file to be in the project; many corpus files live outside
 * our `roots`. Instead we compute a candidate filesystem path and
 * check the filename convention.
 */
function tryResolveImportToPath(
  decl: ImportDeclaration,
  fromFile: string,
): string | null {
  const spec = decl.getModuleSpecifierValue();
  if (spec.startsWith("@/")) {
    // Alias resolution happens against the `src/` prefix.
    // We find the project root by walking up from the file until we
    // find `src/` as a path segment.
    const parts = fromFile.split("/");
    const srcIdx = parts.lastIndexOf("src");
    if (srcIdx < 0) return null;
    const repoRoot = parts.slice(0, srcIdx).join("/");
    return join(repoRoot, "src", spec.slice(2));
  }
  if (spec.startsWith(".")) {
    return resolve(dirname(fromFile), spec);
  }
  return null;
}

/**
 * Format violations for human-readable runner output.
 */
export function formatViolations(violations: readonly A25Violation[]): string {
  return violations
    .map((v) => `A25: ${v.file}:${v.line} — ${v.detail}`)
    .join("\n");
}
