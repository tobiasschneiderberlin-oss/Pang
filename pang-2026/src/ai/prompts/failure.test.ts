/**
 * PANG — failure prose tests.
 *
 * Pure-function tests for the failure corpus + error mapping. These
 * lock down voice doctrine at the boundary: every `FailureKey`
 * resolves to a string, every string respects the four authoring
 * rules (sentence case, no emoji, no imperative, no vocab from the
 * banned list), and every DOMException name or HTTP status routes
 * to a sensible key.
 *
 * Run with `npm test` — `tsx --test` picks up any `*.test.ts` under
 * `src/`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  failureLine,
  keyFromCameraError,
  keyFromUploadStatus,
  type FailureKey,
} from "./failure";

// ---------- Voice doctrine: authoring rules ------------------------

/** Banned vocabulary from `PANG_Voice.md` § *Marketing phrasing* —
 *  every string in the corpus must be free of these.  */
const BANNED_VOCAB = [
  "dive",
  "unlock",
  "seamless",
  "leverage",
  "journey",
];

/** Every FailureKey that exists in the corpus — must stay in sync
 *  with the `FailureKey` union when it grows. */
const ALL_KEYS: readonly FailureKey[] = [
  "camera/denied",
  "camera/contested",
  "camera/unreadable",
  "camera/unsupported",
  "capture/no-frame",
  "capture/rejected",
  "upload/offline",
  "upload/timeout",
  "upload/rejected",
  "agent/unreachable",
  "agent/refused",
  "agent/empty",
  "unknown",
];

describe("failureLine: every key resolves to a non-empty string", () => {
  for (const key of ALL_KEYS) {
    it(`${key} returns a non-empty string`, () => {
      const line = failureLine(key);
      assert.equal(typeof line, "string");
      assert.ok(line.length > 0, `empty line for ${key}`);
    });
  }

  it("unknown string falls back to the catch-all line", () => {
    const fallback = failureLine("nonsense-key-does-not-exist");
    const canonical = failureLine("unknown");
    assert.equal(fallback, canonical);
  });
});

describe("voice doctrine: authoring rules across the corpus", () => {
  for (const key of ALL_KEYS) {
    it(`${key}: sentence case (starts uppercase, not ALL CAPS)`, () => {
      const line = failureLine(key);
      // First letter uppercase (or punctuation leading into it).
      const firstLetter = line.match(/[A-Za-z]/)?.[0] ?? "";
      assert.equal(
        firstLetter,
        firstLetter.toUpperCase(),
        `not sentence case: ${line}`,
      );
      // Not ALL CAPS. At least one lowercase letter present once
      // you peel off single-letter words.
      const lowerLetters = line.match(/[a-z]/g) ?? [];
      assert.ok(
        lowerLetters.length > 3,
        `ALL CAPS or near it: ${line}`,
      );
    });

    it(`${key}: no emoji`, () => {
      const line = failureLine(key);
      // U+1F300–U+1FAFF covers the bulk of emoji planes; symbols +
      // dingbats in BMP too.
      const emoji = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
      assert.ok(!emoji.test(line), `emoji in: ${line}`);
    });

    it(`${key}: no imperative retry language`, () => {
      const line = failureLine(key).toLowerCase();
      const imperatives = [
        "please ",
        "try again",
        "retry",
        "tap to ",
        "click to ",
      ];
      for (const bad of imperatives) {
        assert.ok(
          !line.includes(bad),
          `imperative "${bad}" found in: ${failureLine(key)}`,
        );
      }
    });

    it(`${key}: no marketing vocab`, () => {
      const line = failureLine(key).toLowerCase();
      for (const word of BANNED_VOCAB) {
        assert.ok(
          !line.includes(word),
          `banned word "${word}" in: ${failureLine(key)}`,
        );
      }
    });

    it(`${key}: at most one subordinate clause`, () => {
      // Proxy: at most two commas. A failure line with three+ commas
      // is a paragraph.
      const line = failureLine(key);
      const commas = (line.match(/,/g) ?? []).length;
      assert.ok(
        commas <= 2,
        `too many commas (${commas}) in: ${line}`,
      );
    });
  }
});

// ---------- Camera error routing ----------------------------------

describe("keyFromCameraError", () => {
  it("NotAllowedError → camera/denied", () => {
    const err = new DOMException("blocked by user", "NotAllowedError");
    assert.equal(keyFromCameraError(err), "camera/denied");
  });

  it("PermissionDeniedError → camera/denied", () => {
    const err = new DOMException("no perm", "PermissionDeniedError");
    assert.equal(keyFromCameraError(err), "camera/denied");
  });

  it("NotReadableError → camera/contested (device held by another app)", () => {
    const err = new DOMException("in use", "NotReadableError");
    assert.equal(keyFromCameraError(err), "camera/contested");
  });

  it("TrackStartError → camera/contested", () => {
    const err = new DOMException("couldn't start", "TrackStartError");
    assert.equal(keyFromCameraError(err), "camera/contested");
  });

  it("OverconstrainedError → camera/unsupported", () => {
    const err = new DOMException("no 8k camera", "OverconstrainedError");
    assert.equal(keyFromCameraError(err), "camera/unsupported");
  });

  it("ConstraintNotSatisfiedError → camera/unsupported", () => {
    const err = new DOMException("no match", "ConstraintNotSatisfiedError");
    assert.equal(keyFromCameraError(err), "camera/unsupported");
  });

  it("NotFoundError → camera/unsupported (no device at all)", () => {
    const err = new DOMException("no camera", "NotFoundError");
    assert.equal(keyFromCameraError(err), "camera/unsupported");
  });

  it("DevicesNotFoundError → camera/unsupported", () => {
    const err = new DOMException("none", "DevicesNotFoundError");
    assert.equal(keyFromCameraError(err), "camera/unsupported");
  });

  it("AbortError → camera/unreadable", () => {
    const err = new DOMException("aborted", "AbortError");
    assert.equal(keyFromCameraError(err), "camera/unreadable");
  });

  it("unclassified DOMException name → camera/unreadable", () => {
    const err = new DOMException("weird", "SomeNewDOMExceptionName");
    assert.equal(keyFromCameraError(err), "camera/unreadable");
  });

  it("non-DOMException Error → unknown", () => {
    const err = new Error("not a DOM error");
    assert.equal(keyFromCameraError(err), "unknown");
  });

  it("non-Error value → unknown", () => {
    assert.equal(keyFromCameraError("string error"), "unknown");
    assert.equal(keyFromCameraError(undefined), "unknown");
    assert.equal(keyFromCameraError(null), "unknown");
    assert.equal(keyFromCameraError({ message: "fake" }), "unknown");
  });
});

// ---------- Upload status routing ---------------------------------

describe("keyFromUploadStatus", () => {
  it("0 (network failure) → upload/offline", () => {
    assert.equal(keyFromUploadStatus(0), "upload/offline");
  });

  it("408 → upload/timeout", () => {
    assert.equal(keyFromUploadStatus(408), "upload/timeout");
  });

  it("504 → upload/timeout", () => {
    assert.equal(keyFromUploadStatus(504), "upload/timeout");
  });

  it("500 → agent/unreachable", () => {
    assert.equal(keyFromUploadStatus(500), "agent/unreachable");
  });

  it("502 → agent/unreachable", () => {
    assert.equal(keyFromUploadStatus(502), "agent/unreachable");
  });

  it("503 → agent/unreachable", () => {
    assert.equal(keyFromUploadStatus(503), "agent/unreachable");
  });

  it("422 → agent/refused (validation failed downstream)", () => {
    assert.equal(keyFromUploadStatus(422), "agent/refused");
  });

  it("400 → upload/rejected", () => {
    assert.equal(keyFromUploadStatus(400), "upload/rejected");
  });

  it("401 → upload/rejected", () => {
    assert.equal(keyFromUploadStatus(401), "upload/rejected");
  });

  it("413 → upload/rejected", () => {
    assert.equal(keyFromUploadStatus(413), "upload/rejected");
  });

  it("2xx shouldn't reach the mapper, but maps to unknown if it does", () => {
    assert.equal(keyFromUploadStatus(200), "unknown");
  });

  it("3xx maps to unknown (caller should follow the redirect, not show prose)", () => {
    assert.equal(keyFromUploadStatus(301), "unknown");
  });
});

// ---------- Sanity: mapping output is always a real key ----------

describe("mapping outputs are always real keys", () => {
  it("every camera-error mapping produces a keyed line", () => {
    const names = [
      "NotAllowedError",
      "PermissionDeniedError",
      "NotReadableError",
      "TrackStartError",
      "OverconstrainedError",
      "ConstraintNotSatisfiedError",
      "NotFoundError",
      "DevicesNotFoundError",
      "AbortError",
      "SomeUnknown",
    ];
    for (const name of names) {
      const err = new DOMException("x", name);
      const key = keyFromCameraError(err);
      assert.notEqual(failureLine(key), "");
    }
  });

  it("every plausible HTTP status produces a keyed line", () => {
    const statuses = [0, 400, 401, 404, 408, 413, 422, 500, 502, 503, 504];
    for (const s of statuses) {
      const key = keyFromUploadStatus(s);
      assert.notEqual(failureLine(key), "");
    }
  });
});
