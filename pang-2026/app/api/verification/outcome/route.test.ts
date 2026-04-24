/**
 * PANG — /api/verification/outcome/[requestId] integration tests
 * (iter #10).
 *
 * Co-located one directory up from the bracketed `[requestId]/`
 * folder because Node's `--test` invocation treats square-bracketed
 * path segments as glob character classes and refuses to load the
 * file as a test. Importing the handler from a sibling file is a
 * one-line cost and keeps the routing directory untouched.
 *
 * Exercises the collector-side polling endpoint the reconciler's
 * dispatched-state walker hits. Locks:
 *
 *   - Happy-path 200 + VerificationOutcome shape when an outcome file
 *     is present on disk.
 *   - 204 No Content with empty body when no outcome file exists.
 *   - 400 on a malformed requestId (path-traversal attempt, too long,
 *     wrong shape).
 *   - 500 when the outcome file is on disk but its JSON is broken.
 *   - 500 when the JSON parses but doesn't match VerificationOutcome.
 *   - Auth gate — 401 empty on a missing session cookie.
 *
 * The route reads `.pang/server-outcomes/<requestId>.json`. Tests seed
 * + clean up their own fixtures.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { installNextHeadersMock } from "@/test/next-headers-mock";
import { seedSession } from "@/test/seed-session";
import { __resetAuthStoresForTests } from "@/auth/server/store";
import {
  newRequestId,
  type VerificationOutcome,
} from "@/verification/schema";

const jar = installNextHeadersMock();
const { GET } = await import("./[requestId]/route");

const SERVER_OUTCOMES_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outcomes",
);

async function writeOutcomeFile(
  requestId: string,
  outcome: VerificationOutcome,
): Promise<string> {
  await fs.mkdir(SERVER_OUTCOMES_DIR, { recursive: true });
  const target = path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`);
  await fs.writeFile(target, JSON.stringify(outcome, null, 2), "utf8");
  return target;
}

async function writeRawOutcome(
  requestId: string,
  raw: string,
): Promise<string> {
  await fs.mkdir(SERVER_OUTCOMES_DIR, { recursive: true });
  const target = path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`);
  await fs.writeFile(target, raw, "utf8");
  return target;
}

function makeRequest(requestId: string): Request {
  return new Request(
    `http://localhost/api/verification/outcome/${requestId}`,
    { method: "GET" },
  );
}

async function callGet(requestId: string): Promise<Response> {
  return GET(makeRequest(requestId), {
    params: Promise.resolve({ requestId }),
  });
}

const createdFiles: string[] = [];

before(async () => {
  await __resetAuthStoresForTests();
  await seedSession(jar);
});

after(async () => {
  for (const file of createdFiles) {
    await fs.rm(file, { force: true });
  }
});

// ---------- Auth gate ---------------------------------------------

describe("GET /api/verification/outcome/[requestId] — auth gate", () => {
  it("returns 401 with empty body when the session cookie is missing", async () => {
    jar.clear();
    const res = await callGet(newRequestId());
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.equal(text, "");
    await seedSession(jar);
  });
});

// ---------- Happy path --------------------------------------------

describe("GET /api/verification/outcome/[requestId] — happy path", () => {
  beforeEach(async () => {
    if (!jar.has("pang_session")) {
      await seedSession(jar);
    }
  });

  it("returns 204 No Content with empty body when no outcome is present", async () => {
    const requestId = newRequestId();
    const res = await callGet(requestId);
    assert.equal(res.status, 204);
    const text = await res.text();
    assert.equal(text, "");
  });

  it("returns 200 + VerificationOutcome when a confirmed outcome exists", async () => {
    const requestId = newRequestId();
    const outcome: VerificationOutcome = {
      version: "v1",
      requestId,
      workId: "w-test",
      outcome: "confirmed",
      decidedAt: "2026-04-23T12:34:56.000Z",
    };
    createdFiles.push(await writeOutcomeFile(requestId, outcome));
    const res = await callGet(requestId);
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationOutcome;
    assert.deepEqual(json, outcome);
  });

  it("returns 200 + VerificationOutcome when a declined outcome exists", async () => {
    const requestId = newRequestId();
    const outcome: VerificationOutcome = {
      version: "v1",
      requestId,
      workId: "w-test",
      outcome: "declined",
      decidedAt: "2026-04-23T12:34:56.000Z",
    };
    createdFiles.push(await writeOutcomeFile(requestId, outcome));
    const res = await callGet(requestId);
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationOutcome;
    assert.equal(json.outcome, "declined");
  });

  it("returns 200 + VerificationOutcome when an expired outcome exists", async () => {
    const requestId = newRequestId();
    const outcome: VerificationOutcome = {
      version: "v1",
      requestId,
      workId: "w-test",
      outcome: "expired",
      decidedAt: "2026-04-23T12:34:56.000Z",
    };
    createdFiles.push(await writeOutcomeFile(requestId, outcome));
    const res = await callGet(requestId);
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationOutcome;
    assert.equal(json.outcome, "expired");
  });
});

// ---------- Validation --------------------------------------------

describe("GET /api/verification/outcome/[requestId] — validation", () => {
  beforeEach(async () => {
    if (!jar.has("pang_session")) {
      await seedSession(jar);
    }
  });

  it("returns 400 on a malformed requestId (path traversal attempt)", async () => {
    const res = await callGet("../../../etc/passwd");
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_request_id");
  });

  it("returns 400 on a requestId without the base36-base36 shape", async () => {
    const res = await callGet("invalid_id_no_dash");
    assert.equal(res.status, 400);
  });

  it("returns 400 on a requestId that exceeds the length cap", async () => {
    const tooLong = "a".repeat(30) + "-" + "b".repeat(30);
    const res = await callGet(tooLong);
    assert.equal(res.status, 400);
  });
});

// ---------- Data integrity ---------------------------------------

describe("GET /api/verification/outcome/[requestId] — data integrity", () => {
  beforeEach(async () => {
    if (!jar.has("pang_session")) {
      await seedSession(jar);
    }
  });

  it("returns 500 when the stored outcome JSON is unparseable", async () => {
    const requestId = newRequestId();
    createdFiles.push(await writeRawOutcome(requestId, "{not json"));
    const res = await callGet(requestId);
    assert.equal(res.status, 500);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_outcome_json");
  });

  it("returns 500 when the stored outcome fails the schema", async () => {
    const requestId = newRequestId();
    createdFiles.push(
      await writeRawOutcome(
        requestId,
        JSON.stringify({
          version: "v1",
          requestId,
          // workId missing; outcome wrong shape
          outcome: "maybe",
        }),
      ),
    );
    const res = await callGet(requestId);
    assert.equal(res.status, 500);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "schema");
  });
});
