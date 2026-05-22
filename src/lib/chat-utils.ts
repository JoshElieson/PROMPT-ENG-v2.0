import type { Chat, ChatThread } from "@/types/chat";

export const DEFAULT_AGENT_SYSTEM_PROMPT =
  "You are a focused senior engineer assistant for this workspace.";

/** True once the user has sent at least one message in any thread. */
export function chatHasMessages(chat: Chat): boolean {
  return chat.threads.some((t) => t.messages.length > 0);
}

/**
 * Workspace should be retained in history/storage when it has user-authored
 * context/settings, even before the first message is sent.
 */
export function chatShouldPersist(chat: Chat): boolean {
  if (chat.hadMessages) return true;
  if (chatHasMessages(chat)) return true;

  const hasEnabledContext = Object.values(chat.permissions ?? {}).some(
    (permission) => permission.enabled,
  );
  if (hasEnabledContext) return true;

  if (chat.gitProjectId != null) return true;

  if ((chat.projectDescription?.trim() ?? "").length > 0) return true;

  if ((chat.projectTools?.length ?? 0) > 0) return true;

  return false;
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

/** @deprecated Prefer `fallbackWorkspaceTitle` from `@/lib/workspace-title`. */
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