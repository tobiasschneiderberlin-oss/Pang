/**
 * PANG — invite landing (iter #9).
 *
 * Route: `/i/:token`. This is the URL the gallery shares.
 *
 * Flow:
 *   1. Server-side validate the token shape (cheap short-circuit).
 *   2. Render a client component that binds the token and runs the
 *      passkey enroll ceremony in one screen.
 *
 * The ceremony is the whole route. There is no confirmation sheet,
 * no "welcome" paragraph. If the user already has a session cookie,
 * the client component redirects into the Room without calling bind
 * (a re-visit of the invite link after enrollment is a no-op).
 */

import type { ReactElement } from "react";
import { InviteLandingClient } from "./InviteLandingClient";

export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

// JWT shape check — three base64url segments separated by dots. Keeps
// obvious garbage out of the bind route. Real verification is
// server-side in the bind handler.
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export default async function InviteLanding({
  params,
}: InvitePageProps): Promise<ReactElement> {
  const { token } = await params;
  if (!JWT_SHAPE.test(token) || token.length > 2048) {
    // No server-side redirect — the client handles the "invite
    // didn't work" state with a voice-compliant line.
    return <InviteLandingClient token="" malformed />;
  }
  return <InviteLandingClient token={token} />;
}
