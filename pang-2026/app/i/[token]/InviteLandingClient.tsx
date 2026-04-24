"use client";

/**
 * PANG — invite landing client (iter #9).
 *
 * One screen. One voice-compliant line. One system passkey sheet.
 * If the collector already has a session, redirect to The Room
 * without running the ceremony. If the invite was forwarded (already
 * consumed), the state shows a quiet line and stops.
 */

import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { usePasskey } from "@/hooks/usePasskey";
import { INVITE_LANDING_LABEL } from "@/ai/invite/voice";

type Phase =
  | "checking"
  | "ready"
  | "enrolling"
  | "enrolled"
  | "malformed"
  | "invite-bad"
  | "invite-replayed"
  | "not-supported"
  | "cancelled"
  | "error";

interface Props {
  readonly token: string;
  readonly malformed?: boolean;
}

interface BindReply {
  readonly userId: string;
  readonly userHandle: string;
  readonly galleryId: string;
}

export function InviteLandingClient({
  token,
  malformed = false,
}: Props): ReactElement {
  const router = useRouter();
  const passkey = usePasskey();
  const [phase, setPhase] = useState<Phase>(malformed ? "malformed" : "checking");

  // On mount: if a session cookie is already live, skip the ceremony.
  // Otherwise call /bind to open the bind session + kick off enroll.
  useEffect(() => {
    if (malformed) return;
    let cancelled = false;
    void (async () => {
      try {
        const existing = await fetch("/api/auth/session", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled) return;
        if (existing.ok) {
          router.replace("/");
          return;
        }

        const bindRes = await fetch("/api/auth/invite/bind", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (bindRes.status === 409) {
          setPhase("invite-replayed");
          return;
        }
        if (!bindRes.ok) {
          setPhase("invite-bad");
          return;
        }
        // Cast narrow — we don't show the reply.
        (await bindRes.json()) as BindReply;
        if (!passkey.supported) {
          setPhase("not-supported");
          return;
        }
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [malformed, passkey.supported, router, token]);

  const onEnroll = useCallback(async (): Promise<void> => {
    setPhase("enrolling");
    const result = await passkey.enroll();
    if (result.ok) {
      setPhase("enrolled");
      router.replace("/");
      return;
    }
    if (result.reason === "user-cancelled") {
      setPhase("cancelled");
      return;
    }
    if (result.reason === "not-supported") {
      setPhase("not-supported");
      return;
    }
    setPhase("error");
  }, [passkey, router]);

  // One line. Sentence case. No banned vocabulary.
  const line =
    phase === "malformed" || phase === "invite-bad"
      ? "This invite is not valid."
      : phase === "invite-replayed"
        ? "This invite has been used."
        : phase === "not-supported"
          ? "This device cannot hold a passkey yet."
          : phase === "cancelled"
            ? "The passkey step was cancelled. Try again."
            : phase === "error"
              ? "Something went wrong. Try the link again."
              : phase === "enrolling"
                ? "Waiting for the passkey."
                : phase === "enrolled"
                  ? "This collection is now on your device."
                  : phase === "ready"
                    ? "This collection is about to open on your device."
                    : "";

  const canRetry =
    phase === "ready" ||
    phase === "cancelled" ||
    phase === "error";

  return (
    <main
      aria-label={INVITE_LANDING_LABEL}
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--serif)",
      }}
    >
      <section
        style={{
          maxWidth: 28 * 16,
          textAlign: "center",
          display: "grid",
          gap: "1.5rem",
        }}
      >
        <p style={{ fontSize: "1.5rem", lineHeight: 1.35 }}>{line}</p>
        {canRetry ? (
          <button
            type="button"
            onClick={onEnroll}
            data-testid="invite-enroll"
            style={{
              alignSelf: "center",
              padding: "0.75rem 1.5rem",
              border: "2px solid currentColor",
              borderRadius: 2,
              background: "transparent",
              color: "inherit",
              fontFamily: "inherit",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            {phase === "cancelled" || phase === "error"
              ? "Try again"
              : "Create passkey"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
