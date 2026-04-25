"use client";

/**
 * PANG — focused-work detail view (iter #23 art-directed visual layer).
 *
 * Full-screen takeover when a work is focused. Hinge / Glass register:
 * artwork is the hero, metadata is composition, one primary action
 * ("ask my gallery") is the entire CTA surface.
 *
 * Replaces iter #4's bottom-left panel. The panel pattern fought
 * for attention with the canvas; a full-screen detail is decisive
 * and gives the work the room it needs.
 *
 * Wires to:
 *   - `useWorks` for the focused entry + dismissal (`setFocusedId(null)`)
 *   - `<AskGallery>` for the existing verification primitive
 *   - Escape key dismissal; close button top-left
 */

import { useEffect, type ReactElement } from "react";
import { useWorks, type CollectionEntry } from "@/stores/works";
import { AskGallery } from "./AskGallery";
import { FOCUSED_WORK_LABEL } from "@/ai/verification/voice";

export function FocusedWorkPanel(): ReactElement | null {
  const focusedId = useWorks((s) => s.focusedId);
  const entries = useWorks((s) => s.entries);
  const activeViewer = useWorks((s) => s.activeViewer);
  const activeDeepZoom = useWorks((s) => s.activeDeepZoom);
  const setFocusedId = useWorks((s) => s.setFocusedId);

  const entry = focusedId ? entries.find((e) => e.id === focusedId) : null;
  const isOpen = entry !== null && entry !== undefined;
  // Don't claim Escape while a higher overlay (document viewer or
  // deep zoom) is up — let the inner-most surface dismiss itself
  // first. Same goes for body-scroll lock; the higher overlay
  // owns it. Iter #4's documents spec asserts this layering.
  const ownsEscape = isOpen && !activeViewer && !activeDeepZoom;

  useEffect(() => {
    if (!ownsEscape) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setFocusedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [ownsEscape, setFocusedId]);

  if (!entry) return null;
  return <Detail entry={entry} onClose={() => setFocusedId(null)} />;
}

function Detail(props: {
  readonly entry: CollectionEntry;
  readonly onClose: () => void;
}): ReactElement {
  const { entry, onClose } = props;
  const snap = entry.verificationHint?.artworkSnapshot;
  const artist = snap?.artist ?? null;
  const title = snap?.title ?? null;
  const year = snap?.year ?? null;
  const medium = snap?.medium ?? null;
  const dim = snap?.dimensionsCm ?? null;
  const galleryName = entry.verificationHint?.galleryNameHint ?? null;
  const verified = entry.status === "verified";
  const aspectRatio = entry.size[0] / entry.size[1];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label={FOCUSED_WORK_LABEL}
      data-testid="pang-focused-detail"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Image hero ------------------------------------------------ */}
      <div className="relative px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          data-testid="pang-focused-close"
          className="absolute left-6 top-6 z-10 grid h-10 w-10 place-items-center bg-paper/90 text-ink shadow-sm backdrop-blur-sm"
          style={{ borderRadius: "9999px" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>

        <div
          className="relative overflow-hidden bg-paper-5"
          style={{
            borderRadius: "var(--r-hero)",
            aspectRatio: `${aspectRatio}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.imageUrl}
            alt={
              artist && title
                ? `${title} by ${artist}`
                : title ?? "focused work"
            }
            className="block h-full w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: "1px",
              background: verified
                ? "var(--hairline-verified)"
                : "var(--hairline-pending)",
            }}
          />
        </div>
      </div>

      {/* Content ---------------------------------------------------- */}
      <div className="px-6 pb-24 pt-6">
        {artist || title ? (
          <header className="mb-6">
            {artist ? (
              <p
                className="mb-1 text-sm text-ink-muted"
                data-pang-source="intake"
              >
                {artist}
              </p>
            ) : null}
            {title ? (
              <h1
                className="text-balance text-2xl font-medium leading-tight text-ink"
                style={{ fontFamily: "var(--serif)" }}
                data-pang-source="intake"
              >
                {title}
                {year ? (
                  <span className="ml-2 text-base font-normal text-ink-muted">
                    , {year}
                  </span>
                ) : null}
              </h1>
            ) : null}
          </header>
        ) : null}

        {/* The one CTA */}
        <div className="mb-8">
          <AskGallery entry={entry} />
        </div>

        {/* Details — museum register, no marketing */}
        <section aria-label="artwork details" className="mb-6">
          <h2 className="mb-4 text-xs uppercase tracking-wider text-text-tertiary">
            details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {medium ? (
              <div>
                <dt className="mb-1 text-text-tertiary">medium</dt>
                <dd className="text-ink">{medium}</dd>
              </div>
            ) : null}
            {dim ? (
              <div>
                <dt className="mb-1 text-text-tertiary">dimensions</dt>
                <dd className="text-ink">
                  {dim.h} × {dim.w} cm
                </dd>
              </div>
            ) : null}
            {year ? (
              <div>
                <dt className="mb-1 text-text-tertiary">year</dt>
                <dd className="text-ink">{year}</dd>
              </div>
            ) : null}
            {galleryName ? (
              <div>
                <dt className="mb-1 text-text-tertiary">gallery</dt>
                <dd className="text-ink">{galleryName}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <span
            aria-hidden="true"
            className="block flex-1"
            style={{
              height: "1px",
              background: verified
                ? "var(--hairline-verified)"
                : "var(--hairline-pending)",
            }}
          />
          <span className="text-xs text-text-tertiary">
            {verified ? "verified" : "awaiting verification"}
          </span>
        </div>
      </div>
    </div>
  );
}
