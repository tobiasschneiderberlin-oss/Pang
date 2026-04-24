/**
 * PANG — rate-limit bucket tests.
 *
 * Token-bucket invariants:
 *   - Capacity fills immediately on first hit.
 *   - N requests at the limit pass; the N+1'th is denied.
 *   - Denied requests carry a positive retryAfterMs.
 *   - Buckets are (endpoint, ip) scoped — two ips drain independent
 *     buckets on the same endpoint.
 *   - `clientIpFromRequest` prefers `x-forwarded-for[0]` then
 *     `x-real-ip` then `"unknown"`.
 */

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  __resetRateLimitForTests,
  clientIpFromRequest,
  consumeRateLimit,
} from "./rate-limit";

beforeEach(() => {
  __resetRateLimitForTests();
});

describe("consumeRateLimit", () => {
  it("first request succeeds with remaining = capacity - 1", async () => {
    const res = await consumeRateLimit("auth.passkey.assert", "1.1.1.1");
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 29); // auth.passkey.assert capacity = 30
  });

  it("exactly capacity requests succeed; the next is denied", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await consumeRateLimit("auth.invite.bind", "2.2.2.2");
      assert.equal(r.allowed, true, `call ${i} should be allowed`);
    }
    const denied = await consumeRateLimit("auth.invite.bind", "2.2.2.2");
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterMs > 0);
    assert.equal(denied.remaining, 0);
  });

  it("two ips drain independent buckets", async () => {
    for (let i = 0; i < 10; i++) {
      await consumeRateLimit("auth.invite.bind", "3.3.3.3");
    }
    const denied = await consumeRateLimit("auth.invite.bind", "3.3.3.3");
    assert.equal(denied.allowed, false);
    // Different ip on the same endpoint — still allowed.
    const other = await consumeRateLimit("auth.invite.bind", "4.4.4.4");
    assert.equal(other.allowed, true);
  });

  it("unknown endpoint falls back to a default 30/60s policy", async () => {
    const res = await consumeRateLimit("auth.unknown.surface", "5.5.5.5");
    assert.equal(res.allowed, true);
    assert.equal(res.remaining, 29);
  });
});

describe("clientIpFromRequest", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("http://localhost/test", { headers });
  }

  it("prefers x-forwarded-for first value", () => {
    const r = req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 11.0.0.1" });
    assert.equal(clientIpFromRequest(r), "9.9.9.9");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const r = req({ "x-forwarded-for": "  12.12.12.12  , 13.13.13.13" });
    assert.equal(clientIpFromRequest(r), "12.12.12.12");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const r = req({ "x-real-ip": "14.14.14.14" });
    assert.equal(clientIpFromRequest(r), "14.14.14.14");
  });

  it("returns 'unknown' when no ip header is present", () => {
    const r = req({});
    assert.equal(clientIpFromRequest(r), "unknown");
  });
});
