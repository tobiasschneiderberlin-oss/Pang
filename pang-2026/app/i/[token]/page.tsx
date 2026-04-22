/**
 * PANG — invite landing.
 *
 * Route: `/i/:token`. This is the URL the gallery shares. The landing
 * validates the token server-side, sets the session cookie, and
 * redirects into The Room. The arrival ceremony (Primitive §6 View
 * Transitions) plays on the next navigation, not here — so the token
 * can be invalidated without leaving a half-ceremony on screen.
 *
 * Iteration #0 ships the shell and the redirect only. Token
 * validation against Supabase lands with the intake agent (iteration
 * #1) because the two share an auth surface.
 */

import { redirect } from "next/navigation";
import type { ReactElement } from "react";

export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteLanding({
  params,
}: InvitePageProps): Promise<ReactElement> {
  const { token } = await params;

  // Placeholder validation. Iteration #1 wires Supabase RLS + passkey
  // enrollment here. For the scaffold we simply gate on token shape.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    redirect("/");
  }

  // TODO(iteration-1): exchange token → session, enroll passkey,
  // then redirect. For now the redirect is the whole route.
  redirect("/");
}
