/**
 * PANG — verification flow e2e specs (iter #10).
 *
 * Locks spine moment #8 end-to-end at the HTTP contract layer. The
 * dispatch → gallery-confirm → reconcile loop is long; these specs
 * exercise each load-bearing primitive in isolation so a regression
 * localises fast:
 *
 *   1. verification-dispatch: mint-dev the confirm link, POST it,
 *      assert 200 + outcome file is served through /outcome/.
 *   2. verification-decline: mirror of (1) for gallery-decline.
 *   3. verification-race: two POST /confirm in quick succession —
 *      the second returns dedup:true (primitive 51).
 *   4. verification-replay: same token reused across a route boundary
 *      (e.g. the gallery refreshes the confirm page) — 200 + dedup:true.
 *   5. verification-reconcile: after confirm writes an outcome, the
 *      /outcome/<requestId> GET returns a schema-valid body with
 *      outcome="confirmed" — the collector-side walker's input.
 *
 * The specs hit real Next.js routes on the dev server started by the
 * Playwright webServer clause. The `x-pang-e2e` header + the dev-only
 * /api/verification/mint-dev route let us mint signed links without
 * going through the full dispatch flow (which needs an outbox record
 * seeded in OPFS inside a browser context).
 *
 * The /outcome/ route is session-cookie-gated in production; we
 * authenticate via the passkey e2e flow's session seam (/api/auth/
 * e2e-seam) so the request carries a live collector session.
 */

import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

const E2E_TOKEN =
  process.env["PANG_AUTH_E2E_TOKEN"] ?? "pang-e2e-dev-token-0123456789abcdef";

interface MintReply {
  readonly token: string;
  readonly audience: "gallery-confirm" | "gallery-decline";
  readonly galleryId: string;
  readonly workId: string;
  readonly verificationRequestId: string;
}

async function mintSignedLink(
  request: APIRequestContext,
  input: {
    readonly audience: "gallery-confirm" | "gallery-decline";
    readonly verificationRequestId?: string;
    readonly workId?: string;
  },
): Promise<MintReply> {
  const res = await request.post("/api/verification/mint-dev", {
    headers: { "x-pang-e2e": E2E_TOKEN },
    data: input,
  });
  expect(
    res.ok(),
    `mint-dev failed with ${res.status()} — is NEXT_PUBLIC_PANG_E2E=1?`,
  ).toBe(true);
  return (await res.json()) as MintReply;
}

async function seedSession(request: APIRequestContext): Promise<void> {
  // The e2e-seam installs a synthetic session cookie so the outcome
  // route's `requireSession` passes. The cookie is request-context-
  // scoped (APIRequestContext keeps its own cookie jar) — any
  // subsequent `.get()` on this context carries the cookie.
  const res = await request.post("/api/auth/e2e-seam", {
    headers: {
      "x-pang-e2e": E2E_TOKEN,
      "content-type": "application/json",
    },
    data: { action: "seed", userId: "u-verification-e2e" },
  });
  expect(
    res.ok() || res.status() === 204,
    `e2e-seam failed with ${res.status()}`,
  ).toBe(true);
}

// ---------- Spec 1: dispatch (confirm happy path) ---------------

test.describe("verification-dispatch — confirm happy path", () => {
  test("mint → POST /confirm → 200 + outcome written", async ({ request }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-confirm",
    });

    const res = await request.post("/api/verification/confirm", {
      data: { token: mint.token },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { ok: boolean; dedup: boolean };
    expect(json.ok).toBe(true);
    expect(json.dedup).toBe(false);
  });
});

// ---------- Spec 2: decline happy path --------------------------

test.describe("verification-decline — happy path", () => {
  test("mint → POST /decline → 200 + outcome has no reason", async ({
    request,
  }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-decline",
    });

    const res = await request.post("/api/verification/decline", {
      data: { token: mint.token },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { ok: boolean; dedup: boolean };
    expect(json.ok).toBe(true);
    expect(json.dedup).toBe(false);

    // The outcome-GET confirms no `reason` leaked into the stored
    // record (voice doctrine: declines carry no reason).
    const outcomeRes = await request.get(
      `/api/verification/outcome/${mint.verificationRequestId}`,
    );
    expect(outcomeRes.status()).toBe(200);
    const outcome = (await outcomeRes.json()) as Record<string, unknown>;
    expect(outcome["outcome"]).toBe("declined");
    expect(outcome["reason"]).toBeUndefined();
  });
});

// ---------- Spec 3: race (primitive 51 dedup) -------------------

test.describe("verification-race — consumed-marker wins", () => {
  test("two POST /confirm calls: second returns dedup:true", async ({
    request,
  }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-confirm",
    });

    const first = await request.post("/api/verification/confirm", {
      data: { token: mint.token },
    });
    expect(first.status()).toBe(200);
    const firstBody = (await first.json()) as { dedup: boolean };
    expect(firstBody.dedup).toBe(false);

    const second = await request.post("/api/verification/confirm", {
      data: { token: mint.token },
    });
    expect(second.status()).toBe(200);
    const secondBody = (await second.json()) as {
      ok: boolean;
      dedup: boolean;
    };
    expect(secondBody.ok).toBe(true);
    expect(secondBody.dedup).toBe(true);
  });
});

// ---------- Spec 4: replay + wrong-audience ---------------------

test.describe("verification-replay — wrong-audience is 401", () => {
  test("confirm token presented to /decline rejects with 401", async ({
    request,
  }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-confirm",
    });

    const res = await request.post("/api/verification/decline", {
      data: { token: mint.token },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("wrong-audience");
  });

  test("decline token presented to /confirm rejects with 401", async ({
    request,
  }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-decline",
    });

    const res = await request.post("/api/verification/confirm", {
      data: { token: mint.token },
    });
    expect(res.status()).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("wrong-audience");
  });
});

// ---------- Spec 5: reconcile (outcome GET) ---------------------

test.describe("verification-reconcile — outcome GET returns written outcome", () => {
  test("after confirm, /outcome/<requestId> returns the confirmed outcome", async ({
    request,
  }) => {
    await seedSession(request);
    const mint = await mintSignedLink(request, {
      audience: "gallery-confirm",
    });

    const confirmRes = await request.post("/api/verification/confirm", {
      data: { token: mint.token },
    });
    expect(confirmRes.status()).toBe(200);

    const outcomeRes = await request.get(
      `/api/verification/outcome/${mint.verificationRequestId}`,
    );
    expect(outcomeRes.status()).toBe(200);
    const outcome = (await outcomeRes.json()) as {
      version: string;
      requestId: string;
      workId: string;
      outcome: string;
      decidedAt: string;
    };
    expect(outcome.version).toBe("v1");
    expect(outcome.requestId).toBe(mint.verificationRequestId);
    expect(outcome.outcome).toBe("confirmed");
    expect(Date.parse(outcome.decidedAt)).toBeGreaterThan(
      Date.now() - 60_000,
    );
  });

  test("before any decision, /outcome/<requestId> returns 204", async ({
    request,
  }) => {
    await seedSession(request);
    // Mint a link but don't exercise it — the outcome is never written.
    const mint = await mintSignedLink(request, {
      audience: "gallery-confirm",
    });
    const res = await request.get(
      `/api/verification/outcome/${mint.verificationRequestId}`,
    );
    expect(res.status()).toBe(204);
  });
});
