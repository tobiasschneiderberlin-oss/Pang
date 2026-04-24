/**
 * PANG — preferences defaults tests (iter #15, primitive 73).
 *
 * "silence-default" — `DEFAULT_PREFERENCES` is the single source of
 * truth for a cold install. Both iter #15 opt-ins must default
 * `"off"`, and the schema must reject anything outside the two-valued
 * enum. A regression here is a doctrine violation, not a bug.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFERENCES,
  PreferencesSchema,
} from "./preferences";

describe("silence-default (primitive 73)", () => {
  it("DEFAULT_PREFERENCES.audioSpatial is 'off' on cold install", () => {
    assert.equal(DEFAULT_PREFERENCES.audioSpatial, "off");
  });

  it("DEFAULT_PREFERENCES.haptics is 'off' on cold install", () => {
    assert.equal(DEFAULT_PREFERENCES.haptics, "off");
  });
});

describe("PreferencesSchema — new enum fields (iter #15)", () => {
  it("accepts audioSpatial='on' | 'off'", () => {
    assert.ok(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        audioSpatial: "on",
      }).success,
    );
    assert.ok(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        audioSpatial: "off",
      }).success,
    );
  });

  it("rejects audioSpatial with anything other than 'on' | 'off'", () => {
    assert.equal(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        audioSpatial: "maybe",
      }).success,
      false,
    );
    assert.equal(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        audioSpatial: true,
      }).success,
      false,
    );
  });

  it("accepts haptics='on' | 'off'", () => {
    assert.ok(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        haptics: "on",
      }).success,
    );
    assert.ok(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        haptics: "off",
      }).success,
    );
  });

  it("rejects haptics with anything other than 'on' | 'off'", () => {
    assert.equal(
      PreferencesSchema.safeParse({
        ...DEFAULT_PREFERENCES,
        haptics: "sometimes",
      }).success,
      false,
    );
  });
});
