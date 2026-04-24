"use client";

/**
 * PANG — /scan route.
 *
 * The single entry point for intake. Four states:
 *
 *   viewfinder → uploading → review → arrival
 *
 * plus a terminal `failed` branch that pulls a voice-authored line
 * from the `failure.ts` corpus. The router here is dumb — it owns
 * the state machine and lets each child surface do its thing. No
 * toasts, no progress bars — the transitions *are* the feedback.
 *
 * Failure routing is keyed, not message-based: the Viewfinder emits
 * a `FailureKey`, the upload path maps HTTP status through
 * `keyFromUploadStatus`, and the failed-state screen renders the
 * corpus line for that key. No hand-authored "could not read the
 * work" — the voice doctrine's § *Failure prose* is the source.
 */

import { useCallback, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Viewfinder } from "@/components/scanner/Viewfinder";
import { IntakeReview } from "@/components/intake/IntakeReview";
import { ArrivalChapter } from "@/components/intake/ArrivalChapter";
import type { IntakeOutput } from "@/ai/tools/artwork";
import {
  failureLine,
  keyFromUploadStatus,
  type FailureKey,
} from "@/ai/prompts/failure";
import { reportFailure } from "@/lib/telemetry/beacon";
import { useSurfaceClaim } from "@/stores/use-surface-claim";
import { SCAN_STAGE } from "@/ai/intake/voice";

type Stage =
  | { kind: "viewfinder" }
  | { kind: "uploading"; blobUrl: string }
  | {
      kind: "review";
      output: IntakeOutput;
      blobUrl: string;
    }
  | { kind: "arrival"; output: IntakeOutput; blobUrl: string }
  | { kind: "failed"; failureKey: FailureKey };

export default function ScanPage(): ReactElement {
  const [stage, setStage] = useState<Stage>({ kind: "viewfinder" });
  const router = useRouter();

  // Iteration #11 — claim the "scan" surface for the duration of
  // this route. The outcome chapter mount gates on Room-active; an
  // incoming confirmation while the collector is in the middle of
  // an intake queues and fires on the next Room entry instead of
  // stomping the arrival chapter.
  useSurfaceClaim("scan");

  const onCapture = useCallback(async (bytes: Uint8Array, sha: string) => {
    // TS 5.7 narrows `Uint8Array<ArrayBufferLike>` out of `BlobPart`.
    // Cast at the boundary — the bytes were produced by our own
    // capture helper and are always ArrayBuffer-backed.
    // Camera captures use JPEG to stay under Vercel's 4.5 MB serverless
    // body limit. PNG of a real 1920×1080 camera frame can reach 4–6 MB.
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: "image/jpeg",
    });
    const blobUrl = URL.createObjectURL(blob);
    setStage({ kind: "uploading", blobUrl });

    // Offline check first — cheap and unambiguous. `navigator.onLine`
    // is only definitive when false; true still means "could fail on
    // the next hop". The AbortController below handles that case.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      reportFailure({
        errorKey: "upload/offline",
        stage: "uploading",
        site: "scan/offline-precheck",
        imageBytesLength: bytes.byteLength,
      });
      setStage({ kind: "failed", failureKey: "upload/offline" });
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Budget: 30s. Claude Vision intake typically lands in 6–12s on
    // broadband; a stalled pipeline on cellular should surface as a
    // named failure long before the OS-level socket timeout (minutes).
    // 30s is generous enough to cover a tail-case re-enrichment round
    // without inviting the thumb-drum-fingers zone.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const form = new FormData();
      form.set(
        "metadata",
        JSON.stringify({
          imageRef: `intake/staged/${sha}.jpg`,
          imageMime: "image/jpeg",
          imageSha256: sha,
          source: "camera",
          documents: [],
        }),
      );
      form.set("image", blob, `${sha}.jpg`);

      const response = await fetch("/api/intake", {
        method: "POST",
        body: form,
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        // 422 → agent/refused (the model ran, the output failed
        // validation); 5xx → agent/unreachable; 4xx → upload/rejected.
        // Full mapping lives in `keyFromUploadStatus`.
        const failureKey = keyFromUploadStatus(response.status);
        // Pull the server's error body for the beacon — voice corpus
        // hides it from Laura on purpose; we need it in the logs.
        let serverDetail = "";
        try {
          const text = await response.text();
          serverDetail = text.slice(0, 512);
        } catch {
          // Body already consumed or unreadable — the status is enough.
        }
        reportFailure({
          errorKey: failureKey,
          stage: "uploading",
          site: "scan/response-not-ok",
          uploadStatus: response.status,
          imageBytesLength: bytes.byteLength,
          detail: `${response.status} ${response.statusText}${serverDetail ? ` — ${serverDetail}` : ""}`,
        });
        setStage({ kind: "failed", failureKey });
        URL.revokeObjectURL(blobUrl);
        return;
      }
      const { output } = (await response.json()) as { output: IntakeOutput };
      // View Transitions — animate from viewfinder to review.
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (
          document as Document & {
            startViewTransition: (fn: () => void) => void;
          }
        ).startViewTransition(() => {
          setStage({ kind: "review", output, blobUrl });
        });
      } else {
        setStage({ kind: "review", output, blobUrl });
      }
    } catch (err) {
      // Three reasons fetch() throws here: (1) AbortError after the
      // 30s budget elapsed — classify as upload/timeout (the record
      // did not arrive; we can't know whether it was the wire or the
      // reading room); (2) TypeError "Failed to fetch" on dropped
      // connection — upload/offline; (3) anything else — conservative
      // upload/offline. The corpus line observes, doesn't accuse;
      // specificity is for telemetry, not copy.
      const key: FailureKey =
        err instanceof DOMException && err.name === "AbortError"
          ? "upload/timeout"
          : "upload/offline";
      const detail =
        err instanceof Error
          ? `${err.name}: ${err.message}`
          : String(err).slice(0, 512);
      reportFailure({
        errorKey: key,
        stage: "uploading",
        site: "scan/fetch-catch",
        imageBytesLength: bytes.byteLength,
        detail,
      });
      setStage({ kind: "failed", failureKey: key });
      URL.revokeObjectURL(blobUrl);
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const onAddToWall = useCallback(
    (edited: IntakeOutput) => {
      if (stage.kind !== "review") return;
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (
          document as Document & {
            startViewTransition: (fn: () => void) => void;
          }
        ).startViewTransition(() => {
          setStage({ kind: "arrival", output: edited, blobUrl: stage.blobUrl });
        });
      } else {
        setStage({ kind: "arrival", output: edited, blobUrl: stage.blobUrl });
      }
    },
    [stage],
  );

  const onReshoot = useCallback(() => {
    if (stage.kind === "review") URL.revokeObjectURL(stage.blobUrl);
    setStage({ kind: "viewfinder" });
  }, [stage]);

  const onArrivalDone = useCallback(() => {
    if (stage.kind !== "arrival") return;
    // The work has already been added to the store + focused by
    // `ArrivalChapter` on its mount (so the Room renders with it
    // on the wall while the arrival overlay settles). All this
    // callback does is navigate home. We do *not* revoke the blob
    // URL; the works store owns it for the rest of the session and
    // doing so here would blank the texture on the Room canvas.
    // OPFS rehydration (P5 persistence) replaces the blob URL with
    // a durable handle in a later iteration.
    //
    // Client-side navigation keeps the blob URL alive and lets
    // Next's same-document View Transition (enabled in
    // next.config) animate the arrival surface into the Room.
    router.push("/");
  }, [stage, router]);

  const onViewfinderError = useCallback((key: FailureKey, detail?: Error) => {
    reportFailure(
      detail
        ? {
            errorKey: key,
            stage: "viewfinder",
            site: "scan/viewfinder-onError",
            detail: `${detail.name}: ${detail.message}`,
          }
        : {
            errorKey: key,
            stage: "viewfinder",
            site: "scan/viewfinder-onError",
          },
    );
    setStage({ kind: "failed", failureKey: key });
  }, []);

  switch (stage.kind) {
    case "viewfinder":
      return <Viewfinder onCapture={onCapture} onError={onViewfinderError} />;
    case "uploading":
      return (
        <div
          className="relative grid min-h-dvh place-items-center bg-ink text-paper"
          aria-label={SCAN_STAGE.reading_label}
        >
          {/* No spinner. The ink *reads* the image. The line is
              rendered in AI-ink to signal an AI-authored moment. */}
          <p className="text-sm uppercase tracking-wide text-ink-ai">
            {SCAN_STAGE.reading_text}
          </p>
        </div>
      );
    case "review":
      return (
        <IntakeReview
          output={stage.output}
          onAddToWall={onAddToWall}
          onReshoot={onReshoot}
        />
      );
    case "arrival":
      return (
        <ArrivalChapter
          output={stage.output}
          imageBlobUrl={stage.blobUrl}
          onDone={onArrivalDone}
        />
      );
    case "failed":
      return (
        <div
          className="grid min-h-dvh place-items-center gap-4 bg-paper p-8 text-center"
          aria-label={SCAN_STAGE.failed_label}
        >
          <p className="text-ink-ai">{failureLine(stage.failureKey)}</p>
          <button
            type="button"
            onClick={onReshoot}
            className="border border-ink px-6 py-3 text-ink"
          >
            {SCAN_STAGE.failed_reshoot}
          </button>
        </div>
      );
  }
}
