/**
 * PANG — intake surface voice corpus.
 *
 * Curated strings rendered by the intake review + scan chrome. Every
 * literal passes the Museumsschild test: observational, sentence case,
 * no marketing, no emoji, no evaluative language.
 *
 * Why its own file (not absorbed into `src/ai/chapter/voice.ts`):
 * intake is a *pre-chapter* surface — the review screen Laura lands on
 * after the viewfinder fires, before the arrival ceremony. It shares
 * the Museumsschild register with the chapter corpus but occupies its
 * own domain (P-LLM output lands here, not chapter choreography).
 *
 * Doctrine link: `PANG_Voice.md` § *Failure prose* establishes the
 * register; this corpus follows the same authoring rules.
 */

/**
 * Landmark label for the intake review `<main>`. Sentence case,
 * lowercase — the page is not a proper noun.
 */
export const INTAKE_REVIEW_LABEL = "intake review";

/**
 * The subtitle above the P-LLM's arrival line. Three words; acts as a
 * quiet tag rather than a header.
 */
export const INTAKE_HEADER_SUBTITLE = "the work";

/**
 * Primary affordance labels. Each slot serves both the visible button
 * text AND its `aria-label` — they read identically, because the text
 * IS the accessibility contract.
 */
export const INTAKE_RESHOOT = Object.freeze({
  label: "reshoot",
  action: "reshoot",
}) satisfies Readonly<Record<"label" | "action", string>>;

export const INTAKE_ADD_TO_WALL = Object.freeze({
  label: "add to wall",
  action: "add to wall",
}) satisfies Readonly<Record<"label" | "action", string>>;

/**
 * Year-row-specific slots (the year field is not a free-text `FieldRow`;
 * it has its own numeric input + edit pathway).
 */
export const INTAKE_YEAR_LABEL = "year";
export const INTAKE_EDIT_YEAR_LABEL = "edit year";

/**
 * Field-edit a11y label helper. The viewing mode button for a given
 * editable field announces "edit ${label}" to assistive tech. The
 * substitution lives here so A25 is satisfied: the template quasi
 * ("edit ") is corpus-sourced, the interpolation is a corpus value.
 *
 * Callers pass a `FIELD_LABELS` slot (see below); runtime composition
 * yields the final string.
 */
export const editLabelFor = (label: string): string => `edit ${label}`;

/**
 * Field labels used inside the intake review grid. The keys are the
 * underlying artwork field names; the values are the human-facing
 * labels (sentence case; identical to the keys here because the
 * schema already reads as wall text). Keeping them in corpus makes
 * renaming a single-edit change.
 */
export const FIELD_LABELS = Object.freeze({
  artist: "artist",
  title: "title",
  medium: "medium",
  year: "year",
}) satisfies Readonly<Record<"artist" | "title" | "medium" | "year", string>>;

/**
 * `<Diff>` primitive a11y labels. The strikethrough previous value and
 * the new value each earn their own screen-reader landmark.
 */
export const DIFF_LABELS = Object.freeze({
  previous: "previous value",
  current: "current value",
}) satisfies Readonly<Record<"previous" | "current", string>>;

/**
 * `/scan` stage-transition chrome. The upload phase shows a single
 * word ("reading") as both the aria-label and the visible text; the
 * failure phase shows "failed" as the landmark and the reshoot
 * affordance below it. Both read as wall text.
 */
export const SCAN_STAGE = Object.freeze({
  reading_label: "reading",
  reading_text: "reading",
  failed_label: "failed",
  failed_reshoot: "reshoot",
}) satisfies Readonly<Record<string, string>>;
