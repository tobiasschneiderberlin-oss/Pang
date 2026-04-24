/**
 * PANG — chrome voice corpus tests (iter #15).
 *
 * Locks the SETTINGS_OVERLAY namespace against banned-vocabulary drift
 * and capitalisation drift. Sentence case (P14), no first-person
 * plural, no marketing register, no emojis. A25 default-pipeline's
 * banned list is the authority; this test keeps the SETTINGS_OVERLAY
 * authoring loud about any regression.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SETTINGS_OVERLAY } from "./voice";
import { BANNED_VOCABULARY } from "@/ai/camel/banned";

describe("SETTINGS_OVERLAY", () => {
  it("is frozen", () => {
    assert.equal(Object.isFrozen(SETTINGS_OVERLAY), true);
  });

  it("contains only strings (no empty, no whitespace-only)", () => {
    for (const [k, v] of Object.entries(SETTINGS_OVERLAY)) {
      assert.equal(typeof v, "string", `${k} is not a string`);
      assert.ok(v.trim().length > 0, `${k} is empty / whitespace-only`);
    }
  });

  it("has no banned-vocabulary hits anywhere in the namespace", () => {
    for (const [k, v] of Object.entries(SETTINGS_OVERLAY)) {
      const lower = ` ${v.toLowerCase()} `;
      for (const term of BANNED_VOCABULARY) {
        assert.ok(
          !lower.includes(term.toLowerCase()),
          `SETTINGS_OVERLAY.${k} contains banned term ${JSON.stringify(term)}`,
        );
      }
    }
  });

  it("stays in sentence case — no ALL-CAPS words longer than two letters", () => {
    // A test-only heuristic for ALL CAPS strings. "on" / "off" / the
    // close button are allowed short. A label like "DISMISS" would
    // trip the match.
    for (const [k, v] of Object.entries(SETTINGS_OVERLAY)) {
      const tokens = v.split(/\s+/);
      for (const t of tokens) {
        if (t.length < 3) continue;
        const isAllUpper = t.toUpperCase() === t && /[A-Z]/.test(t);
        assert.ok(
          !isAllUpper,
          `SETTINGS_OVERLAY.${k} contains ALL-CAPS token "${t}"`,
        );
      }
    }
  });

  it("carries the four toggle-state keys shipping code depends on", () => {
    // Removing / renaming any of these is a shipping breakage — the
    // SettingsOverlay component resolves each by name.
    assert.ok(typeof SETTINGS_OVERLAY.audioLabel === "string");
    assert.ok(typeof SETTINGS_OVERLAY.hapticsLabel === "string");
    assert.ok(typeof SETTINGS_OVERLAY.on === "string");
    assert.ok(typeof SETTINGS_OVERLAY.off === "string");
  });
});
