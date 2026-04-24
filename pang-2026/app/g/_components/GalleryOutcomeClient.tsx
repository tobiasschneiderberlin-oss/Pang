"use client";

/**
 * PANG — gallery outcome client (iter #10).
 *
 * Shared renderer for the confirm + decline landing pages. A single
 * button POSTs the signed token to the matching server route. Three
 * states render:
 *
 *   - ready      — button visible, tap to commit.
 *   - posting    — disabled button, quiet status line.
 *   - done       — the outcome was recorded.
 *   - already    — the server returned `dedup: true`; the click was
 *                  a replay; the outcome stands.
 *   - expired    — the 30-day TTL elapsed; the link no longer works.
 *   - invalid    — the token didn't verify (wrong audience, bad-jwt).
 *
 * Voice:
 *   - Sentence case; no marketing; no first-person; no emoji.
 *   - A confirm reads as a factual acknowledgement, not a celebration.
 *   - A decline reads as "this is recorded", not an apology or a
 *     request for a reason.
 */

import { useCallback, useState, type ReactElement } from "react";

type Phase =
  | "ready"
  | "malformed"
  | "posting"
  | "done"
  | "already"
  | "expired"
  | "invalid";

interface Props {
  readonly token: string;
  readonly action: "confirm" | "decline";
  readonly malformed?: boolean;
}

export function GalleryOutcomeClient({
  token,
  action,
  malformed = false,
}: Props): ReactElement {
  const [phase, setPhase] = useState<Phase>(malformed ? "malformed" : "ready");

  const onSubmit = useCallback(async () => {
    setPhase("posting");
    try {
      const res = await fetch(`/api/verification/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 410) {
        setPhase("expired");
        return;
      }
      if (res.status === 401) {
        setPhase("invalid");
        return;
      }
      if (!res.ok) {
        setPhase("invalid");
        return;
      }
      const json = (await res.json()) as { ok: boolean; dedup?: boolean };
      setPhase(json.dedup ? "already" : "done");
    } catch {
      setPhase("invalid");
    }
  }, [token, action]);

  return (
    <main className="gallery-outcome">
      <section>
        <h1>
          {action === "confirm"
            ? "Confirm this work is from your gallery."
            : "Decline this verification."}
        </h1>
        <Body action={action} phase={phase} onSubmit={onSubmit} />
      </section>
    </main>
  );
}

function Body({
  action,
  phase,
  onSubmit,
}: {
  action: "confirm" | "decline";
  phase: Phase;
  onSubmit: () => void;
}): ReactElement {
  if (phase === "malformed") {
    return (
      <p>This link is not valid. It may have been mis-typed or cut short.</p>
    );
  }
  if (phase === "expired") {
    return (
      <p>
        This link has expired. The collector will need to send a fresh
        request.
      </p>
    );
  }
  if (phase === "invalid") {
    return (
      <p>
        This link did not verify. It may be for the other answer, or it
        may have been tampered with.
      </p>
    );
  }
  if (phase === "done") {
    return (
      <p>
        {action === "confirm"
          ? "Recorded. The collector will see the confirmation."
          : "Recorded. The collector will see that this was not verified."}
      </p>
    );
  }
  if (phase === "already") {
    return (
      <p>
        This was already {action === "confirm" ? "confirmed" : "declined"}.
        Nothing more to do.
      </p>
    );
  }
  if (phase === "posting") {
    return <p>One moment.</p>;
  }
  // Ready.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <button type="submit">
        {action === "confirm"
          ? "Confirm this work"
          : "Decline this verification"}
      </button>
    </form>
  );
}
