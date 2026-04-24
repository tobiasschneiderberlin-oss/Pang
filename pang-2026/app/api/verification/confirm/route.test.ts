/**
 * PANG — /api/verification/confirm integration tests (iter #10).
 *
 * Exercises the gallery-confirm route end-to-end. The signed-link JWT
 * IS the auth — the registrar clicking from email has no PANG account,
 * so there's no session cookie gate. The load-bearing checks:
 *
 *   - Happy path: valid confirm token → 200 + `{ok: true, dedup: false}`
 *     + outcome file on disk with `outcome: "confirmed"`.
 *   - Replay: a second POST with the same token → 200 +
 *     `{ok: true, dedup: true}` (the consumed-marker race-winner
 *     pattern — primitive 51).
 *   - Audience mismatch: a token minted for `gallery-decline` presented
 *     here rejects with 401 `wrong-audience`.
 *   - Bad JWT: a random blob rejects with 401.
 *   - Validation: bad body / bad JSON / oversize.
 *
 * The route writes to `.pang/server-outcomes/<requestId>.json` and the
 * consumed-marker directory. Tests reset both before each case and
 * clean up after.
 */

import { describe, it, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  signSignedLink,
  __resetSignedLinksForTests,
} from "@/auth/server/signed-link";
import { newRequestId } from "@/verification/schema";

// No session mock needed — this route is signed-link-gated, not
// cookie-gated. The handler never calls `cookies()`. We still bring
// the mock in so subsequent tests in the suite share the jar if a
// regression slips in.
import { installNextHeadersMock } from "@/test/next-headers-mock";
installNextHeadersMock();
const { POST } = await import("./route");

const SERVER_OUTCOMES_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outcomes",
);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/verification/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function outcomeFileFor(requestId: string): Promise<string | null> {
  const target = path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`);
  try {
    return await fs.readFile(target, "utf8");
  } catch {
    return null;
  }
}

const createdFiles: string[] = [];

before(async () => {
  await __resetSignedLinksForTests();
});

beforeEach(async () => {
  // Reset consumed markers between tests so replay case studies are
  // deterministic.
  await __resetSignedLinksForTests();
});

afterEach(async () => {
  for (const f of createdFiles.splice(0)) {
    await fs.rm(f, { force: true }).catch(() => {});
  }
});

// ---------- Happy path --------------------------------------------

describe("POST /api/verification/confirm — happy path", () => {
  it("returns 200 + {ok: true, dedup: false} and writes the outcome", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-confirm",
      galleryId: "droste-berlin",
      verificationRequestId: requestId,
      workId: "w-test",
    });
    createdFiles.push(path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`));

    const res = await POST(makeRequest({ token: jwt }));
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; dedup: boolean };
    assert.equal(json.ok, true);
    assert.equal(json.dedup, false);

    const file = await outcomeFileFor(requestId);
    assert.ok(file !== null, "outcome file should exist");
    const outcome = JSON.parse(file!) as {
      outcome: string;
      requestId: string;
      workId: string;
    };
    assert.equal(outcome.outcome, "confirmed");
    assert.equal(outcome.requestId, requestId);
    assert.equal(outcome.workId, "w-test");
  });

  it("is idempotent on replay: a second POST with the same token returns dedup=true", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-confirm",
      galleryId: "droste-berlin",
      verificationRequestId: requestId,
      workId: "w-test",
    });
    createdFiles.push(path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`));

    const first = (await (await POST(makeRequest({ token: jwt }))).json()) as {
      ok: boolean;
      dedup: boolean;
    };
    assert.equal(first.dedup, false);

    const second = (await (await POST(makeRequest({ token: jwt }))).json()) as {
      ok: boolean;
      dedup: boolean;
    };
    assert.equal(second.ok, true);
    assert.equal(second.dedup, true);
  });
});

// ---------- Signed-link rejection -------------------------------

describe("POST /api/verification/confirm — signed-link rejection", () => {
  it("returns 401 on a random (bad) JWT", async () => {
    const res = await POST(
      makeRequest({ token: "not.a.real.jwt" }),
    );
    assert.equal(res.status, 401);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad-jwt");
  });

  it("returns 401 wrong-audience when a decline token is presented", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-decline",
      galleryId: "droste-berlin",
      verificationRequestId: requestId,
      workId: "w-test",
    });
    const res = await POST(makeRequest({ token: jwt }));
    assert.equal(res.status, 401);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "wrong-audience");
  });

  it("returns 401 when a collector-invite token is presented", async () => {
    const { jwt } = await signSignedLink({
      audience: "collector-invite",
      galleryId: "droste-berlin",
    });
    const res = await POST(makeRequest({ token: jwt }));
    assert.equal(res.status, 401);
  });
});

// ---------- Body validation --------------------------------------

describe("POST /api/verification/confirm — body validation", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("{not json"));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_json");
  });

  it("returns 400 on missing token field", async () => {
    const res = await POST(makeRequest({ not_token: "x" }));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "schema");
  });

  it("returns 400 on extra fields (strict)", async () => {
    const res = await POST(
      makeRequest({ token: "x".repeat(20), extraField: 1 }),
    );
    assert.equal(res.status, 400);
  });

  it("returns 413 on oversized body", async () => {
    const oversize = JSON.stringify({ token: "x".repeat(8192) });
    const res = await POST(makeRequest(oversize));
    assert.equal(res.status, 413);
  });
});
