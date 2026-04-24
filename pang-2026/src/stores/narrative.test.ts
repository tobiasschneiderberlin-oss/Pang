/**
 * PANG — narrative session slice tests (iter #14).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { useNarrative } from "./narrative";
import type { NarrativeCurrentResponse } from "@/narrative/schema";

const PARAGRAPH =
  "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them is a single Taeuber-Arp from 1935, the only work on paper in this collection. The provenance ledger for both names continues to grow year on year.";

function aprilReading(): NarrativeCurrentResponse {
  return {
    paragraph: PARAGRAPH,
    month: "2026-04",
    decidedAt: "2026-04-24T12:00:00.000Z",
    collectionHash: "hash-april-001",
  };
}

function mayReading(): NarrativeCurrentResponse {
  return {
    paragraph: PARAGRAPH.replace("Four", "Five"),
    month: "2026-05",
    decidedAt: "2026-05-03T10:00:00.000Z",
    collectionHash: "hash-may-001",
  };
}

beforeEach(() => {
  useNarrative.getState().clear();
});

describe("useNarrative — adoption", () => {
  it("starts hidden with no paragraph", () => {
    const s = useNarrative.getState();
    assert.equal(s.current, null);
    assert.equal(s.isVisible, false);
  });

  it("adopts a paragraph and becomes visible", () => {
    useNarrative.getState().setCurrent(aprilReading());
    const s = useNarrative.getState();
    assert.equal(s.current?.month, "2026-04");
    assert.equal(s.isVisible, true);
  });

  it("going back to null clears visibility", () => {
    useNarrative.getState().setCurrent(aprilReading());
    useNarrative.getState().setCurrent(null);
    const s = useNarrative.getState();
    assert.equal(s.current, null);
    assert.equal(s.isVisible, false);
  });
});

describe("useNarrative — dismiss", () => {
  it("hides the overlay and records the dismissed month", () => {
    useNarrative.getState().setCurrent(aprilReading());
    useNarrative.getState().dismiss();
    const s = useNarrative.getState();
    assert.equal(s.isVisible, false);
    assert.equal(s.dismissedMonth, "2026-04");
  });

  it("is a no-op when no paragraph is current", () => {
    useNarrative.getState().dismiss();
    const s = useNarrative.getState();
    assert.equal(s.dismissedMonth, null);
  });
});

describe("useNarrative — new month unhides", () => {
  it("a new month's reading re-shows even after April was dismissed", () => {
    useNarrative.getState().setCurrent(aprilReading());
    useNarrative.getState().dismiss();
    assert.equal(useNarrative.getState().isVisible, false);

    useNarrative.getState().setCurrent(mayReading());
    const s = useNarrative.getState();
    assert.equal(s.current?.month, "2026-05");
    assert.equal(s.isVisible, true);
  });

  it("readopting the same month does not un-dismiss", () => {
    useNarrative.getState().setCurrent(aprilReading());
    useNarrative.getState().dismiss();
    useNarrative.getState().setCurrent(aprilReading());
    assert.equal(useNarrative.getState().isVisible, false);
  });
});
