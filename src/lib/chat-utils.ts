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
  if (!isPlaceholderWorkspaceTitle(chat.title ?? "")) return true;

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

/** Pinned workspaces first, then most recently sent-to by user message. */
export function sortWorkspaces(chats: Chat[]): Chat[] {
  const latestUserMessageAt = (chat: Chat): number => {
    let latest = 0;
    for (const thread of chat.threads) {
      for (const message of thread.messages) {
        if (message.role !== "user") continue;
        if (message.createdAt > latest) latest = message.createdAt;
      }
    }
    return latest;
  };

  return [...chats].sort((a, b) => {
    const pinDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDelta !== 0) return pinDelta;
    const recencyDelta = latestUserMessageAt(b) - latestUserMessageAt(a);
    if (recencyDelta !== 0) return recencyDelta;
    return b.createdAt - a.createdAt;
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

export const DEFAULT_WORKSPACE_TITLE = "New Chat";

/** Stored workspace titles that are placeholders until the user names the project. */
export const PLACEHOLDER_WORKSPACE_TITLES = new Set([
  DEFAULT_WORKSPACE_TITLE,
  "New Project",
]);

export function defaultThreadTitle(index: number): string {
  return `Agent ${index + 1}`;
}

export function threadDisplayTitle(thread: ChatThread, index: number): string {
  const custom = thread.title?.trim();
  return custom || defaultThreadTitle(index);
}

/** Sidebar/settings label for a workspace (never empty). */
export function workspaceDisplayTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? "";
  return trimmed || DEFAULT_WORKSPACE_TITLE;
}

export function isPlaceholderWorkspaceTitle(title: string): boolean {
  const trimmed = title.trim();
  return !trimmed || PLACEHOLDER_WORKSPACE_TITLES.has(trimmed);
}