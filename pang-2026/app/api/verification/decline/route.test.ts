/**
 * PANG — /api/verification/decline integration tests (iter #10).
 *
 * Mirror of confirm/route.test.ts — same set of concerns, flipped
 * audience + outcome. Locks:
 *
 *   - Happy path: valid decline token → 200 + `{ok: true, dedup: false}`
 *     + outcome file with `outcome: "declined"`.
 *   - Replay: a second POST returns `dedup: true`.
 *   - Audience mismatch: a confirm token presented here rejects with
 *     401 wrong-audience.
 *   - Body validation: bad JSON / bad shape / oversize.
 *
 * Declines carry no reason by design. The voice doctrine forbids
 * apologising for the gallery's answer; the `{ok, dedup}` response
 * shape mirrors confirm and the outcome JSON contains only the enum
 * + timestamp.
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
import { installNextHeadersMock } from "@/test/next-headers-mock";

installNextHeadersMock();
const { POST } = await import("./route");

const SERVER_OUTCOMES_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outcomes",
);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/verification/decline", {
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
  await __resetSignedLinksForTests();
});

afterEach(async () => {
  for (const f of createdFiles.splice(0)) {
    await fs.rm(f, { force: true }).catch(() => {});
  }
});

// ---------- Happy path --------------------------------------------

describe("POST /api/verification/decline — happy path", () => {
  it("returns 200 + {ok: true, dedup: false} and writes the outcome", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-decline",
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
    assert.equal(outcome.outcome, "declined");
    assert.equal(outcome.requestId, requestId);
    assert.equal(outcome.workId, "w-test");
    // Voice doctrine: no reason field.
    assert.equal((outcome as Record<string, unknown>)["reason"], undefined);
  });

  it("is idempotent on replay: a second POST returns dedup=true", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-decline",
      galleryId: "droste-berlin",
      verificationRequestId: requestId,
      workId: "w-test",
    });
    createdFiles.push(path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`));

    const first = (await (await POST(makeRequest({ token: jwt }))).json()) as {
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

describe("POST /api/verification/decline — signed-link rejection", () => {
  it("returns 401 on a random (bad) JWT", async () => {
    const res = await POST(
      makeRequest({ token: "not.a.real.jwt" }),
    );
    assert.equal(res.status, 401);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad-jwt");
  });

  it("returns 401 wrong-audience when a confirm token is presented", async () => {
    const requestId = newRequestId();
    const { jwt } = await signSignedLink({
      audience: "gallery-confirm",
      galleryId: "droste-berlin",
      verificationRequestId: requestId,
      workId: "w-test",
    });
    const res = await POST(makeRequest({ token: jwt }));
    assert.equal(res.status, 401);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "wrong-audience");
  });
});

// ---------- Body validation --------------------------------------

describe("POST /api/verification/decline — body validation", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("{not json"));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_json");
  });

  it("returns 400 on missing token field", async () => {
    const res = await POST(makeRequest({}));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "schema");
  });

  it("returns 413 on oversized body", async () => {
    const oversize = JSON.stringify({ token: "x".repeat(8192) });
    const res = await POST(makeRequest(oversize));
    assert.equal(res.status, 413);
  });
});
