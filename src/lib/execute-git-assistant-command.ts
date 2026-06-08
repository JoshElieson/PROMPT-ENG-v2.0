import * as git from "@/lib/git";
import { loadAuthSession } from "@/lib/auth-storage";
import { githubTokenFromSession } from "@/lib/github-git-auth";
import { loadProjects } from "@/lib/storage";
import type {
  GitAssistantCommand,
  GitAssistantCommandResult,
} from "@/types/git-command";
import type { GitStatusResult } from "@/types/git";

function resolveRepoPath(
  gitProjectId: string | null | undefined,
): string | null {
  if (!gitProjectId) return null;
  const project = loadProjects().find((entry) => entry.id === gitProjectId);
  return project?.rootPath ?? null;
}

function formatStatusSummary(status: GitStatusResult): string {
  if (!status.isRepo) return "Not a git repository.";
  const lines = [
    `Branch: ${status.branch ?? "(detached or unknown)"}`,
    `Ahead: ${status.ahead}, Behind: ${status.behind}`,
    status.clean
      ? "Working tree clean."
      : `${status.changes.length} change(s):`,
  ];
  if (!status.clean) {
    for (const change of status.changes.slice(0, 40)) {
      const stage = change.staged ? "staged" : "unstaged";
      lines.push(`- ${change.status} (${stage}): ${change.path}`);
    }
    if (status.changes.length > 40) {
      lines.push(`…and ${status.changes.length - 40} more`);
    }
  }
  return lines.join("\n");
}

export async function executeGitAssistantCommand(
  command: GitAssistantCommand,
  gitProjectId: string | null | undefined,
): Promise<GitAssistantCommandResult> {
  const repoPath = resolveRepoPath(gitProjectId);
  const session = await loadAuthSession();
  const githubToken = githubTokenFromSession(session);

  try {
    switch (command.action) {
      case "status": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const status = await git.gitStatus(repoPath);
        return {
          action: command.action,
          success: true,
          output: formatStatusSummary(status),
        };
      }
      case "pull": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const result = await git.gitPull(repoPath, githubToken);
        return { action: command.action, ...result };
      }
      case "push": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const result = await git.gitPush(repoPath, null, githubToken);
        return { action: command.action, ...result };
      }
      case "fetch": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const result = await git.gitFetch(repoPath, githubToken);
        return { action: command.action, ...result };
      }
      case "init": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const result = await git.gitInit(repoPath);
        return { action: command.action, ...result };
      }
      case "commit": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const message = command.message?.trim() ?? "";
        if (!message) {
          return {
            action: command.action,
            success: false,
            output: "Commit message is required.",
          };
        }
        const result = await git.gitCommit(
          repoPath,
          message,
          command.stageAll ?? false,
        );
        return { action: command.action, ...result };
      }
      case "clone": {
        const parentPath = command.parentPath?.trim() || repoPath;
        const url = command.url?.trim() ?? "";
        if (!parentPath) {
          return {
            action: command.action,
            success: false,
            output: "Clone requires a parent directory or an active repository.",
          };
        }
        if (!url) {
          return {
            action: command.action,
            success: false,
            output: "Repository URL is required.",
          };
        }
        const result = await git.gitClone(url, parentPath, githubToken);
        return { action: command.action, ...result };
      }
      case "restore": {
        if (!repoPath) {
          return {
            action: command.action,
            success: false,
            output: "No repository selected for this workspace.",
          };
        }
        const paths = command.paths ?? [];
        if (paths.length === 0) {
          return {
            action: command.action,
            success: false,
            output: "At least one path is required to restore.",
          };
        }
        const result = await git.gitRestorePaths(repoPath, paths);
        return { action: command.action, ...result };
      }
      default:
        return {
          action: command.action,
          success: false,
          output: `Unsupported git action: ${command.action}`,
        };
    }
  } catch (error) {
    return {
      action: command.action,
      success: false,
      output: git.formatInvokeError(error, `Git ${command.action} failed.`),
    };
  } finally {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("forge:git-refresh"));
    }
  }
}

export async function executeGitAssistantCommands(
  commands: GitAssistantCommand[],
  gitProjectId: string | null | undefined,
): Promise<GitAssistantCommandResult[]> {
  const results: GitAssistantCommandResult[] = [];
  for (const command of commands) {
    results.push(await executeGitAssistantCommand(command, gitProjectId));
  }
  return results;
}

export function formatGitCommandResults(
  results: GitAssistantCommandResult[],
): string {
  if (results.length === 0) return "";
  return results
    .map((result) => {
      const label = result.success ? "OK" : "Failed";
      const output = result.output.trim() || "(no output)";
      return `**Git ${result.action}** (${label})\n\n${output}`;
    })
    .join("\n\n");
}
