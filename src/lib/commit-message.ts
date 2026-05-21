import type { GitFileChange } from "@/types/git";
import { aiChatComplete, type ChatTurn } from "@/lib/ai-chat";
import { formatInvokeError } from "@/lib/git";

export interface CommitChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedCommit?: string;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function summarizeChanges(changes: GitFileChange[]): string {
  const names = changes.map((c) => basename(c.path));
  const added = changes.filter((c) => c.status === "added").length;
  const deleted = changes.filter((c) => c.status === "deleted").length;
  const modified = changes.filter(
    (c) => c.status === "modified" || c.status === "renamed",
  ).length;

  const parts: string[] = [];
  if (modified > 0) parts.push(`${modified} modified`);
  if (added > 0) parts.push(`${added} added`);
  if (deleted > 0) parts.push(`${deleted} deleted`);

  const scope =
    names.length <= 3
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

  return parts.length > 0 ? `${parts.join(", ")} (${scope})` : scope;
}

function inferType(changes: GitFileChange[]): string {
  const exts = changes.map((c) => basename(c.path).split(".").pop()?.toLowerCase());
  if (changes.every((c) => c.status === "added")) return "feat";
  if (changes.every((c) => c.status === "deleted")) return "chore";
  if (exts.some((e) => e === "md" || e === "txt")) return "docs";
  if (changes.some((c) => c.path.includes("test") || c.path.includes("spec"))) return "test";
  if (changes.some((c) => c.path.includes("fix") || c.path.includes("bug"))) return "fix";
  return "chore";
}

export const COMMIT_MESSAGE_MODEL_ID = "gpt4o";

const COMMIT_MESSAGE_SYSTEM = `You write git commit messages.

Rules:
- Return exactly one single-line summary of what changed.
- Output must be 1 to 7 words total.
- Be as specific as possible about the actual change.
- No prefixes like "feat:" or "fix:".
- No body text, no quotes, no markdown, no backticks, no trailing period.
- Prefer concrete nouns/verbs from the changed files.
- If input is vague, return: update project files`;

function toChangesContext(changes: GitFileChange[]): string {
  return changes
    .map((change) => {
      const stagedLabel = change.staged ? "staged" : "unstaged";
      return `- ${change.status} (${stagedLabel}): ${change.path}`;
    })
    .join("\n");
}

function normalizeCommitSubject(raw: string): string {
  let text = raw.trim();
  if (!text) return "";
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines[0]?.match(/^```/)) lines.shift();
    const last = lines[lines.length - 1];
    if (last?.match(/^```/)) lines.pop();
    text = lines.join("\n").trim();
  }
  text = text.split(/\r?\n/)[0]?.trim() ?? "";
  text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
  text = text.replace(/\.+$/, "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 7) {
    text = words.slice(0, 7).join(" ");
  }
  return text;
}

export async function generateCommitMessageWithAi(
  changes: GitFileChange[],
): Promise<string> {
  if (changes.length === 0) {
    return "update project files";
  }

  const prompt = `Summarize exactly what changed in 1-7 words:
${toChangesContext(changes)}
`;
  const messages: ChatTurn[] = [{ role: "user", content: prompt }];

  try {
    const raw = await aiChatComplete(
      COMMIT_MESSAGE_MODEL_ID,
      messages,
      null,
      COMMIT_MESSAGE_SYSTEM,
    );
    const normalized = normalizeCommitSubject(raw);
    return normalized || "update project files";
  } catch (error) {
    throw new Error(
      formatInvokeError(error, "Could not generate a commit message with AI."),
    );
  }
}

export const GENERATE_COMMIT_AI_TOOLTIP = "Generate using AI";

export function suggestCommitMessage(changes: GitFileChange[]): string {
  if (changes.length === 0) {
    return "chore: update project files";
  }

  const type = inferType(changes);
  const summary = summarizeChanges(changes);
  const headline =
    changes.length === 1
      ? `update ${basename(changes[0].path)}`
      : `update ${changes.length} files`;

  return `${type}: ${headline}\n\n${summary}`;
}

export async function replyToCommitChat(
  userText: string,
  changes: GitFileChange[],
  currentDraft: string,
): Promise<CommitChatMessage> {
  const lower = userText.toLowerCase();
  const suggested = suggestCommitMessage(changes);

  if (
    lower.includes("generate") ||
    lower.includes("suggest") ||
    lower.includes("write") ||
    lower.trim() === ""
  ) {
    let aiSuggested: string | undefined;
    let content =
      "Here's a commit message from AI. Click **Use message** to apply it.";
    if (changes.length > 0) {
      try {
        aiSuggested = await generateCommitMessageWithAi(changes);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "AI generation failed.";
        return {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I couldn't generate with AI right now: ${message}`,
          suggestedCommit: suggested.split("\n")[0] ?? "update project files",
        };
      }
    } else {
      content = "No pending changes to summarize. Stage or edit files first.";
    }
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      suggestedCommit: changes.length > 0 ? aiSuggested : undefined,
    };
  }

  if (lower.includes("shorter") || lower.includes("brief")) {
    const short = `${inferType(changes)}: ${changes.length === 1 ? `update ${basename(changes[0].path)}` : `update ${changes.length} files`}`;
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Shortened the message:",
      suggestedCommit: short,
    };
  }

  if (lower.includes("conventional") || lower.includes("format")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Conventional commit format:",
      suggestedCommit: suggested,
    };
  }

  if (currentDraft.trim()) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `You can refine your draft:\n\n"${currentDraft.trim()}"\n\nOr try: "generate", "shorter", or "conventional".`,
      suggestedCommit: currentDraft.trim(),
    };
  }

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      'Ask me to **generate** a message, make it **shorter**, or use **conventional** format. I use your changed files as context.',
    suggestedCommit: changes.length > 0 ? suggested : undefined,
  };
}
