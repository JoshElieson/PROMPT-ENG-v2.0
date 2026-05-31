/** When the agent is busy, queue, interrupt, or block new sends until the reply finishes. */
export type QueuedMessageBehavior =
  | "wait"
  | "stop-and-send"
  | "block-until-responds";
