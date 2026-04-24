/**
 * PANG — gallery decline landing (iter #10).
 *
 * Mirror of `/g/confirm/:token`. One button: "Decline this verification."
 * The decline carries no reason; the collector never sees one, by
 * voice doctrine. A decline is a quiet final answer.
 */

import type { ReactElement } from "react";
import { GalleryOutcomeClient } from "../../_components/GalleryOutcomeClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export default async function DeclinePage({
  params,
}: PageProps): Promise<ReactElement> {
  const { token } = await params;
  if (!JWT_SHAPE.test(token) || token.length > 2048) {
    return <GalleryOutcomeClient token="" action="decline" malformed />;
  }
  return <GalleryOutcomeClient token={token} action="decline" />;
}
