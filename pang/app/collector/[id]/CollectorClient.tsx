"use client";

/**
 * Collector profile (read-only).
 *
 * Renders identity + stats unconditionally; contact details are gated
 * behind a "shared circle" check. The client knows two things that
 * the gate composes:
 *
 *   1. Which artist circles the viewer has joined (from
 *      useCircleMembership → localStorage).
 *   2. Which artist circles the target collector belongs to (computed
 *      against the deterministic mock via `isCollectorInArtistCircle`,
 *      walked over the viewer's joined set — so we never leak the
 *      collector's full circle membership; we only test for overlap).
 *
 * Contact is shown iff the intersection is non-empty.
 *
 * The optional `via` prop is a soft hint of "this is the artist circle
 * you came from" — used purely to give a friendlier "shared via X"
 * label, never as a security claim. The real gate is the localStorage
 * intersection.
 */

import Link from "next/link";
import { ChevronLeft, Instagram, Linkedin, Mail, Phone, Globe } from "lucide-react";
import type { Collector } from "@/lib/api";
import { useCircleMembership } from "@/hooks/use-circle-membership";
import { isCollectorInArtistCircle } from "@/lib/api/collectors";

export default function CollectorClient({
  collector,
  via,
}: {
  collector: Collector;
  via?: string;
}) {
  const { joined } = useCircleMembership();

  // Trust gate. The viewer must share at least one circle with the
  // target — i.e. there's some artist whose circle they both belong to.
  const sharedCircle = [...joined].some((artistId) =>
    isCollectorInArtistCircle(collector.id, artistId),
  );

  const stats = [
    collector.collectingSince ? `Collecting since ${collector.collectingSince}` : null,
    collector.worksCount ? `${collector.worksCount} works` : null,
    collector.artistsCount ? `${collector.artistsCount} artists` : null,
  ].filter(Boolean);

  return (
    <main className="min-h-dvh bg-background pb-12">
      {/* Top bar — back is a hint, the source page is whatever the
          router stack remembers; we don't hardcode a destination. */}
      <header className="px-4 pt-4 pb-2 safe-area-inset-top">
        <Link
          href={via ? `/artist/${via}` : "/collection"}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted/30 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </Link>
      </header>

      <div className="px-6 pt-4">
        {/* Identity */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-xl font-semibold mb-3">
            {collector.initials}
          </div>
          <h1 className="text-2xl font-semibold">{collector.name}</h1>
          {collector.location && (
            <p className="text-sm text-muted-foreground mt-1">{collector.location}</p>
          )}
          {stats.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {stats.join(" · ")}
            </p>
          )}
        </div>

        {/* Contact section. Gated by the shared-circle check above.
            When hidden, we tell the viewer why — silence would feel
            like a missing feature. */}
        <section className="mt-10">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Connect
          </h2>

          {!sharedCircle && (
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-2xl p-4 leading-relaxed">
              Contact details are visible only to collectors who share
              a Circle with {collector.name.split(" ")[0]}. Join an
              artist circle you both belong to and they'll appear here.
            </p>
          )}

          {sharedCircle && !collector.contact && (
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-2xl p-4 leading-relaxed">
              {collector.name.split(" ")[0]} hasn't shared any contact
              details yet.
            </p>
          )}

          {sharedCircle && collector.contact && (
            <ul className="space-y-2">
              {collector.contact.instagram && (
                <ContactRow
                  icon={<Instagram size={18} className="text-muted-foreground" />}
                  label="Instagram"
                  value={`@${collector.contact.instagram.replace(/^@/, "")}`}
                  href={`https://instagram.com/${collector.contact.instagram.replace(/^@/, "")}`}
                />
              )}
              {collector.contact.linkedin && (
                <ContactRow
                  icon={<Linkedin size={18} className="text-muted-foreground" />}
                  label="LinkedIn"
                  value={collector.contact.linkedin}
                  href={`https://linkedin.com/in/${collector.contact.linkedin}`}
                />
              )}
              {collector.contact.email && (
                <ContactRow
                  icon={<Mail size={18} className="text-muted-foreground" />}
                  label="Email"
                  value={collector.contact.email}
                  href={`mailto:${collector.contact.email}`}
                />
              )}
              {collector.contact.phone && (
                <ContactRow
                  icon={<Phone size={18} className="text-muted-foreground" />}
                  label="Phone"
                  value={collector.contact.phone}
                  href={`tel:${collector.contact.phone.replace(/\s+/g, "")}`}
                />
              )}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <li>
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 rounded-xl p-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </a>
    </li>
  );
}
