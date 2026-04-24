/**
 * PANG — push delivery tests (iter #10).
 *
 * Locks:
 *
 *   - no subscription on disk → `{kind: "no-subscription"}` (no send)
 *   - no VAPID env → `{kind: "no-vapid"}` (no send, subscription kept)
 *   - happy path → webpush.sendNotification called with the payload,
 *     subscription file removed after
 *   - 410 Gone from push service → subscription file removed
 *   - generic error → subscription file kept (transient failure)
 *
 * `web-push` is mocked via `node:test`'s `mock.module` so tests do not
 * hit any real push endpoint. The mock records every call so assertions
 * run against the shape the real library would receive.
 */

import { describe, it, before, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const PUSH_SUBS_DIR = path.resolve(process.cwd(), ".pang", "push-subs");

// ---------- web-push mock ----------------------------------------

interface SendCall {
  readonly endpoint: string;
  readonly payload: string;
  readonly options: { TTL?: number; urgency?: string } | undefined;
}

interface MockState {
  readonly sendCalls: SendCall[];
  throwNext?:
    | { kind: "gone" }
    | { kind: "error"; message: string }
    | null;
  setVapidCalls: number;
}

const mockState: MockState = {
  sendCalls: [],
  throwNext: null,
  setVapidCalls: 0,
};

function resetMock(): void {
  mockState.sendCalls.length = 0;
  mockState.throwNext = null;
  mockState.setVapidCalls = 0;
}

const webpushMockImpl = {
  setVapidDetails(
    _subject: string,
    _publicKey: string,
    _privateKey: string,
  ): void {
    mockState.setVapidCalls += 1;
  },
  async sendNotification(
    subscription: { endpoint: string },
    payload: string,
    options?: { TTL?: number; urgency?: string },
  ): Promise<void> {
    mockState.sendCalls.push({
      endpoint: subscription.endpoint,
      payload,
      options,
    });
    const throwNext = mockState.throwNext;
    mockState.throwNext = null;
    if (throwNext) {
      if (throwNext.kind === "gone") {
        const err: Error & { statusCode?: number } = new Error("gone");
        err.statusCode = 410;
        throw err;
      }
      throw new Error(throwNext.message);
    }
  },
};

mock.module("web-push", {
  defaultExport: webpushMockImpl,
  namedExports: webpushMockImpl,
});

const { deliverOutcomePush, __resetVapidForTests } = await import(
  "./push-deliver"
);

// ---------- Fixture helpers -------------------------------------

function subFixture(requestId: string): {
  subscription: {
    version: "v1";
    requestId: string;
    workId: string;
    endpoint: string;
    expirationTime: null;
    keys: { p256dh: string; auth: string };
    subscribedAt: string;
  };
  storedAt: string;
} {
  return {
    subscription: {
      version: "v1",
      requestId,
      workId: "w-test",
      endpoint: "https://push.example/abc",
      expirationTime: null,
      keys: {
        p256dh: "BOGUS_P256DH_KEY",
        auth: "BOGUS_AUTH_KEY",
      },
      subscribedAt: "2026-04-23T10:00:00.000Z",
    },
    storedAt: "2026-04-23T10:00:01.000Z",
  };
}

async function writeSub(requestId: string): Promise<string> {
  await fs.mkdir(PUSH_SUBS_DIR, { recursive: true });
  const target = path.join(PUSH_SUBS_DIR, `${requestId}.json`);
  await fs.writeFile(target, JSON.stringify(subFixture(requestId)), "utf8");
  return target;
}

async function subExists(requestId: string): Promise<boolean> {
  const target = path.join(PUSH_SUBS_DIR, `${requestId}.json`);
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

const createdFiles: string[] = [];

before(async () => {
  // Baseline — VAPID present for most tests.
  process.env["VAPID_PUBLIC_KEY"] = "BOGUS_VAPID_PUBLIC_KEY";
  process.env["VAPID_PRIVATE_KEY"] = "BOGUS_VAPID_PRIVATE_KEY";
  process.env["VAPID_SUBJECT"] = "mailto:ops@test";
});

beforeEach(() => {
  resetMock();
  __resetVapidForTests();
});

afterEach(async () => {
  for (const f of createdFiles.splice(0)) {
    await fs.rm(f, { force: true }).catch(() => {});
  }
});

// ---------- Tests -----------------------------------------------

describe("deliverOutcomePush — no-subscription", () => {
  it("returns `no-subscription` without calling sendNotification", async () => {
    const outcome = await deliverOutcomePush({
      requestId: "vr-missing-1",
      workId: "w-test",
      outcome: "confirmed",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });
    assert.equal(outcome.kind, "no-subscription");
    assert.equal(mockState.sendCalls.length, 0);
  });
});

describe("deliverOutcomePush — no VAPID", () => {
  it("returns `no-vapid` and leaves the subscription in place", async () => {
    const target = await writeSub("vr-no-vapid-1");
    createdFiles.push(target);
    const prev = {
      pub: process.env["VAPID_PUBLIC_KEY"],
      priv: process.env["VAPID_PRIVATE_KEY"],
    };
    delete process.env["VAPID_PUBLIC_KEY"];
    delete process.env["VAPID_PRIVATE_KEY"];
    __resetVapidForTests();

    try {
      const outcome = await deliverOutcomePush({
        requestId: "vr-no-vapid-1",
        workId: "w-test",
        outcome: "confirmed",
        decidedAt: "2026-04-23T11:00:00.000Z",
      });
      assert.equal(outcome.kind, "no-vapid");
      assert.equal(mockState.sendCalls.length, 0);
      assert.equal(await subExists("vr-no-vapid-1"), true);
    } finally {
      if (prev.pub) process.env["VAPID_PUBLIC_KEY"] = prev.pub;
      if (prev.priv) process.env["VAPID_PRIVATE_KEY"] = prev.priv;
      __resetVapidForTests();
    }
  });
});

describe("deliverOutcomePush — happy path", () => {
  it("sends the payload and removes the subscription on success", async () => {
    const target = await writeSub("vr-happy-1");
    createdFiles.push(target);

    const outcome = await deliverOutcomePush({
      requestId: "vr-happy-1",
      workId: "w-test",
      outcome: "confirmed",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });

    assert.equal(outcome.kind, "sent");
    assert.equal(mockState.sendCalls.length, 1);
    const call = mockState.sendCalls[0]!;
    assert.equal(call.endpoint, "https://push.example/abc");
    const payload = JSON.parse(call.payload) as {
      kind: string;
      outcome: string;
      workId: string;
    };
    assert.equal(payload.kind, "outcome");
    assert.equal(payload.outcome, "confirmed");
    assert.equal(payload.workId, "w-test");
    assert.equal(await subExists("vr-happy-1"), false);
  });

  it("a replay after sent returns no-subscription", async () => {
    const target = await writeSub("vr-happy-2");
    createdFiles.push(target);

    await deliverOutcomePush({
      requestId: "vr-happy-2",
      workId: "w-test",
      outcome: "declined",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });
    const second = await deliverOutcomePush({
      requestId: "vr-happy-2",
      workId: "w-test",
      outcome: "declined",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });
    assert.equal(second.kind, "no-subscription");
  });
});

describe("deliverOutcomePush — 410 gone", () => {
  it("removes the subscription on a permanent push-service failure", async () => {
    const target = await writeSub("vr-gone-1");
    createdFiles.push(target);
    mockState.throwNext = { kind: "gone" };

    const outcome = await deliverOutcomePush({
      requestId: "vr-gone-1",
      workId: "w-test",
      outcome: "confirmed",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });
    assert.equal(outcome.kind, "gone");
    assert.equal(await subExists("vr-gone-1"), false);
  });
});

describe("deliverOutcomePush — transient error", () => {
  it("keeps the subscription on a non-410 failure", async () => {
    const target = await writeSub("vr-err-1");
    createdFiles.push(target);
    mockState.throwNext = { kind: "error", message: "network flap" };

    const outcome = await deliverOutcomePush({
      requestId: "vr-err-1",
      workId: "w-test",
      outcome: "confirmed",
      decidedAt: "2026-04-23T11:00:00.000Z",
    });
    assert.equal(outcome.kind, "error");
    assert.equal(await subExists("vr-err-1"), true);
  });
});
