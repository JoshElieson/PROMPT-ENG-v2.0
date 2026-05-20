import type { Chat, ChatThread } from "@/types/chat";

/** True once the user has sent at least one message in any thread. */
export function chatHasMessages(chat: Chat): boolean {
  return chat.threads.some((t) => t.messages.length > 0);
}

/** ~“what context to my files” length; keeps sidebar/tab titles readable */
const MAX_CHAT_TITLE_CHARS = 28;

/** Pinned workspaces first, then most recently updated. */
export function sortWorkspaces(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDelta !== 0) return pinDelta;
    return b.updatedAt - a.updatedAt;
  });
}

/** Truncate stored or generated titles for display (full text can go in `title` tooltip). */
export function truncateChatTitle(text: string): string {
  const t = text.trim();
  if (!t) return "New Chat";
  return t.length > MAX_CHAT_TITLE_CHARS
    ? `${t.slice(0, MAX_CHAT_TITLE_CHARS)}...`
    : t;
}

export function titleFromMessage(content: string): string {
  const line = content.trim().split(/\r?\n/)[0] ?? "";
  if (!line) return "New Chat";
  return truncateChatTitle(line);
}

export function defaultThreadTitle(index: number): string {
  return `Agent ${index + 1}`;
}

export function threadDisplayTitle(thread: ChatThread, index: number): string {
  const custom = thread.title?.trim();
  return custom || defaultThreadTitle(index);
}