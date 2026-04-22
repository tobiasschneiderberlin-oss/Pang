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
import { entryFromIntake, useWorks } from "@/stores/works";
import {
  failureLine,
  keyFromUploadStatus,
  type FailureKey,
} from "@/ai/prompts/failure";

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

  const onCapture = useCallback(async (bytes: Uint8Array, sha: string) => {
    // TS 5.7 narrows `Uint8Array<ArrayBufferLike>` out of `BlobPart`.
    // Cast at the boundary — the bytes were produced by our own
    // capture helper and are always ArrayBuffer-backed.
    const blob = new Blob([bytes as unknown as BlobPart], {
      type: "image/png",
    });
    const blobUrl = URL.createObjectURL(blob);
    setStage({ kind: "uploading", blobUrl });

    try {
      const form = new FormData();
      form.set(
        "metadata",
        JSON.stringify({
          imageRef: `intake/staged/${sha}.png`,
          imageMime: "image/png",
          imageSha256: sha,
          source: "camera",
          documents: [],
        }),
      );
      form.set("image", blob, `${sha}.png`);

      const response = await fetch("/api/intake", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!response.ok) {
        // 422 → agent/refused (the model ran, the output failed
        // validation); 5xx → agent/unreachable; 4xx → upload/rejected.
        // Full mapping lives in `keyFromUploadStatus`.
        setStage({
          kind: "failed",
          failureKey: keyFromUploadStatus(response.status),
        });
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
      // fetch() throws on network failure (status 0 territory) and
      // on CORS / abort. Classify conservatively as upload/offline —
      // the corpus line observes, doesn't accuse.
      void err;
      setStage({ kind: "failed", failureKey: "upload/offline" });
      URL.revokeObjectURL(blobUrl);
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
    // The new work lands on Laura's wall. The works store owns
    // the blob URL for the rest of the session — so we do *not*
    // revoke it here; doing so would blank the texture on the
    // Room canvas. OPFS rehydration (P5 persistence) replaces
    // the blob URL with a durable handle in a later iteration.
    useWorks.getState().addEntry(entryFromIntake(stage.output, stage.blobUrl));
    // Client-side navigation: keeps the blob URL alive and lets
    // Next's same-document View Transition (enabled in
    // next.config) animate the arrival surface into the Room.
    router.push("/");
  }, [stage, router]);

  const onViewfinderError = useCallback((key: FailureKey, _detail?: Error) => {
    void _detail; // reserved for telemetry wiring in A10
    setStage({ kind: "failed", failureKey: key });
  }, []);

  switch (stage.kind) {
    case "viewfinder":
      return <Viewfinder onCapture={onCapture} onError={onViewfinderError} />;
    case "uploading":
      return (
        <div
          className="relative grid min-h-dvh place-items-center bg-ink text-paper"
          aria-label="reading"
        >
          {/* No spinner. The ink *reads* the image. The line is
              rendered in AI-ink to signal an AI-authored moment. */}
          <p className="text-sm uppercase tracking-wide text-ink-ai">
            reading
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
          aria-label="failed"
        >
          <p className="text-ink-ai">{failureLine(stage.failureKey)}</p>
          <button
            type="button"
            onClick={onReshoot}
            className="border border-ink px-6 py-3 text-ink"
          >
            reshoot
          </button>
        </div>
      );
  }
}
