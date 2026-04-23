/**
 * PANG — /api/telemetry route.
 *
 * Client failure beacon sink. The scanner path posts a narrow JSON
 * payload here on every transition into the `failed` state (and on
 * CV-worker crashes inside the viewfinder). The payload lands as
 * span attributes in the `pang.telemetry.failure` span so Vercel
 * function logs show the real diagnostic text — the voice corpus on
 * the client is deliberately vague, which is correct for Laura and
 * hopeless for debugging on a real device.
 *
 * Design rules:
 *   - Metadata only. Image bytes, document bodies, and collector PII
 *     never reach this route. Zod's `.strict()` rejects any unknown
 *     key, so a beacon payload cannot grow an exfiltration channel.
 *   - Fire-and-forget on the wire. We always return 204 — even when
 *     validation fails — because the client must not retry telemetry
 *     and the user must not see a second failure because the first
 *     failed to report.
 *   - Size-bounded. Every string has a hard cap. A malformed beacon
 *     costs at most a few hundred bytes per request.
 *
 * Iteration #1, Tier 1 of the testing discipline upgrade
 * (2026-04-23). See `src/lib/telemetry/beacon.ts` for the call site.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withOtelSpan } from "@/lib/otel/span";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Narrow Zod schema. `.strict()` forbids unknown keys — a beacon
// cannot become an exfiltration side-channel.
const FailureBeaconSchema = z
  .object({
    errorKey: z.string().min(1).max(64),
    detail: z.string().max(1024).optional(),
    stage: z.enum([
      "viewfinder",
      "uploading",
      "review",
      "arrival",
      "worker",
      "unknown",
    ]),
    uploadStatus: z.number().int().min(0).max(999).optional(),
    imageBytesLength: z.number().int().min(0).max(100_000_000).optional(),
    site: z.string().max(128).optional(),
    userAgent: z.string().max(512).nullable().optional(),
    timestamp: z.string().max(64).optional(),
    viewport: z
      .object({
        w: z.number().int().min(0).max(10_000),
        h: z.number().int().min(0).max(10_000),
      })
      .strict()
      .nullable()
      .optional(),
    online: z.boolean().nullable().optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.telemetry", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/telemetry");

    // Body size floor: reject anything larger than 4 kB outright.
    // A legitimate beacon is a few hundred bytes; more is suspect.
    let raw: unknown;
    try {
      const text = await request.text();
      if (text.length > 4096) {
        span.setAttribute("pang.telemetry.rejected", "oversize");
        return new NextResponse(null, { status: 204 });
      }
      raw = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      span.setAttribute("pang.telemetry.rejected", "bad_json");
      return new NextResponse(null, { status: 204 });
    }

    const parsed = FailureBeaconSchema.safeParse(raw);
    if (!parsed.success) {
      span.setAttribute("pang.telemetry.rejected", "schema");
      span.setAttribute(
        "pang.telemetry.schema_error",
        JSON.stringify(parsed.error.flatten()).slice(0, 512),
      );
      return new NextResponse(null, { status: 204 });
    }

    const data = parsed.data;

    // Flatten to span attributes. Vercel's log UI surfaces these as
    // structured JSON fields on the otel span row.
    span.setAttribute("pang.failure.key", data.errorKey);
    span.setAttribute("pang.failure.stage", data.stage);
    if (data.detail) span.setAttribute("pang.failure.detail", data.detail);
    if (data.site) span.setAttribute("pang.failure.site", data.site);
    if (data.uploadStatus !== undefined) {
      span.setAttribute("pang.failure.upload_status", data.uploadStatus);
    }
    if (data.imageBytesLength !== undefined) {
      span.setAttribute(
        "pang.failure.image_bytes",
        data.imageBytesLength,
      );
    }
    if (data.userAgent) {
      span.setAttribute("pang.client.user_agent", data.userAgent);
    }
    if (data.timestamp) {
      span.setAttribute("pang.client.timestamp", data.timestamp);
    }
    if (data.viewport) {
      span.setAttribute("pang.client.viewport_w", data.viewport.w);
      span.setAttribute("pang.client.viewport_h", data.viewport.h);
    }
    if (data.online !== undefined && data.online !== null) {
      span.setAttribute("pang.client.online", data.online);
    }

    return new NextResponse(null, { status: 204 });
  });
}
