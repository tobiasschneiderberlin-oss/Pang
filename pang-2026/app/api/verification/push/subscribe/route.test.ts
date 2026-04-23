/**
 * PANG — /api/verification/push/subscribe integration tests.
 *
 * Exercises the route handler by calling `POST` directly with a
 * synthesised `Request`. Locks:
 *
 *   - Happy-path 200 + ack shape.
 *   - Idempotency on `requestId` (same `storedAt` on re-POST).
 *   - 400 on a schema miss.
 *   - 400 on invalid JSON.
 *   - 413 on an oversized body.
 *
 * The route writes to `.pang/push-subs/<requestId>.json`. Tests
 * clean up their artefacts.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { POST } from "./route";
import { newRequestId } from "@/verification/schema";
import type { PushSubscribePayload } from "@/push/schema";

const PUSH_SUBS_DIR = path.resolve(process.cwd(), ".pang", "push-subs");

function validBody(
  overrides: Partial<PushSubscribePayload> = {},
): PushSubscribePayload {
  return {
    version: "v1",
    requestId: newRequestId(),
    workId: "w-test",
    endpoint: "https://push.example.com/abc/xyz",
    expirationTime: null,
    keys: {
      p256dh:
        "BN5cEtzqVsZ3kkjZ5ZVoLGXczUcHwbVJ4J2c8bZ6T4xqk7m7mDTQJ1x8O-_C7vJ5S4i2eP4pKj9X8wR1aH2Yq-s",
      auth: "abcd1234EFGH5678ijkl",
    },
    subscribedAt: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request(
    "http://localhost/api/verification/push/subscribe",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

const createdFiles: string[] = [];
function rememberFile(requestId: string): void {
  createdFiles.push(path.join(PUSH_SUBS_DIR, `${requestId}.json`));
}

after(async () => {
  for (const file of createdFiles) {
    await fs.rm(file, { force: true });
  }
});

describe("POST /api/verification/push/subscribe — happy path", () => {
  it("stores a valid subscription and returns a stored ack", async () => {
    const body = validBody();
    rememberFile(body.requestId);
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 200);
    const ack = (await res.json()) as Record<string, unknown>;
    assert.equal(ack["requestId"], body.requestId);
    assert.equal(ack["status"], "stored");
    assert.equal(typeof ack["storedAt"], "string");

    // File really exists, and carries the subscription + storedAt.
    const text = await fs.readFile(
      path.join(PUSH_SUBS_DIR, `${body.requestId}.json`),
      "utf8",
    );
    const parsed = JSON.parse(text) as {
      subscription: PushSubscribePayload;
      storedAt: string;
    };
    assert.equal(parsed.subscription.requestId, body.requestId);
    assert.equal(parsed.subscription.endpoint, body.endpoint);
    assert.equal(parsed.storedAt, ack["storedAt"]);
  });
});

describe("POST /api/verification/push/subscribe — idempotency", () => {
  it("returns the original storedAt on a repeat POST of the same requestId", async () => {
    const body = validBody();
    rememberFile(body.requestId);
    const first = await POST(makeRequest(body));
    const firstAck = (await first.json()) as { storedAt: string };
    // A tiny delay so the clock advances between calls — if the
    // server weren't deduping, `storedAt` would move.
    await new Promise((r) => setTimeout(r, 5));
    const second = await POST(makeRequest(body));
    const secondAck = (await second.json()) as { storedAt: string };
    assert.equal(second.status, 200);
    assert.equal(secondAck.storedAt, firstAck.storedAt);
  });
});

describe("POST /api/verification/push/subscribe — rejections", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("{not json"));
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string };
    assert.equal(err.error, "bad_json");
  });

  it("returns 400 on a schema miss (http:// endpoint)", async () => {
    const body = validBody({ endpoint: "http://push.example.com/abc" });
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string };
    assert.equal(err.error, "schema");
  });

  it("returns 400 on unknown top-level keys (`.strict()`)", async () => {
    const body = { ...validBody(), rogue: "nope" };
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 400);
  });

  it("returns 413 when the body exceeds 4 kB", async () => {
    // Pad the body out past MAX_BODY_BYTES by stuffing the endpoint
    // (we have to pad something the payload accepts; a long
    // endpoint fits the 1024-char bound and still fails only on the
    // overall size gate when we push JSON over 4096 bytes).
    const longAuth = "A".repeat(2000);
    const body = validBody({
      keys: {
        p256dh: "BN5cEtzqVsZ3kkjZ5ZVoLGXczUcHwbVJ",
        // Even with 2000 chars, auth is under its 256 cap → invalid.
        // So we stuff via a literal oversize string at the text
        // layer instead.
        auth: "abcd1234EFGH5678ijkl",
      },
    });
    // Build a raw JSON string with padded whitespace to breach the
    // 4 kB gate without breaking `JSON.parse`.
    const text = JSON.stringify(body) + " ".repeat(5000);
    const req = new Request(
      "http://localhost/api/verification/push/subscribe",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      },
    );
    const res = await POST(req);
    assert.equal(res.status, 413);
    void longAuth;
  });
});
