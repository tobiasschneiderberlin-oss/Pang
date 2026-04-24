/**
 * PANG — correspondence eval fixtures registry.
 *
 * Five fixtures, each exercising a dimension the agent has to honour:
 *
 *   01  email-nominal          — rich artwork metadata + email channel.
 *                                  Subject present, body mentions the
 *                                  artist + title + gallery, both
 *                                  placeholders exactly once.
 *   02  whatsapp-null-subject  — channel rule enforcement. Subject must
 *                                  be null; body carries the links.
 *   03  missing-artist         — artwork.artist is null. The agent must
 *                                  elide the artist cleanly, not invent
 *                                  one and not emit scaffold text.
 *   04  banned-vocab           — all fields present, but the scorer
 *                                  asserts the agent produced no marketing
 *                                  register in subject or body
 *                                  (A5). Also the self-flag is false.
 *   05  body-length-band       — the voice doctrine prefers brevity
 *                                  (under 500 chars in practice); this
 *                                  fixture asserts the body lands in
 *                                  [120, 800].
 *
 * Adding a fixture = one entry here + one canned mock response in
 * `mocks.ts`. The scorer is fixture-agnostic.
 */

import type { CorrespondenceFixture } from "./types";

export const FIXTURES: readonly CorrespondenceFixture[] = [
  // ---- correspondence-01 ----------------------------------------
  {
    id: "correspondence-01-email-nominal",
    description:
      "Known work, rich metadata, email channel. Subject + body both populated.",
    artwork: {
      artist: "Gerhard Richter",
      title: "Kerze",
      year: 1982,
      medium: "oil on canvas",
      dimensionsCm: { h: 95, w: 90 },
    },
    galleryDisplayName: "Galerie Droste",
    channel: "email",
    expected: {
      subjectShape: "non-null",
      subjectMustMention: ["Richter"],
      bodyMustMention: ["Kerze", "Galerie Droste"],
      placeholdersOncePerKind: true,
      bannedVocabularyFlagFalse: true,
      runBannedCheck: true,
    },
  },

  // ---- correspondence-02 ----------------------------------------
  {
    id: "correspondence-02-whatsapp-null-subject",
    description:
      "WhatsApp channel forces subject=null; body still carries the two signed-link placeholders.",
    artwork: {
      artist: "Marianne Werefkin",
      title: "Red Tree",
      year: 1910,
      medium: "tempera on cardboard",
      dimensionsCm: { h: 75.5, w: 57 },
    },
    galleryDisplayName: "Museo Comunale d'Arte Moderna",
    channel: "whatsapp",
    expected: {
      subjectShape: "null",
      bodyMustMention: ["Werefkin", "Red Tree"],
      placeholdersOncePerKind: true,
      bannedVocabularyFlagFalse: true,
      runBannedCheck: true,
    },
  },

  // ---- correspondence-03 ----------------------------------------
  {
    id: "correspondence-03-missing-artist",
    description:
      "Artist is null. The agent must NOT invent an artist name and must NOT leave scaffold text like 'unknown' or a null-marker in the body.",
    artwork: {
      artist: null,
      title: "Untitled (pendulum drawing)",
      year: 1942,
      medium: "pencil on graph paper",
      dimensionsCm: { h: 120, w: 80 },
    },
    galleryDisplayName: "Aargauer Kunsthaus",
    channel: "email",
    expected: {
      subjectShape: "non-null",
      subjectMustMention: ["Untitled"],
      bodyMustMention: ["Aargauer Kunsthaus"],
      bodyMustNotContain: [
        "unknown artist",
        "null",
        "undefined",
        "n/a",
        "name pending",
      ],
      placeholdersOncePerKind: true,
      bannedVocabularyFlagFalse: true,
      runBannedCheck: true,
    },
  },

  // ---- correspondence-04 ----------------------------------------
  {
    id: "correspondence-04-banned-vocab-clean",
    description:
      "Full metadata. Asserts neither subject nor body contains any A5-banned marketing vocabulary, and the self-flag is false.",
    artwork: {
      artist: "Louise Bourgeois",
      title: "Spider",
      year: 1996,
      medium: "bronze",
      dimensionsCm: { h: 340, w: 670 },
    },
    galleryDisplayName: "Cheim & Read",
    channel: "email",
    expected: {
      subjectShape: "non-null",
      subjectMustMention: ["Bourgeois", "Spider"],
      bodyMustMention: ["Cheim & Read"],
      placeholdersOncePerKind: true,
      bannedVocabularyFlagFalse: true,
      runBannedCheck: true,
    },
  },

  // ---- correspondence-05 ----------------------------------------
  {
    id: "correspondence-05-body-length-band",
    description:
      "Body must land in [120, 800] — brevity is a voice invariant. Rich metadata on purpose to tempt a long paragraph.",
    artwork: {
      artist: "Sophie Taeuber-Arp",
      title: "Composition with Circles and Semicircles",
      year: 1935,
      medium: "gouache and pencil on paper",
      dimensionsCm: { h: 48.5, w: 63 },
    },
    galleryDisplayName: "Kunstmuseum Bern",
    channel: "email",
    expected: {
      subjectShape: "non-null",
      subjectMustMention: ["Taeuber-Arp"],
      bodyMustMention: ["Kunstmuseum Bern"],
      placeholdersOncePerKind: true,
      bannedVocabularyFlagFalse: true,
      runBannedCheck: true,
      bodyLengthBand: { min: 120, max: 800 },
    },
  },
];
