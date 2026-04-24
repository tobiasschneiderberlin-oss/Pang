/**
 * PANG — gallery confirm landing (iter #10).
 *
 * Route: `/g/confirm/:token`. The gallery's registrar opens the email,
 * clicks "confirm", lands here. One button: "Confirm this work is from
 * our gallery." A single tap POSTs to `/api/verification/confirm`; the
 * server writes the outcome.
 *
 * Design:
 *   - No branding chrome. This is a plain, quiet page — the gallery is
 *     a busy registrar; PANG's identity is not interesting here.
 *   - No login, no session, no cookies. The signed link IS the auth;
 *     the server verifies it.
 *   - Server component does the cheap shape check; client component
 *     owns the POST + state.
 *   - A GET does not mutate. The one-button form POSTs. Inbox-
 *     provider link-safety scanners never trigger the write.
 */

import type { ReactElement } from "react";
import { GalleryOutcomeClient } from "../../_components/GalleryOutcomeClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export default async function ConfirmPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { token } = await params;
  if (!JWT_SHAPE.test(token) || token.length > 2048) {
    return <GalleryOutcomeClient token="" action="confirm" malformed />;
  }
  return <GalleryOutcomeClient token={token} action="confirm" />;
}
