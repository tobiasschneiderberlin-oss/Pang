/**
 * PANG — banned vocabulary tables.
 *
 * The hard list (`BANNED_VOCABULARY`) is enforced everywhere —
 * user-visible text, generated prose, button labels. The soft list
 * (`EVALUATIVE_VOCABULARY`) is enforced only in narrative contexts
 * (bio, blurb, description, commentary).
 *
 * This file is a compile-time import by `sanitize.ts` and by the
 * static `check-strings.ts` audit. Adding a term is a PR, not a
 * config change.
 *
 * See `PANG_Voice.md` § *Marketing phrasing* and § *Evaluative
 * language*.
 */

export const BANNED_VOCABULARY = [
  // Marketing register
  "awesome",
  "amazing",
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
  "love ",
  // First-person plural (doctrine exception: `you / your` at the
  // ownership moment — that's an OK override in strings)
  " we ",
  " our ",
  " us ",
  // Engagement language
  "don't miss",
  "we miss you",
  "check it out",
  // Emoji sentinels. We build these from codepoints so the ESLint
  // no-emojis rule doesn't trip on our own ban list (ironic, but the
  // rule scans the AST literal for the codepoint ranges).
  String.fromCodePoint(0x1f300), // cyclone — start of the misc-symbols block
  String.fromCodePoint(0x1f600), // grinning face — start of the emoticons block
  String.fromCodePoint(0x2b50), // star — symbols & pictographs
] as const;

export const EVALUATIVE_VOCABULARY = [
  "beautiful",
  "stunning",
  "striking",
  "vibrant",
  "masterful",
  "breathtaking",
  "iconic",
  "legendary",
  "powerful work",
  "moving piece",
] as const;
