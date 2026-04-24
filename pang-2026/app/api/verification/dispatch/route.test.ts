/**
 * PANG — /api/verification/dispatch integration tests (iter #10).
 *
 * The dispatch route calls the Correspondence Agent, which in
 * production hits Anthropic's API. Tests replace
 * `@/ai/agents/correspondence` with a mock that returns a known-good
 * `CorrespondenceOutput` (or null, for the fallback path). The mock
 * also exposes the placeholder-substitute so the route's own
 * substitution logic is exercised end-to-end.
 *
 * The route expects an outbox record to exist for the given
 * `requestId`; tests seed one before each case and clean up after.
 * The outbox is a filesystem sidecar at
 * `.pang/server-outbox/<requestId>.json`.
 *
 * Locks:
 *
 *   - Happy path (email): 200 + VerificationDispatchResult with mailto:
 *     channelUrl + signed confirm/decline URLs + agent-composed preview.
 *   - Happy path (whatsapp): 200 + wa.me channelUrl + null subject.
 *   - Idempotency on (requestId, channel): a second POST returns the
 *     cached payload verbatim (same dispatchedAt).
 *   - Channel switch: email then whatsapp on the same requestId
 *     overwrites the cached dispatch.
 *   - 404 when no outbox record exists.
 *   - Agent fallback: a null from the agent still produces a usable
 *     skeletal body carrying both signed URLs.
 *   - Validation: bad body / bad JSON / oversize / auth gate.
 */

import { describe, it, before, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { installNextHeadersMock } from "@/test/next-headers-mock";
import { seedSession } from "@/test/seed-session";
import { __resetAuthStoresForTests } from "@/auth/server/store";
import {
  __resetSignedLinksForTests,
} from "@/auth/server/signed-link";
import {
  newRequestId,
  type VerificationRequest,
  type VerificationDispatchResult,
} from "@/verification/schema";
import { brand } from "@/ai/camel/trust";

const jar = installNextHeadersMock();

// ---- Mock the Correspondence Agent ------------------------------
// The stub state is mutated per-test via `__setCorrespondenceMock`.
// The mock returns whatever the test set, or a default.

interface MockState {
  output:
    | {
        subject: string | null;
        body: string;
        bannedVocabularyDetected: boolean;
      }
    | null;
  callCount: number;
  lastInput: unknown;
}
const mockState: MockState = {
  output: {
    subject: "Verification request — test artwork",
    body: [
      "A request to verify a work.",
      "",
      "Artist: Test Artist, title: Untitled, 1973.",
      "",
      "Confirm: {{CONFIRM_URL}}",
      "Decline: {{DECLINE_URL}}",
      "",
      "Thank you for the time this takes.",
    ].join("\n"),
    bannedVocabularyDetected: false,
  },
  callCount: 0,
  lastInput: null,
};

function __setCorrespondenceMock(
  output: MockState["output"],
): void {
  mockState.output = output;
  mockState.callCount = 0;
  mockState.lastInput = null;
}

mock.module("@/ai/agents/correspondence", {
  namedExports: {
    runCorrespondenceAgent: async (input: unknown) => {
      mockState.callCount += 1;
      mockState.lastInput = input;
      if (mockState.output === null) return null;
      return brand(mockState.output, "P");
    },
    substitutePlaceholders: (
      body: string,
      confirmUrl: string,
      declineUrl: string,
    ): string => {
      return body
        .replace(/\{\{CONFIRM_URL\}\}/g, confirmUrl)
        .replace(/\{\{DECLINE_URL\}\}/g, declineUrl);
    },
  },
});

const { POST } = await import("./route");

// ---------- Test fixtures ----------------------------------------

const SERVER_OUTBOX_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outbox",
);

async function seedOutboxRecord(requestId: string): Promise<string> {
  await fs.mkdir(SERVER_OUTBOX_DIR, { recursive: true });
  const request: VerificationRequest = {
    version: "v1",
    requestId,
    workId: "w-test",
    galleryIdHint: "droste-berlin",
    galleryNameHint: "Galerie Droste",
    galleryFreeText: null,
    detectedFrom: "email",
    artworkSnapshot: {
      artist: "Test Artist",
      title: "Untitled",
      year: 1973,
      medium: "oil on canvas",
      dimensionsCm: { h: 120, w: 100 },
    },
    photoRef: "works/w-test.png",
    capturedAt: "2026-04-23T10:00:00.000Z",
    submittedAt: "2026-04-23T10:00:04.500Z",
  };
  const target = path.join(SERVER_OUTBOX_DIR, `${requestId}.json`);
  const record = {
    request,
    receivedAt: "2026-04-23T10:00:05.000Z",
  };
  await fs.writeFile(target, JSON.stringify(record, null, 2), "utf8");
  return target;
}

async function readStoredDispatch(
  requestId: string,
): Promise<VerificationDispatchResult | undefined> {
  const target = path.join(SERVER_OUTBOX_DIR, `${requestId}.json`);
  const raw = await fs.readFile(target, "utf8");
  const parsed = JSON.parse(raw) as {
    dispatch?: VerificationDispatchResult;
  };
  return parsed.dispatch;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/verification/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const createdFiles: string[] = [];

before(async () => {
  await __resetAuthStoresForTests();
  await __resetSignedLinksForTests();
  await seedSession(jar);
});

beforeEach(async () => {
  if (!jar.has("pang_session")) {
    await seedSession(jar);
  }
  // Restore the default mock before every test so an earlier case's
  // mutation doesn't leak.
  __setCorrespondenceMock({
    subject: "Verification request — test artwork",
    body: [
      "A request to verify a work.",
      "",
      "Artist: Test Artist, title: Untitled, 1973.",
      "",
      "Confirm: {{CONFIRM_URL}}",
      "Decline: {{DECLINE_URL}}",
      "",
      "Thank you for the time this takes.",
    ].join("\n"),
    bannedVocabularyDetected: false,
  });
});

afterEach(async () => {
  for (const f of createdFiles.splice(0)) {
    await fs.rm(f, { force: true }).catch(() => {});
  }
});

// ---------- Auth gate ---------------------------------------------

describe("POST /api/verification/dispatch — auth gate", () => {
  it("returns 401 with empty body when the session cookie is missing", async () => {
    jar.clear();
    const body = {
      version: "v1",
      requestId: newRequestId(),
      channel: "email",
      galleryContact: "registrar@droste.de",
    };
    const res = await POST(makeRequest(body));
    assert.equal(res.status, 401);
    const text = await res.text();
    assert.equal(text, "");
    await seedSession(jar);
  });
});

// ---------- Happy path --------------------------------------------

describe("POST /api/verification/dispatch — happy path (email)", () => {
  it("returns 200 + mailto: channelUrl carrying the composed body", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));

    const res = await POST(
      makeRequest({
        version: "v1",
        requestId,
        channel: "email",
        galleryContact: "registrar@droste.de",
      }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationDispatchResult;
    assert.equal(json.channel, "email");
    assert.ok(json.channelUrl.startsWith("mailto:"), "mailto URL expected");
    assert.ok(
      json.channelUrl.includes(encodeURIComponent("registrar@droste.de")),
      "gallery contact in mailto URL",
    );
    // Preview contains the substituted URLs, no placeholders.
    assert.ok(!json.previewBody.includes("{{CONFIRM_URL}}"));
    assert.ok(!json.previewBody.includes("{{DECLINE_URL}}"));
    assert.ok(json.confirmUrl.includes("/g/confirm/"));
    assert.ok(json.declineUrl.includes("/g/decline/"));
    assert.match(
      json.dispatchedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("persists the dispatch onto the outbox record", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));
    await POST(
      makeRequest({
        version: "v1",
        requestId,
        channel: "email",
        galleryContact: "registrar@droste.de",
      }),
    );
    const stored = await readStoredDispatch(requestId);
    assert.ok(stored !== undefined, "dispatch should be persisted");
    assert.equal(stored!.channel, "email");
  });
});

describe("POST /api/verification/dispatch — happy path (whatsapp)", () => {
  it("returns 200 + wa.me channelUrl with null subject", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));
    __setCorrespondenceMock({
      subject: null,
      body: [
        "A request to verify a work.",
        "",
        "Confirm: {{CONFIRM_URL}}",
        "Decline: {{DECLINE_URL}}",
      ].join("\n"),
      bannedVocabularyDetected: false,
    });

    const res = await POST(
      makeRequest({
        version: "v1",
        requestId,
        channel: "whatsapp",
        galleryContact: "+4915112345678",
      }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationDispatchResult;
    assert.equal(json.channel, "whatsapp");
    assert.ok(
      json.channelUrl.startsWith("https://wa.me/"),
      "wa.me URL expected",
    );
    // Phone digits only in wa.me.
    assert.ok(json.channelUrl.includes("wa.me/4915112345678"));
    assert.equal(json.previewSubject, null);
  });
});

// ---------- Idempotency -----------------------------------------

describe("POST /api/verification/dispatch — idempotency", () => {
  it("returns the cached dispatch verbatim on replay (same channel)", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));

    const first = (await (
      await POST(
        makeRequest({
          version: "v1",
          requestId,
          channel: "email",
          galleryContact: "registrar@droste.de",
        }),
      )
    ).json()) as VerificationDispatchResult;

    const second = (await (
      await POST(
        makeRequest({
          version: "v1",
          requestId,
          channel: "email",
          galleryContact: "registrar@droste.de",
        }),
      )
    ).json()) as VerificationDispatchResult;

    assert.equal(second.dispatchedAt, first.dispatchedAt);
    assert.equal(second.confirmUrl, first.confirmUrl);
    assert.equal(second.declineUrl, first.declineUrl);
    assert.equal(second.channelUrl, first.channelUrl);
  });

  it("a channel switch (email → whatsapp) produces a fresh dispatch", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));

    const first = (await (
      await POST(
        makeRequest({
          version: "v1",
          requestId,
          channel: "email",
          galleryContact: "registrar@droste.de",
        }),
      )
    ).json()) as VerificationDispatchResult;

    __setCorrespondenceMock({
      subject: null,
      body: [
        "A request to verify a work.",
        "Confirm: {{CONFIRM_URL}}",
        "Decline: {{DECLINE_URL}}",
      ].join("\n"),
      bannedVocabularyDetected: false,
    });
    const second = (await (
      await POST(
        makeRequest({
          version: "v1",
          requestId,
          channel: "whatsapp",
          galleryContact: "+4915112345678",
        }),
      )
    ).json()) as VerificationDispatchResult;

    assert.equal(second.channel, "whatsapp");
    assert.ok(second.channelUrl.startsWith("https://wa.me/"));
    // The persisted record now carries the whatsapp dispatch.
    const stored = await readStoredDispatch(requestId);
    assert.equal(stored!.channel, "whatsapp");
    // The first email channelUrl is discarded.
    assert.notEqual(first.channelUrl, second.channelUrl);
  });
});

// ---------- 404 when no outbox record ---------------------------

describe("POST /api/verification/dispatch — no outbox record", () => {
  it("returns 404 when the requestId has no outbox record", async () => {
    const requestId = newRequestId();
    const res = await POST(
      makeRequest({
        version: "v1",
        requestId,
        channel: "email",
        galleryContact: "registrar@droste.de",
      }),
    );
    assert.equal(res.status, 404);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "no_outbox_record");
  });
});

// ---------- Agent fallback ---------------------------------------

describe("POST /api/verification/dispatch — agent fallback", () => {
  it("returns 200 with a skeletal fallback body when the agent returns null", async () => {
    const requestId = newRequestId();
    createdFiles.push(await seedOutboxRecord(requestId));
    __setCorrespondenceMock(null);

    const res = await POST(
      makeRequest({
        version: "v1",
        requestId,
        channel: "email",
        galleryContact: "registrar@droste.de",
      }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as VerificationDispatchResult;
    assert.ok(json.channelUrl.startsWith("mailto:"));
    // Fallback body carries both signed URLs verbatim.
    assert.ok(json.previewBody.includes(json.confirmUrl));
    assert.ok(json.previewBody.includes(json.declineUrl));
  });
});

// ---------- Validation -------------------------------------------

describe("POST /api/verification/dispatch — validation", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("{not json"));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "bad_json");
  });

  it("returns 400 on a schema miss (missing channel)", async () => {
    const res = await POST(
      makeRequest({
        version: "v1",
        requestId: newRequestId(),
        galleryContact: "registrar@droste.de",
      }),
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "schema");
  });

  it("returns 400 on an unsupported channel", async () => {
    const res = await POST(
      makeRequest({
        version: "v1",
        requestId: newRequestId(),
        channel: "sms",
        galleryContact: "+4915112345678",
      }),
    );
    assert.equal(res.status, 400);
  });

  it("returns 413 on oversized body", async () => {
    const oversize = "x".repeat(5 * 1024);
    const res = await POST(makeRequest(oversize));
    assert.equal(res.status, 413);
  });
});
