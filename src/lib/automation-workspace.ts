import { resolveAgentPermissions } from "@/lib/agent-permissions";
import { pathsEqual } from "@/lib/project-paths";
import type { AiWorkspacePayload, Chat } from "@/types/chat";
import type { Project } from "@/types/project";

export interface AutomationRunContext {
  chatId?: string;
  projectId?: string;
  projectRootPath?: string;
}

export function resolveChatForAutomation(
  chats: Chat[],
  context?: AutomationRunContext,
): Chat | null {
  if (context?.chatId) {
    return chats.find((chat) => chat.id === context.chatId) ?? null;
  }

  if (context?.projectId) {
    const linked = chats.find((chat) => chat.gitProjectId === context.projectId);
    if (linked) return linked;
  }

  if (context?.projectRootPath) {
    const linked = chats.find((chat) =>
      Object.keys(chat.permissions ?? {}).some((path) =>
        pathsEqual(path, context.projectRootPath!),
      ),
    );
    if (linked) return linked;
  }

  return (
    chats.find(
      (chat) =>
        chat.hadMessages &&
        Object.values(chat.permissions ?? {}).some((permission) => permission.enabled),
    ) ??
    chats[0] ??
    null
  );
}

export function buildAutomationWorkspace(
  chat: Chat | null,
  projects: Project[],
): AiWorkspacePayload | undefined {
  if (!chat) return undefined;

  const thread = chat.threads[0];
  const agentPermissions = resolveAgentPermissions(thread);
  const gitRepoPath =
    chat.gitProjectId != null
      ? projects.find((project) => project.id === chat.gitProjectId)?.rootPath
      : undefined;
  const allowGit = agentPermissions.git && !!gitRepoPath;
  const fileAccessAllowed =
    agentPermissions.fileRead && chat.fileAccessEnabled !== false;
  const enabledPaths = fileAccessAllowed
    ? Object.entries(chat.permissions ?? {})
        .filter(([, permission]) => permission.enabled)
        .map(([path]) => path)
    : [];

  if (enabledPaths.length === 0 && !allowGit) return undefined;

  return {
    enabledPaths,
    allowWrite: agentPermissions.fileWrite,
    allowGit,
    gitRepoPath,
  };
}
