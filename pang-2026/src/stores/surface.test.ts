/**
 * PANG — active-surface store tests (iter #11).
 *
 * Locks the invariants the chapter mount hook depends on:
 *
 *   - `setActiveSurface` is idempotent on the same kind.
 *   - `clearActiveSurface(k)` is a no-op if the current owner is not
 *     `k` — a later surface that took the stage keeps its claim.
 *   - `active` is `null` before any mount.
 *   - The subscribeWithSelector middleware fires listeners exactly
 *     once per real transition.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useSurface } from "./surface";

function reset(): void {
  useSurface.getState().clear();
}

describe("useSurface — initial state", () => {
  beforeEach(reset);

  it("starts with active=null", () => {
    assert.equal(useSurface.getState().active, null);
  });
});

describe("useSurface — setActiveSurface", () => {
  beforeEach(reset);

  it("transitions null -> room", () => {
    useSurface.getState().setActiveSurface("room");
    assert.equal(useSurface.getState().active, "room");
  });

  it("is idempotent on the same kind (no listener fire)", () => {
    useSurface.getState().setActiveSurface("room");
    let fires = 0;
    const unsub = useSurface.subscribe(
      (s) => s.active,
      () => {
        fires += 1;
      },
    );
    useSurface.getState().setActiveSurface("room");
    useSurface.getState().setActiveSurface("room");
    unsub();
    assert.equal(fires, 0);
  });

  it("transitions across surfaces and fires once per edge", () => {
    const fires: Array<string | null> = [];
    const unsub = useSurface.subscribe(
      (s) => s.active,
      (active) => {
        fires.push(active);
      },
    );
    useSurface.getState().setActiveSurface("room");
    useSurface.getState().setActiveSurface("scan");
    useSurface.getState().setActiveSurface("room");
    unsub();
    assert.deepEqual(fires, ["room", "scan", "room"]);
  });
});

describe("useSurface — clearActiveSurface", () => {
  beforeEach(reset);

  it("clears only when the caller owns the stage", () => {
    useSurface.getState().setActiveSurface("room");
    useSurface.getState().clearActiveSurface("scan"); // not owned
    assert.equal(useSurface.getState().active, "room");
    useSurface.getState().clearActiveSurface("room");
    assert.equal(useSurface.getState().active, null);
  });

  it("is a no-op when the stage is already empty", () => {
    let fires = 0;
    const unsub = useSurface.subscribe(
      (s) => s.active,
      () => {
        fires += 1;
      },
    );
    useSurface.getState().clearActiveSurface("room");
    unsub();
    assert.equal(fires, 0);
  });

  it("a newer owner's claim survives a stale clear", () => {
    // Scenario: /scan is unmounting and calls clearActiveSurface("scan")
    // after /room has already remounted and set "room". The clear must
    // not strip the Room's claim.
    useSurface.getState().setActiveSurface("scan");
    useSurface.getState().setActiveSurface("room");
    useSurface.getState().clearActiveSurface("scan");
    assert.equal(useSurface.getState().active, "room");
  });
});
