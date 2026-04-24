/**
 * PANG — correspondence eval mock responses.
 *
 * Canned `CorrespondenceOutput` per fixture. Used by `run.ts` when
 * `PANG_EVAL_MOCK=1`. The mocks represent *a correct agent run* —
 * sentence case, sober tone, placeholders exactly once, no marketing
 * vocabulary. Running the eval in mock mode should pass; a failing
 * mock means the fixture contradicts the scorer (a self-test), not
 * that the model went wrong.
 *
 * Every mock body holds the literal placeholders `{{CONFIRM_URL}}` and
 * `{{DECLINE_URL}}` exactly once each, per the agent's runtime check.
 */

import {
  CONFIRM_PLACEHOLDER,
  DECLINE_PLACEHOLDER,
} from "@/verification/correspondence.schema";
import type { MockCorrespondenceResponse } from "./types";

export const MOCK_RESPONSES: Readonly<
  Record<string, MockCorrespondenceResponse>
> = {
  "correspondence-01-email-nominal": {
    subject: "Verification request — Richter, Kerze (1982)",
    body: [
      "A collector has asked Galerie Droste to verify a work from their collection.",
      "",
      "The work is Gerhard Richter, Kerze, 1982 — oil on canvas, 95 × 90 cm.",
      "",
      `Confirm: ${CONFIRM_PLACEHOLDER}`,
      `Decline: ${DECLINE_PLACEHOLDER}`,
      "",
      "The links close after the first tap.",
    ].join("\n"),
    bannedVocabularyDetected: false,
  },

  "correspondence-02-whatsapp-null-subject": {
    subject: null,
    body: [
      "A collector has asked Museo Comunale d'Arte Moderna to verify a work.",
      "",
      "The work is Marianne Werefkin, Red Tree, 1910 — tempera on cardboard, 75.5 × 57 cm.",
      "",
      `Confirm: ${CONFIRM_PLACEHOLDER}`,
      `Decline: ${DECLINE_PLACEHOLDER}`,
    ].join("\n"),
    bannedVocabularyDetected: false,
  },

  "correspondence-03-missing-artist": {
    subject: "Verification request — Untitled (pendulum drawing), 1942",
    body: [
      "A collector has asked Aargauer Kunsthaus to verify a work from their collection.",
      "",
      "The work is Untitled (pendulum drawing), 1942 — pencil on graph paper, 120 × 80 cm.",
      "",
      `Confirm: ${CONFIRM_PLACEHOLDER}`,
      `Decline: ${DECLINE_PLACEHOLDER}`,
      "",
      "The links close after the first tap.",
    ].join("\n"),
    bannedVocabularyDetected: false,
  },

  "correspondence-04-banned-vocab-clean": {
    subject: "Verification request — Bourgeois, Spider (1996)",
    body: [
      "A collector has asked Cheim & Read to verify a work from their collection.",
      "",
      "The work is Louise Bourgeois, Spider, 1996 — bronze, 340 × 670 cm.",
      "",
      `Confirm: ${CONFIRM_PLACEHOLDER}`,
      `Decline: ${DECLINE_PLACEHOLDER}`,
    ].join("\n"),
    bannedVocabularyDetected: false,
  },

  "correspondence-05-body-length-band": {
    subject: "Verification request — Taeuber-Arp, Composition (1935)",
    body: [
      "A collector has asked Kunstmuseum Bern to verify a work.",
      "",
      "The work is Sophie Taeuber-Arp, Composition with Circles and Semicircles, 1935 — gouache and pencil on paper, 48.5 × 63 cm.",
      "",
      `Confirm: ${CONFIRM_PLACEHOLDER}`,
      `Decline: ${DECLINE_PLACEHOLDER}`,
      "",
      "The links close after the first tap.",
    ].join("\n"),
    bannedVocabularyDetected: false,
  },
};
