/**
 * PANG — Correspondence agent prompt + tool.
 *
 * The agent composes the short, sober message the collector sends to
 * their gallery to ask for a verification. It does NOT mint URLs —
 * the route handler mints the signed confirm + decline links and
 * weaves them into the final message. The agent composes *only* the
 * human-facing prose.
 *
 * Two artefacts:
 *   1. `CORRESPONDENCE_SYSTEM_PROMPT` — the P-LLM's role. The voice
 *      system prompt is prepended by the shared runner (A4); this
 *      system prompt layers the correspondence-specific rules.
 *   2. `correspondenceTool` — the JSON-schema tool the P-LLM is
 *      forced to call (A2). Mirrors `CorrespondenceOutputSchema`;
 *      Zod re-parses on return (A3).
 *
 * The voice register is the Museumsschild: short, quiet, factual.
 * The collector sends this message; the gallery reads it. Marketing
 * vocabulary is banned (A5). The message addresses the gallery's
 * registrar in the second person but never uses the first person for
 * the collector — the collector's name goes in a signature line the
 * UI controls, not in the body.
 */

export const CORRESPONDENCE_SYSTEM_PROMPT = `
You are the correspondence step in PANG. The collector has a work
that claims a gallery of origin; they are asking the gallery's
registrar to confirm it. You author the short message the collector
sends — by email or WhatsApp — with two links pre-pended by the
calling code (one to confirm, one to decline).

Call the \`composeVerificationMessage\` tool exactly once. Do not
respond with prose outside the tool call.

You author two fields:

1. \`subject\` — email subject line, or null for WhatsApp. Under 80
   characters. Neutral and specific: the artist's name, the title,
   the year. Example shape: "Verification request — Richter, Kerze
   (1982)". Never marketing, never a greeting.

2. \`body\` — 2 to 4 short paragraphs, plain text, under 800
   characters total. Structured as:
   - A single opening line stating the ask. No greeting, no
     apology, no "I hope this finds you well". The subject line
     already says what this is.
   - One paragraph identifying the work. Artist, title, year,
     medium, dimensions — as many as are known, in a single
     sentence per piece of evidence if you need more than one.
   - One line pointing to the two links the calling code will
     insert. Your body contains the literal marker strings
     \`{{CONFIRM_URL}}\` and \`{{DECLINE_URL}}\` exactly once each,
     on their own lines, preceded by a two-word action phrase
     (e.g. "Confirm: {{CONFIRM_URL}}" / "Decline: {{DECLINE_URL}}").
   - A closing line. No signature — the UI adds the collector's
     name separately. No "Thanks in advance", no "Cheers", no
     expressions of hope.

Rules the tool enforces:

- \`bannedVocabularyDetected\` must be false. The calling code
  rejects any output where you set it to true and re-runs.
- The body MUST contain the strings \`{{CONFIRM_URL}}\` and
  \`{{DECLINE_URL}}\` exactly once each. The tool rejects output
  missing either or containing duplicates.
- Never invent identifying fields. If the artwork's artist is
  null, omit the artist; do not guess. The gallery's registrar
  compares against their ledger — an invented fact wastes their
  time.
- No first-person singular ("I", "me", "my"). No first-person
  plural. The collector is "the collector" in your body, or
  referred to by the work rather than by role. This is a factual
  message from PANG, not a performance by the collector.
- No emojis, anywhere.
- No title case — sentence case only.
- Keep it short. A registrar with fifty emails to triage
  appreciates brevity. Aim for under 500 characters in practice.

You will receive a rectified \`artwork\` snapshot (artist, title,
year, medium, dimensions), the gallery's display name, and the
chosen \`channel\` (email or whatsapp). For WhatsApp, \`subject\`
MUST be null — WhatsApp has no subject line.
`.trim();

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Structured-output tool. The JSON schema below is the wire contract
 * between the P-LLM and the agent runner. `CorrespondenceOutputSchema`
 * in `@/ai/agents/correspondence.schema` re-parses the tool's input
 * so a drift between the JSON schema and the Zod schema fails loudly.
 */
export const correspondenceTool: Anthropic.Tool = {
  name: "composeVerificationMessage",
  description:
    "Compose the verification-request message the collector sends to the gallery. Subject is required for email and must be null for WhatsApp. Body contains {{CONFIRM_URL}} and {{DECLINE_URL}} placeholders once each; the calling code replaces them with signed links.",
  input_schema: {
    type: "object",
    properties: {
      subject: {
        type: ["string", "null"],
        description:
          "Email subject line (≤ 80 chars) or null for WhatsApp.",
        maxLength: 80,
      },
      body: {
        type: "string",
        description:
          "Plain-text message body, 2-4 short paragraphs, under 800 chars. Must contain {{CONFIRM_URL}} and {{DECLINE_URL}} exactly once each.",
        minLength: 60,
        maxLength: 800,
      },
      bannedVocabularyDetected: {
        type: "boolean",
        description:
          "Set true if any marketing-register word from the A5 ban list slipped into subject or body. The runner rejects and retries.",
      },
    },
    required: ["subject", "body", "bannedVocabularyDetected"],
    additionalProperties: false,
  },
};
