/**
 * Collector profile — Server Component shell.
 *
 * Fetches the collector by id and hands rendering to `CollectorClient`,
 * which gates the contact section based on the viewer's local
 * membership state. Pre-Auth that gate is best-effort (localStorage);
 * post-Auth it becomes an RLS-backed query against shared circles.
 */

import { notFound } from "next/navigation";
import { getCollectorById } from "@/lib/api/server";
import CollectorClient from "./CollectorClient";

export const dynamic = "force-dynamic";

export default async function CollectorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const { id } = await params;
  const { via } = await searchParams;

  const collector = getCollectorById(id);
  if (!collector) notFound();

  return <CollectorClient collector={collector} via={via} />;
}
