/**
 * PANG — Correspondence schema tests.
 *
 * Locks the wire contract the `composeVerificationMessage` tool emits
 * and the placeholder rules the dispatch route relies on. No network,
 * no Anthropic — pure schema algebra.
 *
 * The schema is authoritative: a change here cascades into the JSON
 * tool schema (`@/ai/prompts/correspondence.ts`) and the agent runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIRM_PLACEHOLDER,
  CorrespondenceOutputSchema,
  DECLINE_PLACEHOLDER,
  checkPlaceholders,
} from "./correspondence.schema";
import { substitutePlaceholders } from "../ai/agents/correspondence";

describe("CorrespondenceOutputSchema", () => {
  const validBody = [
    "The collector is asking you to verify a work attributed to",
    "your gallery. Review the details and use one of the two links",
    "below to respond.",
    "",
    `Confirm: ${CONFIRM_PLACEHOLDER}`,
    `Decline: ${DECLINE_PLACEHOLDER}`,
  ].join("\n");

  it("accepts an email-channel output with subject + body", () => {
    const parsed = CorrespondenceOutputSchema.parse({
      subject: "Verification request — Richter, Kerze (1982)",
      body: validBody,
      bannedVocabularyDetected: false,
    });
    assert.equal(parsed.subject, "Verification request — Richter, Kerze (1982)");
    assert.equal(parsed.bannedVocabularyDetected, false);
  });

  it("accepts a whatsapp-channel output with null subject", () => {
    const parsed = CorrespondenceOutputSchema.parse({
      subject: null,
      body: validBody,
      bannedVocabularyDetected: false,
    });
    assert.equal(parsed.subject, null);
  });

  it("rejects body shorter than 60 chars", () => {
    assert.throws(() =>
      CorrespondenceOutputSchema.parse({
        subject: null,
        body: "too short",
        bannedVocabularyDetected: false,
      }),
    );
  });

  it("rejects body longer than 800 chars", () => {
    assert.throws(() =>
      CorrespondenceOutputSchema.parse({
        subject: null,
        body: "x".repeat(801),
        bannedVocabularyDetected: false,
      }),
    );
  });

  it("rejects subject longer than 80 chars", () => {
    assert.throws(() =>
      CorrespondenceOutputSchema.parse({
        subject: "x".repeat(81),
        body: validBody,
        bannedVocabularyDetected: false,
      }),
    );
  });

  it("rejects extra keys (strict object)", () => {
    assert.throws(() =>
      CorrespondenceOutputSchema.parse({
        subject: null,
        body: validBody,
        bannedVocabularyDetected: false,
        extra: "forbidden",
      }),
    );
  });

  it("requires bannedVocabularyDetected to be a boolean", () => {
    assert.throws(() =>
      CorrespondenceOutputSchema.parse({
        subject: null,
        body: validBody,
        bannedVocabularyDetected: "false",
      }),
    );
  });
});

describe("checkPlaceholders", () => {
  it("returns ok when both placeholders appear exactly once", () => {
    const body = `intro\nConfirm: ${CONFIRM_PLACEHOLDER}\nDecline: ${DECLINE_PLACEHOLDER}`;
    assert.deepEqual(checkPlaceholders(body), { ok: true });
  });

  it("flags missing confirm", () => {
    const body = `Decline: ${DECLINE_PLACEHOLDER}`;
    assert.deepEqual(checkPlaceholders(body), {
      ok: false,
      reason: "missing-confirm",
    });
  });

  it("flags missing decline", () => {
    const body = `Confirm: ${CONFIRM_PLACEHOLDER}`;
    assert.deepEqual(checkPlaceholders(body), {
      ok: false,
      reason: "missing-decline",
    });
  });

  it("flags duplicate confirm", () => {
    const body = `A: ${CONFIRM_PLACEHOLDER}\nB: ${CONFIRM_PLACEHOLDER}\nC: ${DECLINE_PLACEHOLDER}`;
    assert.deepEqual(checkPlaceholders(body), {
      ok: false,
      reason: "duplicate-confirm",
    });
  });

  it("flags duplicate decline", () => {
    const body = `A: ${CONFIRM_PLACEHOLDER}\nB: ${DECLINE_PLACEHOLDER}\nC: ${DECLINE_PLACEHOLDER}`;
    assert.deepEqual(checkPlaceholders(body), {
      ok: false,
      reason: "duplicate-decline",
    });
  });
});

describe("substitutePlaceholders", () => {
  const body = [
    "intro line",
    `Confirm: ${CONFIRM_PLACEHOLDER}`,
    `Decline: ${DECLINE_PLACEHOLDER}`,
    "closing line",
  ].join("\n");

  it("replaces both placeholders with signed URLs", () => {
    const out = substitutePlaceholders(
      body,
      "https://example.test/c/abc",
      "https://example.test/d/xyz",
    );
    assert.ok(out.includes("Confirm: https://example.test/c/abc"));
    assert.ok(out.includes("Decline: https://example.test/d/xyz"));
    assert.ok(!out.includes(CONFIRM_PLACEHOLDER));
    assert.ok(!out.includes(DECLINE_PLACEHOLDER));
  });

  it("is idempotent when placeholders are already substituted", () => {
    const once = substitutePlaceholders(
      body,
      "https://example.test/c/abc",
      "https://example.test/d/xyz",
    );
    const twice = substitutePlaceholders(
      once,
      "https://example.test/c/abc",
      "https://example.test/d/xyz",
    );
    assert.equal(twice, once);
  });

  it("leaves non-placeholder text untouched", () => {
    const out = substitutePlaceholders(
      body,
      "https://example.test/c/abc",
      "https://example.test/d/xyz",
    );
    assert.ok(out.startsWith("intro line\n"));
    assert.ok(out.endsWith("closing line"));
  });
});
