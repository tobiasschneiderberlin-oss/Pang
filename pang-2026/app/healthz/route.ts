/**
 * PANG — health check.
 *
 * Used by uptime monitoring (outside the app) and by the gate runner
 * to confirm the build serves. Returns a plaintext "ok" — no JSON,
 * no version, no leakage.
 */

export const dynamic = "force-static";

export function GET(): Response {
  return new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
