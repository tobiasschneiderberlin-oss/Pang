/**
 * PANG — /api/verification/decline route (iter #10).
 *
 * Mirror of /confirm, for gallery declines. Same contract, same replay
 * safety via consumed-marker (primitive 51), same outcome-write to the
 * `.pang/server-outcomes/<requestId>.json` sibling file. The outcome
 * enum flips to `"declined"` and the signed-link audience is
 * `gallery-decline`.
 *
 * Declines carry no reason by design. The voice doctrine forbids
 * apologising for the gallery's answer; showing "Reason: …" to the
 * collector would drag PANG into mediating a relationship that
 * belongs to the two parties. The panel's reflective state is
 * "the gallery didn't verify this" — quiet, final, no explanation
 * performed.
 */

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { withOtelSpan } from "@/lib/otel/span";
import {
  verifySignedLink,
  tryMarkSignedLinkConsumed,
  SignedLinkVerifyError,
} from "@/auth/server/signed-link";
import type { VerificationOutcome } from "@/verification/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

const SERVER_OUTCOMES_DIR = path.resolve(
  process.cwd(),
  ".pang",
  "server-outcomes",
);

const BodySchema = z
  .object({
    token: z.string().min(1).max(4096),
  })
  .strict();

async function writeOutcome(
  requestId: string,
  outcome: VerificationOutcome,
): Promise<void> {
  await fs.mkdir(SERVER_OUTCOMES_DIR, { recursive: true });
  const target = path.join(SERVER_OUTCOMES_DIR, `${requestId}.json`);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(outcome, null, 2), "utf8");
  await fs.rename(tmp, target);
}

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.verification.decline", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/verification/decline");

    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    if (bodyText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "oversize" }, { status: 413 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "schema" }, { status: 400 });
    }

    let claims;
    try {
      claims = await verifySignedLink(parsed.data.token, "gallery-decline");
    } catch (err) {
      if (err instanceof SignedLinkVerifyError) {
        span.setAttribute("pang.error.kind", "signed_link");
        span.setAttribute("pang.signed_link.reason", err.reason);
        const status = err.reason === "expired" ? 410 : 401;
        return NextResponse.json(
          { error: err.reason },
          { status },
        );
      }
      throw err;
    }

    if (claims.aud !== "gallery-decline") {
      return NextResponse.json(
        { error: "wrong-audience" },
        { status: 401 },
      );
    }

    span.setAttribute("pang.verification.request_id", claims.vrid);
    span.setAttribute("pang.verification.work_id", claims.wid);

    const won = await tryMarkSignedLinkConsumed("gallery-decline", claims.jti);
    if (!won) {
      span.setAttribute("pang.signed_link.replay", true);
      return NextResponse.json({ ok: true, dedup: true }, { status: 200 });
    }

    const outcome: VerificationOutcome = {
      version: "v1",
      requestId: claims.vrid,
      workId: claims.wid,
      outcome: "declined",
      decidedAt: new Date().toISOString(),
    };
    try {
      await writeOutcome(claims.vrid, outcome);
    } catch (err) {
      span.setAttribute("pang.error.kind", "outcome_write");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, dedup: false }, { status: 200 });
  });
}
