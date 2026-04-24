/**
 * PANG — passkey enrollment ceremony (iter #9).
 *
 * Locks the spine moment #7 end-to-end: gallery's invite link → bind
 * → enroll → session cookie → Room. The chromium WebAuthn virtual
 * authenticator stands in for the real biometric prompt; the ceremony
 * otherwise runs against production routes.
 *
 * What the spec proves:
 *   1. `/api/auth/invite/mint-dev` mints a JWT we can walk the invite
 *      landing with. The route is gated by `NEXT_PUBLIC_PANG_E2E=1`
 *      plus the `x-pang-e2e` bearer — the `playwright.config.ts`
 *      webServer clause sets both.
 *   2. The client component drives `/bind` → `/options?purpose=enroll`
 *      → virtual authenticator → `/enroll` without manual steering.
 *   3. On success the client replaces to `/` and the browser carries a
 *      live `pang_session` cookie with HttpOnly + SameSite=Strict +
 *      Path=/. Secure is off in dev (see `setCookieOnServer` in
 *      `src/auth/server/session.ts`) and we don't assert it — prod
 *      sets it from `NODE_ENV` alone.
 *   4. `GET /api/auth/session` returns a narrow `SessionReply` after
 *      enroll; `POST /api/auth/logout` revokes both cookie + row.
 *   5. A malformed invite token renders the "not valid" line without
 *      touching the bind route.
 *   6. A replayed invite (a second visit after enrollment) renders
 *      the "already used" line — the one-shot JWT contract.
 *
 * What the spec does NOT prove (deferred to `verify.test.ts`):
 *   - Counter-rollback clone detection. Forging `signCount` via the
 *     virtual authenticator requires a remove + re-add with the
 *     exported private key; a round-trip through `startAuthentication`
 *     triggered from a page that has no login UI yet would add a
 *     DOM fixture just for the test. The server logic is unit-tested.
 *
 * Runs on chromium-desktop only. The virtual authenticator is a
 * CDP-scoped fixture; the viewport doesn't matter.
 */

import {
  expect,
  test,
  type APIRequestContext,
  type CDPSession,
} from "@playwright/test";

const E2E_TOKEN =
  process.env["PANG_AUTH_E2E_TOKEN"] ?? "pang-e2e-dev-token-0123456789abcdef";

// Virtual authenticator options that match the relying-party's enroll
// options (`residentKey: "required"`, `authenticatorAttachment:
// "platform"`, `userVerification: "required"`). Any mismatch — e.g.
// `hasResidentKey: false` — produces a `NotAllowedError` at
// `startRegistration` time with no useful message.
async function addVirtualAuthenticator(cdp: CDPSession): Promise<string> {
  await cdp.send("WebAuthn.enable", { enableUI: false });
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        ctap2Version: "ctap2_1",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return authenticatorId;
}

async function mintInvite(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/invite/mint-dev", {
    headers: { "x-pang-e2e": E2E_TOKEN },
    data: { galleryId: "droste" },
  });
  expect(
    res.ok(),
    `invite mint-dev expected 200, got ${res.status()} — ` +
      `is NEXT_PUBLIC_PANG_E2E=1 on the dev server?`,
  ).toBe(true);
  const { token } = (await res.json()) as { token: string };
  return token;
}

test.describe("passkey — enrollment ceremony", () => {
  test("invite → bind → enroll → session cookie is set and narrow", async ({
    page,
    request,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await addVirtualAuthenticator(cdp);

    try {
      const token = await mintInvite(request);

      await page.goto(`/i/${token}`);

      // Bind completes → "Create passkey" button appears.
      const enrollBtn = page.getByTestId("invite-enroll");
      await expect(enrollBtn).toBeVisible({ timeout: 10_000 });

      await enrollBtn.click();

      // The client replaces to "/" after a successful enroll. We don't
      // race the canvas paint — the URL transition is the spine
      // contract.
      await page.waitForURL("**/", { timeout: 15_000 });

      // The credential landed in the virtual authenticator.
      const { credentials } = (await cdp.send("WebAuthn.getCredentials", {
        authenticatorId,
      })) as { credentials: ReadonlyArray<{ credentialId: string }> };
      expect(credentials.length).toBe(1);

      // Session is live.
      const sessionRes = await page.request.get("/api/auth/session");
      expect(sessionRes.status()).toBe(200);
      const session = (await sessionRes.json()) as {
        userId: string;
        method: string;
        expiresAt: string;
      };
      expect(session.method).toBe("passkey");
      expect(session.userId).toMatch(/^u_[A-Za-z0-9]{22}$/);
      expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.now());

      // Cookie shape — HttpOnly + SameSite=Strict + Path=/.
      const cookies = await page.context().cookies();
      const pangCookie = cookies.find((c) => c.name === "pang_session");
      expect(pangCookie, "pang_session cookie present").toBeDefined();
      expect(pangCookie?.httpOnly).toBe(true);
      // Playwright capitalises the cookie sameSite string.
      expect(pangCookie?.sameSite).toBe("Strict");
      expect(pangCookie?.path).toBe("/");

      // Bind cookie is closed post-enroll — the short-TTL ceremony
      // cookie shouldn't survive the session it enabled.
      const bindCookie = cookies.find((c) => c.name === "pang_bind");
      expect(bindCookie?.value ?? "").toBe("");
    } finally {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    }
  });

  test("logout revokes the session cookie + row", async ({ page, request }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await addVirtualAuthenticator(cdp);

    try {
      const token = await mintInvite(request);
      await page.goto(`/i/${token}`);
      await page.getByTestId("invite-enroll").click();
      await page.waitForURL("**/", { timeout: 15_000 });

      // Pre-condition: session is live.
      await expect
        .poll(async () => (await page.request.get("/api/auth/session")).status())
        .toBe(200);

      const logoutRes = await page.request.post("/api/auth/logout");
      expect(logoutRes.status()).toBe(204);

      // Post: session read is 401 with no body.
      const after = await page.request.get("/api/auth/session");
      expect(after.status()).toBe(401);
      const text = await after.text();
      expect(text).toBe("");

      // Cookie is gone (expired or cleared).
      const cookies = await page.context().cookies();
      const pangCookie = cookies.find((c) => c.name === "pang_session");
      expect(pangCookie?.value ?? "").toBe("");
    } finally {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    }
  });
});

test.describe("passkey — invite landing error surfaces", () => {
  test("malformed invite shows the not-valid line, does not call bind", async ({
    page,
  }) => {
    const bindCalls: string[] = [];
    await page.route("**/api/auth/invite/bind", async (route) => {
      bindCalls.push(route.request().url());
      await route.continue();
    });

    // "not-a-jwt" fails the JWT shape check in app/i/[token]/page.tsx
    // (three base64url segments required — a single token with no dots
    // can't match); the server renders the client in `malformed` mode
    // without touching bind.
    await page.goto("/i/not-a-jwt");

    await expect(
      page.getByText("This invite is not valid."),
    ).toBeVisible({ timeout: 5_000 });

    // The "Create passkey" button only appears in `ready` phase — a
    // malformed token never reaches it.
    await expect(page.getByTestId("invite-enroll")).toHaveCount(0);
    expect(bindCalls.length).toBe(0);
  });

  test("a replayed invite shows the already-used line", async ({
    page,
    request,
  }) => {
    const cdp = await page.context().newCDPSession(page);
    const authenticatorId = await addVirtualAuthenticator(cdp);

    try {
      const token = await mintInvite(request);

      // First visit + enroll.
      await page.goto(`/i/${token}`);
      await page.getByTestId("invite-enroll").click();
      await page.waitForURL("**/", { timeout: 15_000 });

      // Log out so the second visit hits bind (not the "already in"
      // shortcut).
      await page.request.post("/api/auth/logout");

      // Second visit — bind returns 409 on the consumed jti.
      await page.goto(`/i/${token}`);
      await expect(
        page.getByText("This invite has been used."),
      ).toBeVisible({ timeout: 10_000 });

      // No enroll button on a replayed invite.
      await expect(page.getByTestId("invite-enroll")).toHaveCount(0);
    } finally {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    }
  });
});
