import type { GitFileChange } from "@/types/git";

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

/** Placeholder — later this will call the model API with your staged diff. */
export function generateCommitMessageWithAi(_changes: GitFileChange[]): string {
  void _changes;
  return "test 1.0";
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

export function replyToCommitChat(
  userText: string,
  changes: GitFileChange[],
  currentDraft: string,
): CommitChatMessage {
  const lower = userText.toLowerCase();
  const suggested = suggestCommitMessage(changes);
  const aiSuggested = generateCommitMessageWithAi(changes);

  if (
    lower.includes("generate") ||
    lower.includes("suggest") ||
    lower.includes("write") ||
    lower.trim() === ""
  ) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        changes.length === 0
          ? "No pending changes to summarize. Stage or edit files first."
          : "Here's a commit message from AI. Click **Use message** to apply it.",
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
