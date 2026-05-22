/** When the agent is busy, queue, interrupt, or block new sends until the reply finishes. */
export type QueuedMessageBehavior =
  | "wait"
  | "stop-and-send"
  | "block-until-responds";

export interface ChatBehaviorSettings {
  /** Follow new messages while chatting (default: on). */
  autoScrollEnabled?: boolean;
  queuedMessageBehavior?: QueuedMessageBehavior;
}
