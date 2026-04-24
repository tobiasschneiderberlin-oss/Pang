/**
 * PANG — verification → works bridge (iter #10).
 *
 * When the verification store transitions a work to `"confirmed"`,
 * the works store's `CollectionEntry.status` must flip to `"verified"`
 * on the same tick so The Room's emissive lifts from dormant to
 * verified-rest without a render lag. A direct mutation would couple
 * the two stores; instead we install a Zustand `.subscribe` that
 * observes per-work state transitions and issues the flip.
 *
 * Why a bridge instead of a composite store:
 *   - The verification store is the authoritative source for *state*
 *     (what the gallery answered). The works store owns the entry's
 *     *identity* (id, title, image, status). Keeping them independent
 *     means the render cache for one can rehydrate while the other is
 *     still bootstrapping.
 *   - A bridge is explicit. Reading the verification store and seeing
 *     "confirmed" in isolation is easy; the coupling to the emissive
 *     is one module away, named in the spine (`PANG_Spine.md` §
 *     *Confirmation is the moment*).
 *
 * Idempotency: the bridge reads the *previous* state via Zustand's
 * diff API. A re-subscribe (HMR, test reset) observes the current
 * snapshot, not a change event, so it doesn't fire spurious flips.
 * Already-verified entries are skipped.
 *
 * Arrival-on-confirm (soft): iter #10 ships the *data* side of the
 * arrival moment — the status flips, the Room's material picks up
 * the verified-rest emissive on next tick. The *staging* side (camera
 * push, ambient tone) is deferred to a later iter so this ships
 * without dragging in chapter-driver changes.
 */

import { useVerification, type VerificationState } from "@/stores/verification";
import { useWorks } from "@/stores/works";

/**
 * Install the verification → works bridge. Returns an unsubscribe
 * function so AppBoot can tear down on unmount (HMR, test reset).
 *
 * Safe to call more than once; each call returns its own unsubscribe
 * handle that cleans only that subscription.
 */
export function installConfirmBridge(): () => void {
  return useVerification.subscribe(
    (s) => s.byWorkId,
    (byWorkId, prevByWorkId) => {
      // Find work ids whose state just transitioned *into* "confirmed".
      // A fresh "confirmed" entry that wasn't present before also
      // counts (a reconcile path could install a confirmed state
      // directly without going through a `dispatched` precursor).
      for (const [workId, state] of Object.entries(byWorkId)) {
        if (state.kind !== "confirmed") continue;
        const prev = prevByWorkId[workId];
        if (prev !== undefined && prev.kind === "confirmed") continue;
        applyConfirmation(workId, state);
      }
    },
    { equalityFn: shallowEqualByWorkId },
  );
}

function applyConfirmation(workId: string, _state: VerificationState): void {
  const works = useWorks.getState();
  const entry = works.entries.find((e) => e.id === workId);
  if (entry === undefined) return;
  if (entry.status === "verified") return;
  works.setStatus(workId, "verified");
  // A dedicated `verification.confirmation.applied` span is a
  // follow-up iter — `ChapterShape` is currently an interface, not
  // a string union, so piggy-backing on `chapter.plan` would require
  // widening a load-bearing type. We keep the confirmation flip
  // silent to OTel for now; the works-store mutation is the visible
  // event, and the emissive lifts on the next tick.
}

/**
 * Shallow equality by reference on the outer map. Zustand's default
 * equality is strict identity; we override so the subscription fires
 * only on a real mutation (the store returns fresh objects on each
 * `set`, so identity is the right check). Extracted for legibility.
 */
function shallowEqualByWorkId(
  a: Readonly<Record<string, VerificationState>>,
  b: Readonly<Record<string, VerificationState>>,
): boolean {
  return a === b;
}
