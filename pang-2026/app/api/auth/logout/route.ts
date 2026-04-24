/**
 * PANG — /api/auth/logout (iter #9).
 *
 * Clears the session cookie + deletes the server-side record.
 * Returns 204 regardless — logging out is idempotent.
 */

import { withOtelSpan } from "@/lib/otel/span";
import { revokeSession } from "@/auth/server/session";
import { SESSION_COOKIE_NAME } from "@/auth/config";
import { cookies } from "next/headers";
import {
  clientIpFromRequest,
  consumeRateLimit,
} from "@/auth/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withOtelSpan("auth.logout", async () => {
    const ip = clientIpFromRequest(request);
    const limit = await consumeRateLimit("auth.logout", ip);
    if (!limit.allowed) {
      return new Response(null, { status: 429 });
    }

    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await revokeSession(token);
    }
    return new Response(null, { status: 204 });
  });
}
