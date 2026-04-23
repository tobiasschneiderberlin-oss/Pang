/**
 * PANG — /api/verification/request integration tests.
 *
 * Exercises the route handler by calling `POST` directly with a
 * synthesised `Request`. These tests:
 *
 *   - Lock the happy-path 200 + ack shape.
 *   - Prove idempotency on `requestId` (same `receivedAt` on re-POST).
 *   - Lock the 400 / 413 / 422 failure paths so the retry loop knows
 *     which errors are terminal vs transient (a 4xx ≠ retry).
 *
 * The route writes to `.pang/server-outbox/<requestId>.json` under
 * `process.cwd()`. Tests generate unique request ids per case to
 * avoid cross-test interference, and clean up their own artefacts at
 * the end.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { POST } from "./route";
import {
  newRequestId,
  type VerificationRequest,
} from "@/verification/schema";

const SERVER_OUTBOX_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outbox",
);

function validBody(
  overrides: Partial<VerificationRequest> = {},
): VerificationRequest {
  return {
    version: "v1",
    requestId: newRequestId(),
    workId: "w-test",
    galleryIdHint: "droste-berlin",
    galleryNameHint: "Galerie Droste",
    galleryFreeText: null,
    detectedFrom: "email",
    artworkSnapshot: {
      artist: "Joan Mitchell",
      title: "Untitled",
      year: 1973,
      medium: "oil on canvas",
      dimensionsCm: { h: 120, w: 100 },
    },
    photoRef: "works/w-test.png",
    capturedAt: "2026-04-23T10:00:00.000Z",
    submittedAt: "2026-04-23T10:00:04.500Z",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/verification/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const createdFiles: string[] = [];
function rememberFile(requestId: string): void {
  createdFiles.push(path.join(SERVER_OUTBOX_DIR, `${requestId}.json`));
}

after(async () => {
  // Clean up every artefact the tests wrote.
  for (const file of createdFiles) {
    await fs.rm(file, { force: true });
  }
});

// ---------- Happy path --------------------------------------------

describe("POST /api/verification/request — happy path", () => {
  it("returns 200 with an ack", async () => {
    const body = validBody();
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      requestId: string;
      status: string;
      receivedAt: string;
    };
    assert.equal(json.requestId, body.requestId);
    assert.equal(json.status, "received");
    assert.match(
      json.receivedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/,
    );
  });

  it("persists the record to .pang/server-outbox/", async () => {
    const body = validBody();
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 200);
    const file = path.join(
      SERVER_OUTBOX_DIR,
      `${body.requestId}.json`,
    );
    const text = await fs.readFile(file, "utf8");
    const persisted = JSON.parse(text) as {
      request: { requestId: string };
      receivedAt: string;
    };
    assert.equal(persisted.request.requestId, body.requestId);
    assert.ok(persisted.receivedAt.length > 0);
  });

  it("is idempotent on requestId (same receivedAt on re-POST)", async () => {
    const body = validBody();
    rememberFile(body.requestId);
    const first = (await (await POST(makeRequest(body))).json()) as {
      receivedAt: string;
    };
    // Force a tick so a naive implementation would drift.
    await new Promise((r) => setTimeout(r, 5));
    const second = (await (await POST(makeRequest(body))).json()) as {
      receivedAt: string;
    };
    assert.equal(first.receivedAt, second.receivedAt);
  });

  it("accepts id-only, name-only, and free-text-only gallery identifiers", async () => {
    const cases: Partial<VerificationRequest>[] = [
      {
        galleryIdHint: "g-only",
        galleryNameHint: null,
        galleryFreeText: null,
      },
      {
        galleryIdHint: null,
        galleryNameHint: "Name Only",
        galleryFreeText: null,
      },
      {
        galleryIdHint: null,
        galleryNameHint: null,
        galleryFreeText: "a gallery the collector typed in",
      },
    ];
    for (const override of cases) {
      const body = validBody(override);
      rememberFile(body.requestId);
      const res = await POST(makeRequest(body));
      assert.equal(res.status, 200, JSON.stringify(override));
    }
  });
});

// ---------- Validation failures -----------------------------------

describe("POST /api/verification/request — validation", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("{not json"));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_json");
  });

  it("returns 400 on schema failure", async () => {
    const body = validBody();
    // Break the schema by removing a required field.
    delete (body as { workId?: unknown }).workId;
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "schema");
  });

  it("returns 400 when all gallery identifiers are null (refinement)", async () => {
    const body = validBody({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: null,
    });
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 400);
  });

  it("returns 413 on oversize body", async () => {
    // Stuff the free-text field well past the schema cap; the size
    // floor rejects before the schema. A 9 kB body exceeds the 8 kB
    // limit by construction.
    const oversize = "x".repeat(9 * 1024);
    const res = await POST(makeRequest(oversize));
    assert.equal(res.status, 413);
  });

  it("returns 422 on voice violation in free-text", async () => {
    // `"awesome"` is in the hard ban list; the refinement requires
    // *some* gallery identifier, so we send it as free-text.
    const body = validBody({
      galleryIdHint: null,
      galleryNameHint: null,
      galleryFreeText: "this awesome gallery",
    });
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 422);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "voice_violation");
  });
});
