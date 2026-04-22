/**
 * PANG — trust labels.
 *
 * Every piece of data the app handles carries a trust source. The
 * brand is a compiler-only phantom: it has no runtime weight, but
 * `tsc --noEmit` rejects any assignment that crosses sources without
 * going through `sanitize()`.
 *
 * See `PANG_AI_Era_2026.md` § 7c.
 *
 * Naming:
 *   'P'       — output of a privileged LLM call (orchestrator)
 *   'Q'       — output of a quarantined LLM call (reads untrusted
 *               document content)
 *   'user'    — direct user input (forms, clicks, passkey)
 *   'gallery' — the gallery's first-party feed (Artlogic, verified)
 *
 * A4 (voice discipline) lives one level above this file — it
 * assumes the trust source exists and adds a content-class tag on
 * top. This module is the type-theoretic floor.
 */

export type TrustSource = "P" | "Q" | "user" | "gallery";

declare const __pang_trust_brand: unique symbol;

/**
 * A value of type `T` that has been observed with trust source `S`.
 * The brand has no runtime footprint; strip it with `unbrand()` at
 * the single place where a primitive shape is needed.
 */
export type Trusted<T, S extends TrustSource> = T & {
  readonly [__pang_trust_brand]: S;
};

/** Legacy alias used at Q-LLM call sites for readability. */
export type Untrusted<T> = Trusted<T, "Q">;

/**
 * Internal side-table mapping values to sources. The brand alone is
 * phantom, so `assertCapability()` needs a runtime surface. We key on
 * the value reference via a WeakMap — it never outlives the value,
 * and plain primitives (string, number, boolean) cannot be branded
 * at runtime, so they must be wrapped in an object at the Q-LLM
 * extraction boundary.
 */
const sourceTable = new WeakMap<object, TrustSource>();

/**
 * Brand a value with a trust source. Only the security module calls
 * this directly — every other module goes through the agent
 * wrappers, `acceptUser()`, or `acceptGallery()`.
 */
export function brand<T extends object, S extends TrustSource>(
  value: T,
  source: S,
): Trusted<T, S> {
  sourceTable.set(value, source);
  return value as Trusted<T, S>;
}

/** Read the trust source of a branded value. */
export function trustSourceOf(value: object): TrustSource | null {
  return sourceTable.get(value) ?? null;
}

/**
 * Accept a value from a known-safe boundary. The two helpers below
 * are the only non-sanitize paths that produce `'user'` and
 * `'gallery'` brands at runtime.
 */
export function acceptUser<T extends object>(value: T): Trusted<T, "user"> {
  return brand(value, "user");
}
export function acceptGallery<T extends object>(
  value: T,
): Trusted<T, "gallery"> {
  return brand(value, "gallery");
}

/**
 * Thrown when an assertion fails. Carries the call-site name and the
 * attempted source so observability can correlate with the span.
 */
export class PANGTrustViolation extends Error {
  constructor(
    public readonly site: string,
    public readonly source: TrustSource | null,
    public readonly allowed: readonly TrustSource[],
  ) {
    super(
      `pang trust violation at "${site}": got source=${source ?? "unbranded"}, allowed=[${allowed.join(",")}]`,
    );
    this.name = "PANGTrustViolation";
  }
}
