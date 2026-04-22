/**
 * PANG — the single downgrade path.
 *
 * `sanitize()` is the *only* way to move a value from trust source
 * `'Q'` to any other source. A re-parse against a Zod schema is the
 * structural check; `runBannedVocabularyCheck()` is the voice check
 * (A5). Together they form the one allowed downgrade.
 *
 * If you find yourself wanting to cast across trust sources without
 * going through this module: you don't. The compiler will catch it,
 * and if it doesn't, the A8 grep gate will.
 */

import type { z } from "zod";
import {
  brand,
  PANGTrustViolation,
  trustSourceOf,
  type Trusted,
  type TrustSource,
} from "./trust";
import { BANNED_VOCABULARY, EVALUATIVE_VOCABULARY } from "./banned";

/**
 * Downgrade a `'Q'`-branded value to another trust source by
 * re-parsing it against a strict Zod schema and running the voice
 * check. The re-parse is the important half: Zod's `.parse()` throws
 * if the Q-LLM returned anything outside the declared shape,
 * including extra fields (we use `.strict()` schemas downstream).
 *
 * On success, the *parsed* value is re-branded. The original
 * `'Q'` reference is never returned — downstream consumers can
 * only obtain the sanitized copy.
 */
export function sanitize<T, To extends TrustSource>(
  input: Trusted<unknown, "Q">,
  schema: z.ZodType<T>,
  to: To,
): Trusted<T, To> {
  // Guard against calls from an un-Q-branded source. This is a
  // defensive check: TypeScript should already refuse.
  if (input === null || typeof input !== "object") {
    throw new PANGTrustViolation("sanitize", null, ["Q"]);
  }
  const source = trustSourceOf(input as object);
  if (source !== "Q") {
    throw new PANGTrustViolation("sanitize", source, ["Q"]);
  }

  const parsed = schema.parse(input);
  runBannedVocabularyCheck(parsed);

  // Wrap primitives in a single-field object so the brand table can
  // attach to the reference. In practice, agent return shapes are
  // always objects — this guard exists for symmetry with `brand()`.
  const target =
    parsed !== null && typeof parsed === "object"
      ? (parsed as object)
      : ({ value: parsed } as object);
  return brand(target, to) as Trusted<T, To>;
}

/**
 * Voice-register enforcement (A5). Applied after the Zod re-parse —
 * a value that mentions a banned term is rejected before it can
 * reach any P-LLM prompt or DOM surface.
 *
 * The ban list is two tiers:
 *   - `BANNED_VOCABULARY`   — hard failures (marketing + emoji)
 *   - `EVALUATIVE_VOCABULARY` — soft failures when the value sits
 *     in a narrative context (identified by `path`-style field
 *     names like `bio`, `blurb`, `commentary`).
 */
export function runBannedVocabularyCheck(value: unknown): void {
  for (const { path, text } of walkStrings(value)) {
    const lower = text.toLowerCase();
    for (const term of BANNED_VOCABULARY) {
      if (lower.includes(term)) {
        throw new VoiceViolation(path, term, text);
      }
    }
    if (isNarrativeField(path)) {
      for (const term of EVALUATIVE_VOCABULARY) {
        if (lower.includes(term)) {
          throw new VoiceViolation(path, term, text);
        }
      }
    }
  }
}

export class VoiceViolation extends Error {
  constructor(
    public readonly path: string,
    public readonly term: string,
    public readonly snippet: string,
  ) {
    super(
      `pang voice violation: term "${term}" in field "${path}" — "${snippet.slice(0, 80)}"`,
    );
    this.name = "VoiceViolation";
  }
}

function* walkStrings(
  value: unknown,
  path = "$",
): Iterable<{ path: string; text: string }> {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    yield { path, text: value };
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* walkStrings(value[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      yield* walkStrings(v, `${path}.${k}`);
    }
  }
}

const NARRATIVE_FIELDS = new Set([
  "bio",
  "blurb",
  "commentary",
  "description",
  "note",
  "caption",
  "summary",
  "narrative",
]);

function isNarrativeField(path: string): boolean {
  const last = path.split(".").pop() ?? "";
  return NARRATIVE_FIELDS.has(last.replace(/\[.*\]/, ""));
}
