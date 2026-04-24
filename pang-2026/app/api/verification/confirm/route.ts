/**
 * PANG — /api/verification/confirm route (iter #10).
 *
 * The gallery's registrar clicks the confirm link in the email the
 * collector sent. The link lands on `/g/confirm/[token]`, which POSTs
 * to this route with the token body. The route:
 *
 *   1. Verifies the signed link (audience=gallery-confirm, 30d TTL).
 *   2. Checks the consumed-marker — a replay short-circuits.
 *   3. Commits the consumed-marker BEFORE writing the outcome
 *      (primitive 51: marker-first, guarded side effect second).
 *   4. Writes the outcome ("confirmed", decidedAt=now) to the outbox
 *      sibling directory so the reconciler's fill-in walker picks it
 *      up.
 *   5. Returns `{ok: true}` — the gallery surface renders the thank-
 *      you page.
 *
 * Why a POST not a GET: clicking the link should not, on its own,
 * mutate server state (GET is cacheable; GET can be prefetched by the
 * gallery's inbox provider's link-safety scanner; GET is idempotent by
 * HTTP semantics but the "confirm" action is conceptually idempotent
 * because of the consumed-marker, not the verb). The `/g/confirm/
 * [token]` page renders a one-button "confirm" form; the form POSTs
 * here. A scanner that fetches the GET never triggers the write.
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
import { deliverOutcomePush } from "@/verification/push-deliver";

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
  return withOtelSpan("pang.api.verification.confirm", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/verification/confirm");

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

    // Verify the signed link.
    let claims;
    try {
      claims = await verifySignedLink(parsed.data.token, "gallery-confirm");
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

    if (claims.aud !== "gallery-confirm") {
      return NextResponse.json(
        { error: "wrong-audience" },
        { status: 401 },
      );
    }

    span.setAttribute("pang.verification.request_id", claims.vrid);
    span.setAttribute("pang.verification.work_id", claims.wid);

    // Consumed-marker commits BEFORE the outcome write (primitive 51).
    // tryMarkSignedLinkConsumed is the O_EXCL race winner; a second
    // click races against the first and the loser gets `{ won: false }`.
    const { won } = await tryMarkSignedLinkConsumed(
      "gallery-confirm",
      claims.jti,
    );
    if (!won) {
      span.setAttribute("pang.signed_link.replay", true);
      // Replay is idempotent — the outcome was already written by the
      // first click. Return 200 + a dedup flag so the gallery's page
      // renders the same "confirmed" affirmation.
      return NextResponse.json({ ok: true, dedup: true }, { status: 200 });
    }

    // Write the outcome. The reconciler (collector-side) polls the
    // outcome GET; push delivery fires as a best-effort fan-out.
    const outcome: VerificationOutcome = {
      version: "v1",
      requestId: claims.vrid,
      workId: claims.wid,
      outcome: "confirmed",
      decidedAt: new Date().toISOString(),
    };
    try {
      await writeOutcome(claims.vrid, outcome);
    } catch (err) {
      span.setAttribute("pang.error.kind", "outcome_write");
      span.recordException(err);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    // Best-effort push fan-out. The outbox's /api/verification/outcome
    // GET is the guaranteed-available rail; push is the latency
    // optimisation. A delivery failure is logged on the span and does
    // NOT fail the route — the collector's visibility walker will
    // pick up the outcome next time the tab opens.
    try {
      const delivery = await deliverOutcomePush({
        requestId: claims.vrid,
        workId: claims.wid,
        outcome: "confirmed",
        decidedAt: outcome.decidedAt,
      });
      span.setAttribute("pang.push.delivery", delivery.kind);
    } catch (err) {
      span.setAttribute("pang.push.delivery", "exception");
      span.recordException(err);
    }

    return NextResponse.json({ ok: true, dedup: false }, { status: 200 });
  });
}
