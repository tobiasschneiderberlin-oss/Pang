/**
 * PANG — client failure beacon (app-wide).
 *
 * Fire-and-forget telemetry. The voice corpus across the app is
 * deliberately vague (Museumsschild register); Vercel function logs
 * need the *actual* diagnostic text so debugging on real devices
 * doesn't collapse back into try-and-error. This module is the only
 * client-side call site that posts to `/api/telemetry`.
 *
 * Scope: the whole app, not just /scan. Call `reportFailure()` from
 * any surface that can fail — the scanner, the Room, persistence,
 * intake review, arrival, auth. `installGlobalErrorBeacons()` wires
 * `window.onerror` + `onunhandledrejection` so anything that escapes
 * a try/catch still leaves a server-side trace.
 *
 * Rules:
 *   - Metadata only. No image bytes, no document text, no user copy.
 *   - `navigator.sendBeacon` first (survives page unload / nav), with
 *     a `fetch` fallback for the Safari cases where sendBeacon refuses
 *     JSON payloads. Neither path blocks the caller.
 *   - Never throws. A failed telemetry post must not turn into a
 *     second visible failure.
 *
 * Iteration #1, Tier 1 of the testing discipline upgrade
 * (2026-04-23). Paired with remote `chrome://inspect` debugging on
 * real devices.
 */

/** Which surface the failure came from. Loose by design — the value
 *  is an observability tag, not a privilege. `unknown` is always
 *  valid. New surfaces add a string; they do not touch the server
 *  schema as long as the string is under 32 chars. */
export type FailureStage =
  | "viewfinder"
  | "uploading"
  | "review"
  | "arrival"
  | "room"
  | "boot"
  | "persist"
  | "worker"
  | "global"
  | "unknown";

export interface FailureTelemetry {
  /** Voice-keyed failure (same key used by `failure.ts`) — or any
   *  short string identifying the class of failure for non-scan
   *  surfaces (`storage/quota`, `room/gl-lost`, etc.). */
  readonly errorKey: string;
  /** Free-form diagnostic text. Error `.message`, HTTP status text,
   *  worker crash message. Bounded to 1 kB server-side. */
  readonly detail?: string;
  /** Which surface the failure came from. */
  readonly stage: FailureStage;
  /** HTTP status code if the failure came from an HTTP response. */
  readonly uploadStatus?: number;
  /** Size of the image the client tried to send, if known. */
  readonly imageBytesLength?: number;
  /** Freeform string identifying the call site
   *  (e.g. `scan/offline-precheck`, `room/webgpu-init`). */
  readonly site?: string;
}

let globalsInstalled = false;

/**
 * Post a failure beacon. Never throws. Returns immediately; the wire
 * call happens asynchronously.
 */
export function reportFailure(payload: FailureTelemetry): void {
  try {
    const body = JSON.stringify({
      ...payload,
      // Client-declared, observability only. The server does not
      // trust this for any access decision.
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
      viewport:
        typeof window !== "undefined"
          ? { w: window.innerWidth, h: window.innerHeight }
          : null,
      online:
        typeof navigator !== "undefined" ? navigator.onLine : null,
    });

    const endpoint = "/api/telemetry";

    // sendBeacon is the right tool here: fire-and-forget, survives
    // page unload, and Chrome will keep it queued while the tab
    // transitions through a View Transition. It needs a Blob with
    // the correct Content-Type for servers that reject form bodies.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return;
      // Fall through to fetch on refusal — some browsers reject
      // non-CORS-simple Content-Types from sendBeacon.
    }

    // Fetch fallback. `keepalive: true` is the spec cousin of
    // sendBeacon and behaves the same way on unload.
    if (typeof fetch === "function") {
      void fetch(endpoint, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {
        // Swallow — telemetry must never cause visible failures.
      });
    }
  } catch {
    // Serialization / env edge cases. Intentionally silent.
  }
}

/**
 * Wire `window.onerror` + `window.onunhandledrejection` so any error
 * that escapes a try/catch still leaves a server-side trace.
 * Idempotent: safe to call from multiple entry points.
 */
export function installGlobalErrorBeacons(): void {
  if (globalsInstalled) return;
  if (typeof window === "undefined") return;
  globalsInstalled = true;

  window.addEventListener("error", (event) => {
    const err = event.error;
    reportFailure({
      errorKey: "global/error",
      stage: "global",
      detail: formatError(err, event.message, event.filename, event.lineno),
      site: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportFailure({
      errorKey: "global/unhandled-rejection",
      stage: "global",
      detail: formatError(event.reason),
      site: "window.onunhandledrejection",
    });
  });
}

function formatError(
  err: unknown,
  fallbackMessage?: string,
  filename?: string,
  lineno?: number,
): string {
  if (err instanceof Error) {
    const stack = err.stack ?? "";
    return `${err.name}: ${err.message}${stack ? `\n${stack}` : ""}`.slice(
      0,
      1024,
    );
  }
  if (typeof err === "string") return err.slice(0, 1024);
  const where = filename ? ` @ ${filename}:${lineno ?? "?"}` : "";
  return `${fallbackMessage ?? String(err)}${where}`.slice(0, 1024);
}
