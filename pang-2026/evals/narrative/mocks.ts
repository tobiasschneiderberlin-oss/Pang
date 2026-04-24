/**
 * PANG — narrative eval mock responses (iter #14, A22).
 *
 * Canned `NarrativeOutput` per fixture. Used by `run.ts` when
 * `PANG_EVAL_MOCK=1`. The mocks represent *a correct agent run* —
 * sentence case, observational tone, no evaluative vocabulary, no
 * first-person. Running the eval in mock mode should pass; a failing
 * mock means the fixture contradicts the scorer (a self-test), not
 * that the model went wrong.
 *
 * Every paragraph lands inside [120, 600] chars per the schema band.
 * Every paragraph refers to the specific collection state (artists,
 * counts, gaps, provenance span) so the scorer's `mustMention` /
 * `mustNotContain` checks bite.
 */

import type { MockNarrativeResponse } from "./types";

export const MOCK_RESPONSES: Readonly<Record<string, MockNarrativeResponse>> = {
  "narrative-01-typical-eight-works": {
    paragraph:
      "eight works share the collection this month. four canvases by hojgaard span the 1970s into 1981; three rosetti etchings arrived as a plate sequence from 1965 to 1966; a single bernard gouache from 1958 sits alongside. provenance entries touch half of the hojgaards and one bernard, with acquisition dates running from 1962 to 1984.",
  },

  "narrative-02-minimal-three-works": {
    paragraph:
      "three works hang this month. two lund interiors, oslo 1988 and 1990, are paired with a voss graphite study from 1963. the lund paintings both carry acquisition provenance; the voss passed through the artist's widow before reaching the collection.",
  },

  "narrative-03-single-artist-null-fields": {
    paragraph:
      "four plates by anna meier anchor the collection this month. dates, mediums, and a catalogue are not recorded for the printmaker; one plate carries a private-acquisition entry without a year. the four titles read first, second, third, and fourth plate.",
  },

  "narrative-04-gap-laden-provenance": {
    paragraph:
      "six works sit together this month. three acrylic studies by okafor cover 2001 to 2003; three tanaka watercolours cover 1997 to 1999. provenance entries remain sparse across the collection — the okafor set carries one acquisition from the artist and the tanaka set carries one exhibition at a tokyo gallery.",
  },

  "narrative-05-adversarial-evaluative": {
    paragraph:
      "three oil paintings by harjit kaur anchor the collection this month. eastern light, western light, and summer field span 1984 to 1986 and were made in jalandhar. one acquisition entry, dated 1990, records the first of the three as coming directly from the artist's studio.",
  },
};
