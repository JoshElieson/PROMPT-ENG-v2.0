import type { Chat } from "@/types/chat";
import type { QueuedMessageBehavior } from "@/types/chat-behavior";

const DEFAULT_AUTO_SCROLL_ENABLED = true;
const DEFAULT_QUEUED_MESSAGE_BEHAVIOR: QueuedMessageBehavior = "wait";

export const QUEUED_MESSAGE_BEHAVIOR_OPTIONS: ReadonlyArray<{
  value: QueuedMessageBehavior;
  label: string;
  description: string;
}> = [
  {
    value: "wait",
    label: "Wait to send",
    description: "Queue messages until the agent finishes the current reply.",
  },
  {
    value: "stop-and-send",
    label: "Stop and send",
    description: "Stop the current reply and send your message right away.",
  },
  {
    value: "block-until-responds",
    label: "Prevent early sending",
    description:
      "Disable sending while the agent is working on the current reply.",
  },
];

export function resolveAutoScrollEnabled(
  chat: Pick<Chat, "autoScrollEnabled"> | null | undefined,
): boolean {
  return chat?.autoScrollEnabled ?? DEFAULT_AUTO_SCROLL_ENABLED;
}

export function resolveQueuedMessageBehavior(
  chat: Pick<Chat, "queuedMessageBehavior"> | null | undefined,
): QueuedMessageBehavior {
  const value = chat?.queuedMessageBehavior;
  if (
    value === "wait" ||
    value === "stop-and-send" ||
    value === "block-until-responds"
  ) {
    return value;
  }
  return DEFAULT_QUEUED_MESSAGE_BEHAVIOR;
}
