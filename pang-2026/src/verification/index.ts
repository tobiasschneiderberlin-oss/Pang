/**
 * PANG — verification module barrel.
 *
 * One entry point for the iteration #4 primitives. Consumers import
 * from `@/verification`, not individual files; this lets the module
 * grow (submit path, reconcile path, confirmation hooks) without
 * rippling imports across the app.
 */

export {
  newRequestId,
  RequestIdSchema,
  ArtworkSnapshotSchema,
  VerificationRequestSchema,
  VerificationAckSchema,
  VerificationOutcomeSchema,
  type ArtworkSnapshot,
  type VerificationRequest,
  type VerificationAck,
  type VerificationOutcome,
} from "./schema";

export {
  RETRY_POLICY,
  nextDelayMs,
  shouldGiveUp,
  type VerificationRetryPolicy,
} from "./retry";

export {
  enqueueVerificationRequest,
  readOutboxRecord,
  updateOutboxRecord,
  removeOutboxRecord,
  listOutboxRecords,
  serialiseOutboxRecord,
  parseOutboxRecord,
  type OutboxRecord,
} from "./outbox";

export {
  outboxEnqueueEvent,
  outboxDrainStartEvent,
  outboxDrainStepEvent,
  outboxDrainCompleteEvent,
  requestSubmitEvent,
  requestAckEvent,
  requestFailEvent,
  pushSubscribeEvent,
  confirmationReceivedEvent,
  declineReceivedEvent,
  reconcileEvent,
  type VerificationEvent,
  type VerificationEventPayload,
  type PushSubscribeOutcome,
  type ReconcileSummary,
} from "./otel";

export {
  dispatchVerificationRequest,
  drainOutbox,
  submitVerificationOnce,
  type SubmitOutcome,
} from "./submit";

export {
  planReconcile,
  reconcileVerification,
  installOnlineDrain,
  installDispatchedVisibilityWalker,
  installOutcomeBroadcastListener,
  pollOutcomeOnce,
  walkDispatchedOnce,
  type ReconcilePlan,
} from "./reconcile";
