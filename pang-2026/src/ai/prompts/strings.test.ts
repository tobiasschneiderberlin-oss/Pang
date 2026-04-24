/**
 * PANG_VOICE_STRINGS — unit tests.
 *
 * Tests the bundle's contract so a future contributor gets a loud
 * failure rather than a silent drift:
 *
 *   1. Every canonical-sample address resolves to a non-empty string.
 *   2. Every namespace inside the bundle is frozen (mutation throws
 *      in strict mode).
 *   3. The outer bundle is frozen.
 *   4. `resolveCanonical` throws a descriptive error when the address
 *      is malformed / unknown.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_SAMPLE_ADDRESSES,
  PANG_VOICE_STRINGS,
  resolveCanonical,
  type CanonicalSampleAddress,
} from "./strings";

test("every canonical sample address resolves to a non-empty string", () => {
  for (const address of CANONICAL_SAMPLE_ADDRESSES) {
    const value = resolveCanonical(address);
    assert.equal(typeof value, "string", `${address} is not a string`);
    assert.ok(value.length > 0, `${address} is empty`);
  }
});

test("canonical addresses cover the six doctrine slots exactly", () => {
  assert.deepEqual(
    [...CANONICAL_SAMPLE_ADDRESSES],
    [
      "invite.greeting",
      "ask_gallery.action",
      "outcome.confirmation",
      "push.offer",
      "dispatch.email_label",
      "arrival.placement",
    ],
    "doctrine change — extend the brief if the slot list moved",
  );
});

test("outer bundle is frozen", () => {
  assert.equal(Object.isFrozen(PANG_VOICE_STRINGS), true);
});

test("every namespace is frozen", () => {
  for (const [name, ns] of Object.entries(PANG_VOICE_STRINGS)) {
    assert.equal(
      Object.isFrozen(ns),
      true,
      `PANG_VOICE_STRINGS.${name} is not frozen`,
    );
  }
});

test("resolveCanonical throws for unknown namespace", () => {
  assert.throws(
    () => resolveCanonical("nope.greeting" as unknown as CanonicalSampleAddress),
    /canonical namespace "nope" missing/,
  );
});

test("resolveCanonical throws for unknown slot", () => {
  assert.throws(
    () =>
      resolveCanonical("invite.no-such-slot" as unknown as CanonicalSampleAddress),
    /canonical slot "invite.no-such-slot" missing/,
  );
});

test("ask_gallery.action matches the chapter voice corpus", () => {
  assert.equal(
    resolveCanonical("ask_gallery.action"),
    "ask my gallery",
  );
});
