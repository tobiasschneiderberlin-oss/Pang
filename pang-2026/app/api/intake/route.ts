/**
 * PANG — /api/intake route.
 *
 * The one endpoint the scanner talks to. Receives a multipart body
 * with the rectified PNG + optional document + JSON metadata. Calls
 * `runIntakeAgent`. Returns the branded output (serialized without
 * the phantom brand).
 *
 * Edge runtime where possible — Anthropic SDK works under edge;
 * Node buffers do not, so the agent helper's base64 path uses a
 * pure-TS loop when `Buffer` is absent.
 *
 * The route emits a span at `pang.api.intake` that wraps the agent
 * span; the two roll up into one trace.
 */

import { NextResponse } from "next/server";
import {
  IntakeOutputSchema,
  IntakeRequestMetadataSchema,
} from "@/ai/tools/artwork";
import { runIntakeAgent } from "@/ai/agents/intake";
import {
  AgentContractError,
  acceptUser,
  BudgetExceededError,
  PANGTrustViolation,
  VoiceViolation,
  withOtelSpan,
} from "@/ai/agents/_shared";
import { brand } from "@/ai/camel/trust";

export const runtime = "nodejs";
// Route-level headers — the route handler echoes POST-only with a
// tight cache policy. Middleware at the edge applies rate limits
// (A11) before we even get here.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("pang.api.intake", async (span) => {
    span.setAttribute("http.method", "POST");
    span.setAttribute("http.route", "/api/intake");

    if (!process.env["ANTHROPIC_API_KEY"]) {
      span.setAttribute("pang.error.kind", "missing_api_key");
      return NextResponse.json(
        { error: "intake_unavailable" },
        { status: 503 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "bad_multipart" }, { status: 400 });
    }

    const metaJson = form.get("metadata");
    const image = form.get("image");
    const doc = form.get("document");

    if (typeof metaJson !== "string" || !(image instanceof Blob)) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Metadata validation — strict Zod; unknown keys fail.
    const metaParse = IntakeRequestMetadataSchema.safeParse(
      safeJsonParse(metaJson),
    );
    if (!metaParse.success) {
      span.setAttribute("pang.error.kind", "bad_metadata");
      return NextResponse.json(
        { error: "bad_metadata", detail: metaParse.error.flatten() },
        { status: 400 },
      );
    }
    const meta = metaParse.data;
    span.setAttribute("pang.capture.source", meta.source);

    // Camera captures send JPEG; file-picker paths may send PNG.
    // Both are accepted by Claude Vision. Any other type is rejected.
    if (image.type !== "image/png" && image.type !== "image/jpeg") {
      span.setAttribute("pang.error.kind", "bad_image_mime");
      return NextResponse.json(
        { error: "bad_image_mime" },
        { status: 415 },
      );
    }

    const imageBytes = new Uint8Array(await image.arrayBuffer());

    // Integrity check — the client's declared sha256 must match the
    // bytes. Keeps the OPFS → server path honest and catches the
    // truncated-upload case without a stored-blob round-trip.
    const actualSha = await sha256Hex(imageBytes);
    if (actualSha !== meta.imageSha256) {
      span.setAttribute("pang.error.kind", "image_sha_mismatch");
      return NextResponse.json(
        { error: "image_sha_mismatch" },
        { status: 422 },
      );
    }

    // Brand the image as 'user' (the user physically held the device).
    // mime comes from the validated metadata, not from image.type, so
    // both PNG and JPEG paths carry the correct media type through to
    // the Claude Vision call.
    const userImage = acceptUser({
      bytes: imageBytes,
      mime: meta.imageMime,
    });

    // Optional untrusted document body. Only text documents enter
    // the Q-LLM right now; binary PDFs are deferred to a worker-side
    // text extraction in iteration #4.
    const untrustedDoc =
      typeof doc === "string" && doc.length > 0
        ? brand({ text: doc }, "Q" as const)
        : undefined;

    // `exactOptionalPropertyTypes: true` forbids writing
    // `untrustedDoc: undefined`; we must omit the key entirely when
    // no document is present.
    const agentInput = untrustedDoc
      ? {
          image: userImage,
          untrustedDoc,
          captureMeta: {
            capturedAt: new Date().toISOString(),
            tier: "B" as const,
          },
        }
      : {
          image: userImage,
          captureMeta: {
            capturedAt: new Date().toISOString(),
            tier: "B" as const,
          },
        };

    try {
      const result = await runIntakeAgent(agentInput);
      if (result === null) {
        span.setAttribute("pang.agent.compensate", true);
        return NextResponse.json(
          { error: "agent_compensate" },
          { status: 503 },
        );
      }
      // Validate a second time against the *same* schema before
      // serializing. Paranoid but cheap; the A3 gate expects it.
      const safe = IntakeOutputSchema.parse(result);
      return NextResponse.json({ output: safe }, { status: 200 });
    } catch (err) {
      return handleError(err, span);
    }
  });
}

function handleError(
  err: unknown,
  span: { setAttribute(k: string, v: unknown): void },
): Response {
  if (err instanceof PANGTrustViolation) {
    span.setAttribute("pang.error.kind", "trust_violation");
    span.setAttribute("pang.trust.violation", true);
    return NextResponse.json({ error: "trust_violation" }, { status: 400 });
  }
  if (err instanceof VoiceViolation) {
    span.setAttribute("pang.error.kind", "voice_violation");
    return NextResponse.json({ error: "voice_violation" }, { status: 422 });
  }
  if (err instanceof BudgetExceededError) {
    span.setAttribute("pang.error.kind", "budget_exceeded");
    span.setAttribute("pang.budget.kind", err.kind);
    return NextResponse.json({ error: "budget_exceeded" }, { status: 429 });
  }
  if (err instanceof AgentContractError) {
    span.setAttribute("pang.error.kind", err.kind);
    if (err.kind === "max_retries_exhausted") {
      return NextResponse.json({ error: "agent_compensate" }, { status: 503 });
    }
    return NextResponse.json({ error: err.kind }, { status: 502 });
  }
  span.setAttribute("pang.error.kind", "unexpected");
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
