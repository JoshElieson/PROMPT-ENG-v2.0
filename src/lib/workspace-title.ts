import { aiChatComplete, type ChatTurn } from "@/lib/ai-chat";
import { firstLineOfAiReply } from "@/lib/ai-reply-text";
import { formatInvokeError } from "@/lib/git";
import { truncateChatTitle } from "@/lib/chat-utils";
import type { Chat } from "@/types/chat";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "from",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "please",
  "help",
  "need",
  "want",
  "like",
  "just",
  "also",
  "about",
  "into",
  "how",
  "what",
  "when",
  "where",
  "why",
  "who",
]);

const WORKSPACE_TITLE_MODEL_ID = "grok-fast";

const WORKSPACE_TITLE_SYSTEM = `You name workspace projects in a sidebar.

Rules:
- Return exactly one title of 2 to 4 words (inclusive).
- Summarize what the user is trying to accomplish or work on in that session.
- Use plain language, no quotes, no markdown, no trailing period.
- Prefer concrete nouns/verbs from the message.
- If the message is vague, infer the most likely task (e.g. "Debug auth flow", "Refactor sidebar layout").
- Start the title with a capital letter.`;

function withLeadingCapital(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function workspaceUserMessageCount(chat: Chat): number {
  return chat.threads.reduce(
    (count, thread) =>
      count + thread.messages.filter((message) => message.role === "user").length,
    0,
  );
}

/** True when the workspace title may still be auto-generated or refined. */
export function canAutoTitleWorkspace(chat: Chat): boolean {
  return !chat.titleLocked;
}

/** Immediate sidebar title before AI refinement. */
export function fallbackWorkspaceTitle(content: string): string {
  const line = (content.trim().split(/\r?\n/)[0] ?? "").replace(/\s+/g, " ");
  if (!line) return "New Chat";

  const words = line
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()));

  if (words.length === 0) return withLeadingCapital(truncateChatTitle(line));
  if (words.length === 1) return withLeadingCapital(truncateChatTitle(words[0]!));

  const picked = words.slice(0, 4);
  const size = Math.min(4, Math.max(2, picked.length));
  return withLeadingCapital(truncateChatTitle(picked.slice(0, size).join(" ")));
}

function normalizeWorkspaceTitle(raw: string): string {
  const text = firstLineOfAiReply(raw);
  const words = text.split(/\s+/).filter(Boolean);
  const joined =
    words.length > 4 ? words.slice(0, 4).join(" ") : words.join(" ");
  return withLeadingCapital(joined);
}

export async function generateWorkspaceTitleWithAi(
  userMessage: string,
): Promise<string> {
  const trimmed = userMessage.trim();
  const prompt = trimmed
    ? `User message:\n${trimmed.slice(0, 2000)}`
    : "User sent attachments only with no text. Infer a short project name.";

  const messages: ChatTurn[] = [{ role: "user", content: prompt }];

  try {
    const raw = await aiChatComplete(
      WORKSPACE_TITLE_MODEL_ID,
      messages,
      null,
      WORKSPACE_TITLE_SYSTEM,
    );
    const normalized = normalizeWorkspaceTitle(raw);
    return normalized || fallbackWorkspaceTitle(trimmed || "Attachments");
  } catch (error) {
    const wrapped = new Error(
      formatInvokeError(error, "Could not generate a workspace title with AI."),
    );
    Object.assign(wrapped, { cause: error });
    throw wrapped;
  }
}
