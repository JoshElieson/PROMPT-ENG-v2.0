import type {
  GitAssistantAction,
  GitAssistantCommand,
} from "@/types/git-command";

export interface ExtractAssistantGitCommandsResult {
  visibleContent: string;
  commands: GitAssistantCommand[];
}

const DIRECTIVE_RE = /\[\[FORGE_GIT([^\]]*)\]\]/gi;

const VALID_ACTIONS = new Set<GitAssistantAction>([
  "status",
  "pull",
  "push",
  "fetch",
  "init",
  "commit",
  "clone",
  "restore",
]);

function readAttr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(attrs);
  return match?.[1]?.trim() || undefined;
}

function readBoolAttr(attrs: string, name: string): boolean | undefined {
  const raw = readAttr(attrs, name);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return undefined;
}

function parsePathsAttr(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const paths = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return paths.length > 0 ? paths : undefined;
}

function parseDirective(attrs: string): GitAssistantCommand | null {
  const actionRaw = readAttr(attrs, "action")?.toLowerCase();
  if (!actionRaw || !VALID_ACTIONS.has(actionRaw as GitAssistantAction)) {
    return null;
  }
  const action = actionRaw as GitAssistantAction;
  const command: GitAssistantCommand = { action };

  if (action === "commit") {
    const message = readAttr(attrs, "message");
    if (!message) return null;
    command.message = message;
    command.stageAll = readBoolAttr(attrs, "stageAll") ?? false;
  }

  if (action === "clone") {
    const url = readAttr(attrs, "url");
    if (!url) return null;
    command.url = url;
    command.parentPath = readAttr(attrs, "parentPath");
  }

  if (action === "restore") {
    command.paths = parsePathsAttr(readAttr(attrs, "paths"));
    if (!command.paths?.length) return null;
  }

  return command;
}

/** Extract git directives and remove them from user-visible assistant content. */
export function extractAssistantGitCommands(
  content: string,
): ExtractAssistantGitCommandsResult {
  const commands: GitAssistantCommand[] = [];

  const visibleContent = content
    .replace(DIRECTIVE_RE, (_full, attrs: string) => {
      const command = parseDirective(attrs ?? "");
      if (command) commands.push(command);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { visibleContent, commands };
}

export function buildGitCommandsSystemGuidance(repoPath: string | null): string {
  const repoLine = repoPath
    ? `Active repository root: ${repoPath}`
    : "No repository is selected for this workspace yet. Ask the user to choose one in Source Control before running repo-specific git commands.";

  return [
    "Git command execution:",
    repoLine,
    "When the user asks you to run git/source-control operations, emit the matching directive immediately—do not ask permission or tell them to run commands manually.",
    "Emit one directive per operation on its own line:",
    '[[FORGE_GIT action="status"]]',
    '[[FORGE_GIT action="pull"]]',
    '[[FORGE_GIT action="push"]]',
    '[[FORGE_GIT action="fetch"]]',
    '[[FORGE_GIT action="init"]]',
    '[[FORGE_GIT action="commit" message="short summary" stageAll="true"]]',
    '[[FORGE_GIT action="clone" url="https://github.com/org/repo.git" parentPath="C:\\\\parent\\\\dir"]]',
    '[[FORGE_GIT action="restore" paths="relative/path.ts,other/file.ts"]]',
    "Supported actions: status, pull, push, fetch, init, commit, clone, restore.",
    "For commit, message is required; stageAll defaults to false (commit staged only) unless the user asked to commit everything.",
    "For clone, parentPath is optional and defaults to the active repository root.",
    "For restore, paths is a comma-separated list of repo-relative or absolute paths to discard.",
    "Only ask before restore when the paths were not specified or the scope is unclear.",
    "The app executes these directives automatically. Summarize what you ran in plain text; do not claim success without emitting the directive.",
    "Do not emit git directives unless the user asked for git/source-control work.",
  ].join("\n");
}