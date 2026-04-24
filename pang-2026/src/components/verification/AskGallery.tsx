"use client";

/**
 * PANG — the ask-gallery affordance.
 *
 * The "one-tap ask my gallery" from the iteration #4 brief, extended
 * in iter #10 with the send-now chooser. Renders as a small DOM panel
 * that attaches to the focused work. Eight lifecycle states, one
 * surface:
 *
 *   none        → "ask my gallery" button. The primary affordance.
 *   requesting  → "sending the ask." — compact chip; no spinner.
 *   requested   → "the gallery has been asked." + send-now chooser.
 *                 Collector types the channel contact + taps email or
 *                 whatsapp. The server composes the message; the
 *                 collector's own mail/whatsapp client sends it.
 *   dispatched  → "the message is with the gallery." — ambient.
 *   confirmed   → "the gallery confirmed." — soft, warm tick.
 *   declined    → "the gallery did not confirm." — no apology.
 *   expired     → "the ask went quiet." — the 30d TTL elapsed.
 *   failed      → "the ask did not land." + "try again" — retry is a
 *                 fresh tap, not an automatic background nag.
 *
 * Voice doctrine is in `ASK_GALLERY` (`src/ai/chapter/voice.ts`);
 * every label on this surface comes from there. Museumsschild test:
 * each string could hang on a gallery wall without looking like an
 * app shouting at the user.
 *
 * Send-now is URL-handoff — PANG does not dispatch on the gallery's
 * behalf. The collector's mailto: / whatsapp: URL opens *their* client
 * and the message sends from their address. This keeps PANG off
 * inbox-provider deny lists and preserves the gallery's existing
 * relationship with the collector.
 *
 * The chip's action is idempotent — tapping twice during
 * `"requesting"` or `"requested"` does nothing (the store guards).
 *
 * Pre-submit edit: a small edit button opens an inline text field
 * pre-filled with the currently best-guess gallery identifier. The
 * collector's text replaces the free-text sidecar; the wire shape
 * accepts any one of the three identifiers. We never wipe id and
 * name — the server prefers them, and the free-text is the fallback.
 *
 * Chrome + container rule (P9): the button carries a 2px radius via
 * `style={{ borderRadius: "var(--r-chrome)" }}`; the enclosing panel
 * has no radius (containers are square). No emojis. Sentence case.
 */

import type { ReactElement } from "react";
import { useMemo, useRef, useState } from "react";
import { useVerification } from "@/stores/verification";
import {
  useWorks,
  type CollectionEntry,
  type VerificationHint,
} from "@/stores/works";
import {
  dispatchVerificationRequest,
  newRequestId,
  type VerificationRequest,
} from "@/verification";
import { probePushSupport, subscribeForOutcome } from "@/push";
import { ASK_GALLERY } from "@/ai/chapter/voice";

export interface AskGalleryProps {
  readonly entry: CollectionEntry;
}

export function AskGallery(props: AskGalleryProps): ReactElement | null {
  const { entry } = props;
  const hint = entry.verificationHint;
  const state = useVerification((s) => s.stateOf(entry.id));

  // Entries without a hint (legacy intake paths) don't surface the
  // affordance — a submit would fail the refinement on the wire.
  if (!hint) return null;

  if (state.kind === "confirmed") {
    return <Chip label={ASK_GALLERY.confirmed} tone="ink" />;
  }
  if (state.kind === "declined") {
    return <Chip label={ASK_GALLERY.declined} tone="ai" />;
  }
  if (state.kind === "expired") {
    return <Chip label={ASK_GALLERY.expired} tone="ai" />;
  }
  if (state.kind === "dispatched") {
    return <Chip label={ASK_GALLERY.dispatched} tone="ink" />;
  }
  if (state.kind === "requested") {
    return (
      <RequestedSurface
        entry={entry}
        hint={hint}
        requestId={state.requestId}
      />
    );
  }
  if (state.kind === "requesting") {
    return <Chip label={ASK_GALLERY.pending} tone="ai" />;
  }
  if (state.kind === "failed") {
    return <FailedChip entry={entry} hint={hint} />;
  }
  return <IdleAffordance entry={entry} hint={hint} />;
}

// ---------- Subcomponents ----------------------------------------

function IdleAffordance(props: {
  readonly entry: CollectionEntry;
  readonly hint: VerificationHint;
}): ReactElement {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      {editing ? (
        <GalleryEditor
          entry={props.entry}
          hint={props.hint}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <button
            type="button"
            className="border border-ink bg-ink px-4 py-2 text-sm text-paper"
            style={{ borderRadius: "var(--r-chrome)" }}
            onClick={() => {
              void submit(props.entry, props.hint);
            }}
          >
            {ASK_GALLERY.action}
          </button>
          <span className="text-xs text-ink-ai">
            {ASK_GALLERY.actionHint}
          </span>
          <button
            type="button"
            className="text-xs text-ink-ai underline underline-offset-2"
            onClick={() => setEditing(true)}
          >
            {ASK_GALLERY.edit}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * "requested" surface — the ambient chip plus a one-shot push-
 * subscribe offer. The offer appears only when:
 *
 *   - the environment supports push (probe returns `"supported"`)
 *   - the collector has not already decided (push decision is
 *     `"unoffered"`)
 *
 * Every other combination collapses to the chip alone. We never nag:
 * once the collector accepts, refuses, or the environment rules out
 * the feature, the offer never reappears for this work.
 */
function RequestedSurface(props: {
  readonly entry: CollectionEntry;
  readonly hint: VerificationHint;
  readonly requestId: string;
}): ReactElement {
  const pushDecision = useVerification((s) => s.pushOf(props.entry.id));
  const setPushDecision = useVerification((s) => s.setPushDecision);
  // `probePushSupport` is pure (no permission prompt), so calling it
  // during render is safe. We memoise per entry id to avoid re-reading
  // the VAPID env each tick; the probe's result is static for the
  // session.
  const support = useMemo(() => probePushSupport(), []);

  // A terminal unsupported decision gets latched into the store so a
  // refresh doesn't re-probe the same nope. The effect runs only when
  // decision is still "unoffered" and the environment is unsupported.
  if (
    pushDecision.kind === "unoffered" &&
    support.kind === "unsupported"
  ) {
    setPushDecision(props.entry.id, {
      kind: "unsupported",
      reason: support.reason,
    });
  }

  const canOffer =
    pushDecision.kind === "unoffered" && support.kind === "supported";

  return (
    <div className="flex flex-col items-start gap-2">
      <Chip label={ASK_GALLERY.requested} tone="ai" />
      <SendNowChooser
        entry={props.entry}
        requestId={props.requestId}
      />
      {canOffer && (
        <PushOffer
          entry={props.entry}
          hint={props.hint}
          onDecision={(d) => setPushDecision(props.entry.id, d)}
        />
      )}
      {pushDecision.kind === "granted" && (
        <span
          className="text-xs text-ink-ai"
          data-pang-source="voice-corpus"
        >
          {ASK_GALLERY.pushGranted}
        </span>
      )}
      {pushDecision.kind === "refused" && (
        <span
          className="text-xs text-ink-ai"
          data-pang-source="voice-corpus"
        >
          {ASK_GALLERY.pushDeclined}
        </span>
      )}
    </div>
  );
}

/**
 * The send-now chooser (iter #10). Rendered inside the `requested`
 * surface, lets the collector type the gallery's contact and tap
 * either "send by email" or "send by whatsapp". On tap the chooser
 * POSTs `/api/verification/dispatch`, receives a `channelUrl` (a
 * `mailto:` or `https://wa.me/...` URL), opens it so the collector's
 * own client takes over, and flips the verification store into
 * `"dispatched"` so the surface transitions to the ambient
 * "the message is with the gallery" chip.
 *
 * Contact input is a single free-text field because email and
 * WhatsApp share one affordance from the collector's point of view
 * ("this is how I reach my gallery") and the server branches on the
 * tap, not on a parsed channel. Validation is the server's job; the
 * `mailto:` / `wa.me` URL absorbs whatever the server returns.
 *
 * Zero-tap review (P25): if the server fails, the chooser stays on
 * screen with the typed contact preserved. No modal, no toast, no
 * apology — the ask affordance remains the next tap.
 */
function SendNowChooser(props: {
  readonly entry: CollectionEntry;
  readonly requestId: string;
}): ReactElement {
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const markDispatched = useVerification((s) => s.markDispatched);

  const submit = async (channel: "email" | "whatsapp"): Promise<void> => {
    const trimmed = contact.trim();
    if (trimmed.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/verification/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          version: "v1",
          requestId: props.requestId,
          channel,
          galleryContact: trimmed,
        }),
      });
      if (!res.ok) {
        setBusy(false);
        return;
      }
      const payload = (await res.json()) as {
        readonly channelUrl: string;
        readonly dispatchedAt: string;
      };
      // URL-handoff: open the collector's client. `<a>.click()` with
      // `target="_blank"` is the reliable path on iOS + Android PWAs;
      // `window.open` is pop-up-blocked after an async boundary in
      // some browsers, but an anchor element's click keeps the
      // user-gesture context through the await via the sync click.
      const a = document.createElement("a");
      a.href = payload.channelUrl;
      a.rel = "noopener";
      a.target = "_blank";
      // Safari-on-iOS treats `mailto:` / `wa.me` navigations as
      // cross-origin; opening in a new tab and letting the scheme
      // handler close it is the most reliable path. The anchor is
      // appended, clicked, and removed in one tick so the DOM stays
      // clean for assistive tech.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      markDispatched({
        workId: props.entry.id,
        dispatchedAt: payload.dispatchedAt,
        channel,
      });
    } catch {
      // Network error — stay on the chooser. The ask affordance
      // remains; the collector can tap again.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-xs text-ink-ai" data-pang-source="voice-corpus">
        {ASK_GALLERY.sendPrompt}
      </span>
      <input
        type="text"
        value={contact}
        maxLength={120}
        placeholder={ASK_GALLERY.editPlaceholder}
        className="border border-ink-ai bg-paper px-2 py-1 text-sm text-ink"
        style={{ borderRadius: "var(--r-chrome)" }}
        onChange={(e) => setContact(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || contact.trim().length === 0}
          className="border border-ink bg-ink px-3 py-1 text-sm text-paper disabled:opacity-50"
          style={{ borderRadius: "var(--r-chrome)" }}
          onClick={() => {
            void submit("email");
          }}
        >
          {ASK_GALLERY.sendEmail}
        </button>
        <button
          type="button"
          disabled={busy || contact.trim().length === 0}
          className="border border-ink-ai px-3 py-1 text-sm text-ink-ai disabled:opacity-50"
          style={{ borderRadius: "var(--r-chrome)" }}
          onClick={() => {
            void submit("whatsapp");
          }}
        >
          {ASK_GALLERY.sendWhatsApp}
        </button>
      </div>
    </div>
  );
}

/**
 * The push-subscribe offer. Two buttons: accept (`notify me`) and
 * dismiss (`not now`). Accept calls `subscribeForOutcome`, which
 * prompts for permission, subscribes, and POSTs — any failure mode
 * collapses to `kind: "refused"` so the chip fades to the museum
 * footer "the notification stays off."
 */
function PushOffer(props: {
  readonly entry: CollectionEntry;
  readonly hint: VerificationHint;
  readonly onDecision: (
    decision:
      | { kind: "granted"; storedAt: string }
      | { kind: "refused"; at: string }
      | { kind: "unsupported"; reason: string },
  ) => void;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-xs text-ink-ai" data-pang-source="voice-corpus">
        {ASK_GALLERY.pushOffer}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="border border-ink bg-ink px-3 py-1 text-sm text-paper disabled:opacity-50"
          style={{ borderRadius: "var(--r-chrome)" }}
          onClick={() => {
            setBusy(true);
            void (async () => {
              const request = buildRequest(props.entry, props.hint);
              const outcome = await subscribeForOutcome(request);
              if (outcome.kind === "granted") {
                props.onDecision({
                  kind: "granted",
                  storedAt: outcome.storedAt,
                });
              } else if (outcome.kind === "unsupported") {
                props.onDecision({
                  kind: "unsupported",
                  reason: outcome.reason,
                });
              } else {
                // "denied" and "error" both collapse to refused — we
                // do not surface a retry affordance because a failing
                // subscribe attempt would otherwise spin. A later
                // iteration may add a quiet "try again" behind a
                // long-press, but iteration #4 keeps the surface
                // monotonic.
                props.onDecision({
                  kind: "refused",
                  at: new Date().toISOString(),
                });
              }
              setBusy(false);
            })();
          }}
        >
          {ASK_GALLERY.pushAccept}
        </button>
        <button
          type="button"
          disabled={busy}
          className="text-xs text-ink-ai underline underline-offset-2 disabled:opacity-50"
          onClick={() => {
            props.onDecision({
              kind: "refused",
              at: new Date().toISOString(),
            });
          }}
        >
          {ASK_GALLERY.pushDismiss}
        </button>
      </div>
    </div>
  );
}

function FailedChip(props: {
  readonly entry: CollectionEntry;
  readonly hint: VerificationHint;
}): ReactElement {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm text-ink" data-pang-source="voice-corpus">
        {ASK_GALLERY.failed}
      </span>
      <button
        type="button"
        className="border border-ink-ai px-3 py-1 text-sm text-ink-ai"
        style={{ borderRadius: "var(--r-chrome)" }}
        onClick={() => {
          void submit(props.entry, props.hint);
        }}
      >
        {ASK_GALLERY.failedAction}
      </button>
    </div>
  );
}

function Chip(props: {
  readonly label: string;
  readonly tone: "ink" | "ai";
}): ReactElement {
  const tone = props.tone === "ink" ? "text-ink" : "text-ink-ai";
  return (
    <span className={`text-sm ${tone}`} data-pang-source="voice-corpus">
      {props.label}
    </span>
  );
}

function GalleryEditor(props: {
  readonly entry: CollectionEntry;
  readonly hint: VerificationHint;
  readonly onDone: () => void;
}): ReactElement {
  const updateHint = useWorks((s) => s.updateVerificationHint);
  const initial = useMemo(
    () =>
      props.hint.galleryFreeText ??
      props.hint.galleryNameHint ??
      props.hint.galleryIdHint ??
      "",
    [props.hint],
  );
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim().slice(0, 120);
        if (trimmed.length === 0) {
          props.onDone();
          return;
        }
        // Writing free-text replaces the hint side (we keep id + name
        // for server preference). An empty string is indistinguishable
        // from "no override", so we guard above.
        updateHint(props.entry.id, { galleryFreeText: trimmed });
        props.onDone();
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-ink-ai">
        {ASK_GALLERY.editLabel}
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={120}
          placeholder={ASK_GALLERY.editPlaceholder}
          className="border border-ink-ai bg-paper px-2 py-1 text-sm text-ink"
          style={{ borderRadius: "var(--r-chrome)" }}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="border border-ink bg-ink px-3 py-1 text-sm text-paper"
          style={{ borderRadius: "var(--r-chrome)" }}
        >
          {ASK_GALLERY.confirm}
        </button>
      </div>
    </form>
  );
}

// ---------- Submit helper ---------------------------------------

/**
 * Build a fresh `VerificationRequest` for (entry, hint). Extracted so
 * both the ask-submit flow and the push-subscribe flow can bind the
 * same request shape — the push subscription carries the same
 * `requestId` as the request itself, so the server dispatcher joins
 * them without a secondary index.
 *
 * The push-offer path only needs the request to tag the subscription
 * with `requestId` / `workId`; it does not re-submit the ask. The
 * ask-submit path dispatches the outbox + drain, see `submit` below.
 */
function buildRequest(
  entry: CollectionEntry,
  hint: VerificationHint,
): VerificationRequest {
  return {
    version: "v1",
    requestId: newRequestId(),
    workId: entry.id,
    galleryIdHint: hint.galleryIdHint,
    galleryNameHint: hint.galleryNameHint,
    galleryFreeText: hint.galleryFreeText,
    detectedFrom: hint.detectedFrom,
    artworkSnapshot: hint.artworkSnapshot,
    photoRef: hint.photoRef,
    capturedAt: hint.capturedAt,
    submittedAt: new Date().toISOString(),
  };
}

async function submit(
  entry: CollectionEntry,
  hint: VerificationHint,
): Promise<void> {
  await dispatchVerificationRequest(buildRequest(entry, hint));
}
