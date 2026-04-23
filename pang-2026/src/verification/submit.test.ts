/**
 * PANG — submit classifier tests.
 *
 * Locks the classification table from `submit.ts` (the retry loop
 * reads `SubmitOutcome.kind` — a mis-classified 4xx would retry
 * forever; a mis-classified 5xx would burn the user's one tap):
 *
 *   - 2xx with a valid ack JSON → `ack`
 *   - 2xx with an unparseable ack body → `transient` / "ack/parse"
 *   - 2xx with a schema-invalid ack → `transient` / "ack/schema"
 *   - 4xx → `terminal` with the server's error key
 *   - 5xx → `transient` / "http/5xx"
 *   - network TypeError → `transient` / "network/fetch"
 *   - AbortError → `transient` / "network/abort"
 *
 * The store + outbox integration (`dispatchVerificationRequest`,
 * `drainOutbox`) requires an OPFS fixture and lands in the
 * Playwright suite in Phase G. These tests stub `fetch` globally
 * and run under Node.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { submitVerificationOnce } from "./submit";
import { newRequestId, type VerificationRequest } from "./schema";

function validRequest(): VerificationRequest {
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
  };
}

type FetchFn = typeof fetch;
let originalFetch: FetchFn | undefined;

function installFetchStub(fn: FetchFn): void {
  (globalThis as { fetch?: FetchFn }).fetch = fn;
}

beforeEach(() => {
  originalFetch = (globalThis as { fetch?: FetchFn }).fetch;
});

afterEach(() => {
  // exactOptionalPropertyTypes: we must delete rather than assign
  // `undefined` back — `fetch` is non-optional on globalThis.
  if (originalFetch === undefined) {
    delete (globalThis as { fetch?: FetchFn }).fetch;
  } else {
    (globalThis as { fetch: FetchFn }).fetch = originalFetch;
  }
});

describe("submitVerificationOnce — ack path", () => {
  it("classifies 200 + valid ack as 'ack'", async () => {
    const req = validRequest();
    installFetchStub(async () =>
      new Response(
        JSON.stringify({
          requestId: req.requestId,
          status: "received",
          receivedAt: "2026-04-23T10:00:05.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const outcome = await submitVerificationOnce(req);
    assert.equal(outcome.kind, "ack");
    if (outcome.kind === "ack") {
      assert.equal(outcome.receivedAt, "2026-04-23T10:00:05.000Z");
      assert.ok(outcome.latencyMs >= 0);
    }
  });

  it("classifies 2xx with unparseable body as 'transient' / ack/parse", async () => {
    installFetchStub(async () =>
      new Response("{not json", { status: 200 }),
    );
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "ack/parse");
    }
  });

  it("classifies 2xx with schema-invalid body as 'transient' / ack/schema", async () => {
    installFetchStub(async () =>
      new Response(
        JSON.stringify({ not: "the ack shape" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "ack/schema");
    }
  });
});

describe("submitVerificationOnce — terminal path", () => {
  it("classifies 400 as 'terminal' with the server's error key", async () => {
    installFetchStub(async () =>
      new Response(
        JSON.stringify({ error: "schema" }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "terminal");
    if (outcome.kind === "terminal") {
      assert.equal(outcome.status, 400);
      assert.equal(outcome.errorKey, "schema");
    }
  });

  it("classifies 422 voice_violation as 'terminal'", async () => {
    installFetchStub(async () =>
      new Response(
        JSON.stringify({ error: "voice_violation" }),
        { status: 422, headers: { "content-type": "application/json" } },
      ),
    );
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "terminal");
    if (outcome.kind === "terminal") {
      assert.equal(outcome.errorKey, "voice_violation");
    }
  });

  it("falls back to http/<status> when the 4xx body has no error key", async () => {
    installFetchStub(async () => new Response("", { status: 418 }));
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "terminal");
    if (outcome.kind === "terminal") {
      assert.equal(outcome.errorKey, "http/418");
    }
  });
});

describe("submitVerificationOnce — transient path", () => {
  it("classifies 500 as 'transient' / http/500", async () => {
    installFetchStub(async () => new Response("", { status: 500 }));
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "http/500");
    }
  });

  it("classifies 503 as 'transient' / http/503", async () => {
    installFetchStub(async () => new Response("", { status: 503 }));
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "http/503");
    }
  });

  it("classifies a TypeError as 'transient' / network/fetch", async () => {
    installFetchStub(async () => {
      throw new TypeError("Failed to fetch");
    });
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "network/fetch");
    }
  });

  it("classifies an AbortError as 'transient' / network/abort", async () => {
    installFetchStub(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "network/abort");
    }
  });

  it("classifies a TimeoutError as 'transient' / network/timeout", async () => {
    installFetchStub(async () => {
      const err = new Error("timeout");
      err.name = "TimeoutError";
      throw err;
    });
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "network/timeout");
    }
  });

  it("classifies an unknown Error as 'transient' / network/unknown", async () => {
    installFetchStub(async () => {
      throw new Error("mysterious");
    });
    const outcome = await submitVerificationOnce(validRequest());
    assert.equal(outcome.kind, "transient");
    if (outcome.kind === "transient") {
      assert.equal(outcome.reason, "network/unknown");
    }
  });
});
