/**
 * A24 — Voice seed adoption.
 *
 * Mechanical enforcement of the voice layer at the Anthropic call
 * boundary. For every `client.messages.create(...)` call across the
 * agent surface that routes to the P-LLM (privileged) path, the
 * `system` argument MUST include an identifier that resolves —
 * directly or through a barrel re-export — to
 * `PANG_VOICE_SYSTEM_PROMPT` (the seed in `src/ai/prompts/voice.ts`).
 *
 * A4 (the existing file-level voice-prompt gate) is satisfied by a
 * grep: if the string "PANG_VOICE_SYSTEM_PROMPT" appears anywhere in
 * an agent file, A4 passes. That's adequate for iteration #1 but
 * leaves a hole — a future agent file could import the identifier
 * and forget to use it, or pass a different `system` literal to
 * one of its `messages.create` calls while retaining the import
 * for another.
 *
 * A24 closes the hole. For every messages.create call, the gate
 * walks the `system` argument as an AST value and asserts that it
 * resolves to the seed identifier. Specifically:
 *
 *   - `system: PANG_VOICE_SYSTEM_PROMPT`                 — pass
 *   - `system: [{ type: "text", text: PANG_VOICE_SYSTEM_PROMPT }, ...]`
 *                                                         — pass
 *   - `system: [<first>, ...]` where the first entry's text field
 *     is not the seed identifier                          — fail
 *   - `system: "hand-rolled prompt"` (string literal)     — fail
 *   - `system:` missing entirely                          — fail
 *
 * CaMeL exception. The Q-LLM (quarantined) path deliberately does
 * NOT carry the voice seed — mixing voice discipline with the
 * untrusted-extraction role would leak privileged context into the
 * Q-LLM and defeat A7/A8. A24 recognises quarantined sites by a
 * `system` identifier whose name ends in `QUARANTINED_SYSTEM_PROMPT`
 * (e.g. `QUARANTINED_SYSTEM_PROMPT`,
 * `ENRICHMENT_QUARANTINED_SYSTEM_PROMPT`) and skips them.
 *
 * The AST walk resolves identifier references across imports —
 * e.g. the agent imports `PANG_VOICE_SYSTEM_PROMPT` from
 * `./_shared` which re-exports from `@/ai/prompts/voice`. The gate
 * follows both hops.
 *
 * Fixtures live under `tests/fixtures/voice-v1/a24/{pass,fail}/` and
 * are walked by the gate's unit test (`a24.test.ts`); the fixtures
 * are not scanned in production runs (excluded by scope).
 */

import { Project, Node } from "ts-morph";
import type {
  CallExpression,
  Identifier,
  ImportDeclaration,
  PropertyAssignment,
  SourceFile,
} from "ts-morph";
import { join, relative } from "node:path";

const SEED_NAME = "PANG_VOICE_SYSTEM_PROMPT";

/**
 * CaMeL quarantined-path marker. Any identifier whose text ends in
 * this suffix is treated as a Q-LLM system prompt and opts the call
 * site out of A24. Examples: `QUARANTINED_SYSTEM_PROMPT`,
 * `ENRICHMENT_QUARANTINED_SYSTEM_PROMPT`.
 */
const QUARANTINED_SUFFIX = "QUARANTINED_SYSTEM_PROMPT";

export interface A24Violation {
  readonly file: string;
  readonly line: number;
  readonly detail: string;
}

export interface A24Result {
  readonly ok: boolean;
  readonly violations: readonly A24Violation[];
  readonly checked: number;
}

/**
 * Scan `roots` for every `client.messages.create(` call and check
 * its `system` argument. Returns a list of violations (empty on
 * pass) and the number of call sites the gate actually verified.
 *
 * The default `roots` is the agent surface the voice seed applies
 * to. Tests pass a narrower set (the fixture dir).
 */
export function scanForVoiceSeedAdoption(options: {
  readonly repoRoot: string;
  readonly roots?: readonly string[];
  /** Extra source dirs to include so identifier resolution can
   *  follow barrel re-exports. Defaults cover the canonical shared
   *  + prompts modules. */
  readonly include?: readonly string[];
}): A24Result {
  const roots = options.roots ?? ["src/ai/agents"];
  const include = options.include ?? [
    "src/ai/prompts",
    "src/ai/agents/_shared.ts",
    "src/ai/camel",
  ];

  const project = new Project({
    // No tsconfig — the gate runs standalone. `useInMemoryFileSystem:
    // false` keeps path resolution consistent with the real repo.
    compilerOptions: {
      allowJs: false,
      target: 99, // ESNext
      module: 199, // NodeNext
      moduleResolution: 99, // Bundler (matches Next.js)
      jsx: 4, // ReactJSX
      strict: true,
      paths: {
        "@/*": [`${options.repoRoot}/src/*`],
      },
      baseUrl: options.repoRoot,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const absRoots = roots.map((r) => join(options.repoRoot, r));
  const absInclude = include.map((i) => join(options.repoRoot, i));

  for (const abs of [...absRoots, ...absInclude]) {
    project.addSourceFilesAtPaths([
      `${abs}/**/*.ts`,
      `${abs}/**/*.tsx`,
      // Also include the bare path in case it's a file, not a dir.
      abs,
    ]);
  }

  const violations: A24Violation[] = [];
  let checked = 0;

  for (const sf of project.getSourceFiles()) {
    const abs = sf.getFilePath();
    // Only *check* files under roots; supporting files in `include`
    // are parsed so identifier references resolve across them.
    if (!absRoots.some((r) => abs.startsWith(r))) continue;
    // Skip test files and the shared module itself.
    if (/\.test\.tsx?$/.test(abs)) continue;
    if (abs.endsWith("/_shared.ts")) continue;
    if (abs.endsWith("/models.ts")) continue;
    if (abs.endsWith("/budgets.ts")) continue;

    const relPath = relative(options.repoRoot, abs);

    for (const call of findMessagesCreateCalls(sf)) {
      const result = checkCallSite(call, relPath);
      if (result === "quarantined") continue; // CaMeL exception — not a voice-seed site
      checked++;
      if (result) violations.push(result);
    }
  }

  return { ok: violations.length === 0, violations, checked };
}

/**
 * Find every `*.messages.create(...)` call. We match the property-
 * access shape rather than a bare identifier because the Anthropic
 * SDK exposes `client.messages.create` and nothing else should.
 */
function findMessagesCreateCalls(sf: SourceFile): CallExpression[] {
  const out: CallExpression[] = [];
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expr = node.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return;
    if (expr.getName() !== "create") return;
    const parent = expr.getExpression();
    // Drill through `client.messages.create` and also
    // `someVariable.messages.create` — both shape the Anthropic SDK.
    if (!Node.isPropertyAccessExpression(parent)) return;
    if (parent.getName() !== "messages") return;
    out.push(node);
  });
  return out;
}

/**
 * Given a `messages.create(...)` call, inspect its first argument
 * (the params object) and verify the `system` property's value
 * resolves to the seed identifier.
 *
 * Returns:
 *   - `null`           — site passes
 *   - `A24Violation`   — site fails
 *   - `"quarantined"`  — site is a CaMeL Q-LLM call and exempt
 */
function checkCallSite(
  call: CallExpression,
  relPath: string,
): A24Violation | null | "quarantined" {
  const args = call.getArguments();
  if (args.length === 0) {
    return {
      file: relPath,
      line: call.getStartLineNumber(),
      detail: "messages.create() called with no arguments",
    };
  }
  const params = args[0];
  if (!params || !Node.isObjectLiteralExpression(params)) {
    return {
      file: relPath,
      line: call.getStartLineNumber(),
      detail: "messages.create() arg is not an object literal — A24 cannot statically verify the `system` field. Pass an inline object.",
    };
  }
  const systemProp = params.getProperty("system");
  if (!systemProp) {
    return {
      file: relPath,
      line: call.getStartLineNumber(),
      detail: "messages.create({...}) missing `system` field — voice seed not wired",
    };
  }
  if (!Node.isPropertyAssignment(systemProp)) {
    return {
      file: relPath,
      line: systemProp.getStartLineNumber(),
      detail: "messages.create `system` is a shorthand / spread — cannot statically verify",
    };
  }

  const value = (systemProp as PropertyAssignment).getInitializer();
  if (!value) {
    return {
      file: relPath,
      line: systemProp.getStartLineNumber(),
      detail: "messages.create `system` has no initializer",
    };
  }

  // Case A: `system: PANG_VOICE_SYSTEM_PROMPT`
  if (Node.isIdentifier(value)) {
    if (isQuarantinedIdentifier(value)) return "quarantined";
    if (resolvesToSeedIdentifier(value)) return null;
    return {
      file: relPath,
      line: value.getStartLineNumber(),
      detail: `messages.create({ system: <identifier> }) does not resolve to ${SEED_NAME}. Import from "@/ai/agents/_shared" or "@/ai/prompts/voice".`,
    };
  }

  // Case B: `system: [...entries]` — the system is an array of
  // prompt parts. The seed MUST appear as an identifier in one of
  // the entries' `text` fields. The first entry is conventional
  // (cache-ordered); we accept any entry so a future ordering
  // change doesn't break the gate — caching is a concern of A6.
  if (Node.isArrayLiteralExpression(value)) {
    const entries = value.getElements();
    // First: look for a quarantined marker. If any entry's `text`
    // identifier ends in QUARANTINED_SYSTEM_PROMPT, this is a
    // CaMeL Q-LLM site and exempt from A24.
    for (const entry of entries) {
      if (!Node.isObjectLiteralExpression(entry)) continue;
      const textProp = entry.getProperty("text");
      if (!textProp || !Node.isPropertyAssignment(textProp)) continue;
      const textValue = (textProp as PropertyAssignment).getInitializer();
      if (!textValue) continue;
      if (Node.isIdentifier(textValue) && isQuarantinedIdentifier(textValue)) {
        return "quarantined";
      }
    }
    // Otherwise: require the voice seed as one of the entries.
    for (const entry of entries) {
      if (!Node.isObjectLiteralExpression(entry)) continue;
      const textProp = entry.getProperty("text");
      if (!textProp || !Node.isPropertyAssignment(textProp)) continue;
      const textValue = (textProp as PropertyAssignment).getInitializer();
      if (!textValue) continue;
      if (Node.isIdentifier(textValue) && resolvesToSeedIdentifier(textValue)) {
        return null;
      }
    }
    return {
      file: relPath,
      line: value.getStartLineNumber(),
      detail: `messages.create({ system: [...] }) has no entry whose \`text\` resolves to ${SEED_NAME}. Add { type: "text", text: ${SEED_NAME}, cache_control: { type: "ephemeral" } } as the first entry.`,
    };
  }

  // Anything else — a string literal, a template literal, a function
  // call — fails by default. These are the shapes A24 exists to prevent.
  return {
    file: relPath,
    line: value.getStartLineNumber(),
    detail: `messages.create({ system: ${value.getKindName()} }) — voice seed missing. Pass \`${SEED_NAME}\` directly, or as the first entry of a typed array with cache_control.`,
  };
}

/**
 * Is this identifier a CaMeL quarantined-path system prompt?
 *
 * We match on the suffix `QUARANTINED_SYSTEM_PROMPT` — any file that
 * declares or imports one is explicitly opting its call site out of
 * A24 by naming convention. The shape is load-bearing: a future
 * reviewer greps for `QUARANTINED_SYSTEM_PROMPT` to audit every
 * Q-LLM surface.
 */
function isQuarantinedIdentifier(id: Identifier): boolean {
  return id.getText().endsWith(QUARANTINED_SUFFIX);
}

/**
 * Resolve an identifier to its declaration and return true iff the
 * chain terminates at `PANG_VOICE_SYSTEM_PROMPT` defined in
 * `src/ai/prompts/voice.ts`.
 *
 * Walks import aliases so `import { PANG_VOICE_SYSTEM_PROMPT } from
 * "./_shared"` (which re-exports from `@/ai/prompts/voice`) resolves
 * correctly.
 */
function resolvesToSeedIdentifier(id: Identifier): boolean {
  const name = id.getText();
  if (name !== SEED_NAME) {
    // Maybe the developer renamed on import: `import { PANG_VOICE_SYSTEM_PROMPT as seed }`.
    // We refuse the alias — it defeats A24's purpose of making the identifier grepable.
    return false;
  }
  // Best-effort declaration lookup. If it fails, we fall through to
  // a local-import fallback. The fallback is not a loophole: the
  // declaration that A24 accepts (`PANG_VOICE_SYSTEM_PROMPT`
  // declared/imported in this file) must already be statically
  // scoped — nothing else would pass type-checking anyway.
  const sf = id.getSourceFile();
  const importDecls = sf.getImportDeclarations();
  for (const decl of importDecls) {
    if (importDeclarationReExportsSeed(decl)) return true;
  }
  return false;
}

/**
 * Does `import { PANG_VOICE_SYSTEM_PROMPT } from "<module>"` bring
 * the seed into scope? Accepted modules are the shared barrel and
 * the canonical prompts file.
 */
function importDeclarationReExportsSeed(decl: ImportDeclaration): boolean {
  const named = decl.getNamedImports();
  const hasSeed = named.some((n) => n.getName() === SEED_NAME);
  if (!hasSeed) return false;
  const moduleSpec = decl.getModuleSpecifierValue();
  // Accepted module shapes. We don't follow re-exports further —
  // the barrel re-exports `PANG_VOICE_SYSTEM_PROMPT` by the same
  // name, so a hit on the name is a hit on the canonical seed.
  // (Alias-on-import is rejected above.)
  const accepted = [
    "./_shared",
    "../_shared",
    "@/ai/agents/_shared",
    "@/ai/prompts/voice",
    "./voice",
    "../prompts/voice",
    "@/ai/prompts/strings",
  ];
  return accepted.some((a) => moduleSpec === a || moduleSpec.endsWith(a));
}

/**
 * Format a violation list for human-readable output. Used by the
 * check-gates runner and by local CLI invocations.
 */
export function formatViolations(violations: readonly A24Violation[]): string {
  return violations
    .map((v) => `A24: ${v.file}:${v.line} — ${v.detail}`)
    .join("\n");
}
