import type { AutomationDraft } from "@/types/automation";

export function automationDisplayName(automation: AutomationDraft): string {
  const trimmed = automation.name.trim();
  return trimmed || "Untitled automation";
}

export function matchesBranchFilter(filter: string, branch: string | null): boolean {
  const pattern = filter.trim();
  if (!pattern) return true;
  if (!branch) return false;
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(branch);
  }
  return branch.toLowerCase() === pattern.toLowerCase();
}

export function matchesFilePattern(pattern: string, changedPath: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return true;
  const normalizedPath = changedPath.replace(/\\/g, "/");
  const normalizedPattern = trimmed.replace(/\\/g, "/");
  if (normalizedPattern.includes("*")) {
    const escaped = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(normalizedPath);
  }
  return normalizedPath.toLowerCase() === normalizedPattern.toLowerCase();
}

export function matchesAgentCompletionTrigger(
  automation: AutomationDraft,
  chatId: string,
  threadId: string,
): boolean {
  if (automation.triggerType !== "agent-completion" || !automation.enabled) {
    return false;
  }
  if (automation.task.trim().length === 0) return false;

  if (automation.agentScope === "any") return true;
  if (automation.agentScope === "agents") {
    return automation.selectedAgentIds.includes(threadId);
  }
  if (automation.agentScope === "projects") {
    return automation.selectedProjectIds.includes(chatId);
  }
  return false;
}

export function parseGitHubRepo(
  remoteUrl: string,
): { owner: string; repo: string } | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  const sshMatch = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i.exec(trimmed);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.toLowerCase().includes("github.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const repo = parts[1].replace(/\.git$/i, "");
    return { owner: parts[0], repo };
  } catch {
    return null;
  }
}
