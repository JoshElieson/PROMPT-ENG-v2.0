/** ~“what context to my files” length; keeps sidebar/tab titles readable */
const MAX_CHAT_TITLE_CHARS = 28;

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