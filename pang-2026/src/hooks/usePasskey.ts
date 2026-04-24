"use client";

/**
 * PANG — usePasskey (iter #9).
 *
 * Client-side orchestration for the passkey ceremony. Thin wrapper
 * around `@simplewebauthn/browser`; owns the fetch / startRegistration /
 * verify round-trip and the conditional-UI assertion loop.
 *
 * The hook is state-free by design — the invite landing page holds
 * the `phase` state; this hook provides the commands.
 */

import { useCallback } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

export type PasskeyEnrollError =
  | "no-bind"
  | "not-supported"
  | "user-cancelled"
  | "options-failed"
  | "enroll-failed"
  | "network";

export type PasskeyAssertError =
  | "not-supported"
  | "user-cancelled"
  | "options-failed"
  | "assert-failed"
  | "network";

export interface UsePasskeyApi {
  readonly supported: boolean;
  readonly enroll: () => Promise<
    | { ok: true; userId: string }
    | { ok: false; reason: PasskeyEnrollError; status?: number }
  >;
  readonly assert: (options: { conditional?: boolean }) => Promise<
    | { ok: true; userId: string }
    | { ok: false; reason: PasskeyAssertError; status?: number }
  >;
}

export function usePasskey(): UsePasskeyApi {
  const supported = typeof window !== "undefined" && browserSupportsWebAuthn();

  const enroll = useCallback<UsePasskeyApi["enroll"]>(async () => {
    if (!browserSupportsWebAuthn()) {
      return { ok: false, reason: "not-supported" as const };
    }

    let optionsRes: Response;
    try {
      optionsRes = await fetch("/api/auth/passkey/options?purpose=enroll", {
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      return { ok: false, reason: "network" as const };
    }
    if (optionsRes.status === 401) {
      return { ok: false, reason: "no-bind" as const, status: 401 };
    }
    if (!optionsRes.ok) {
      return { ok: false, reason: "options-failed" as const, status: optionsRes.status };
    }
    const options = (await optionsRes.json()) as Parameters<typeof startRegistration>[0]["optionsJSON"];

    let response: Awaited<ReturnType<typeof startRegistration>>;
    try {
      response = await startRegistration({ optionsJSON: options });
    } catch (err) {
      // Common cases: user cancelled, device has no authenticator.
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || /cancel/i.test(err.message)) {
          return { ok: false, reason: "user-cancelled" as const };
        }
        if (err.name === "NotSupportedError") {
          return { ok: false, reason: "not-supported" as const };
        }
      }
      return { ok: false, reason: "enroll-failed" as const };
    }

    let submitRes: Response;
    try {
      submitRes = await fetch("/api/auth/passkey/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(response),
      });
    } catch {
      return { ok: false, reason: "network" as const };
    }
    if (!submitRes.ok) {
      return { ok: false, reason: "enroll-failed" as const, status: submitRes.status };
    }
    const data = (await submitRes.json()) as { userId: string };
    return { ok: true, userId: data.userId };
  }, []);

  const assert = useCallback<UsePasskeyApi["assert"]>(async ({ conditional = false }) => {
    if (!browserSupportsWebAuthn()) {
      return { ok: false, reason: "not-supported" as const };
    }

    let optionsRes: Response;
    try {
      optionsRes = await fetch("/api/auth/passkey/options?purpose=assert", {
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      return { ok: false, reason: "network" as const };
    }
    if (!optionsRes.ok) {
      return { ok: false, reason: "options-failed" as const, status: optionsRes.status };
    }
    const options = (await optionsRes.json()) as Parameters<typeof startAuthentication>[0]["optionsJSON"];

    let response: Awaited<ReturnType<typeof startAuthentication>>;
    try {
      response = await startAuthentication({
        optionsJSON: options,
        useBrowserAutofill: conditional,
      });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || /cancel/i.test(err.message)) {
          return { ok: false, reason: "user-cancelled" as const };
        }
        if (err.name === "NotSupportedError") {
          return { ok: false, reason: "not-supported" as const };
        }
      }
      return { ok: false, reason: "assert-failed" as const };
    }

    let submitRes: Response;
    try {
      submitRes = await fetch("/api/auth/passkey/assert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(response),
      });
    } catch {
      return { ok: false, reason: "network" as const };
    }
    if (!submitRes.ok) {
      return { ok: false, reason: "assert-failed" as const, status: submitRes.status };
    }
    const data = (await submitRes.json()) as { userId: string };
    return { ok: true, userId: data.userId };
  }, []);

  return { supported, enroll, assert };
}
