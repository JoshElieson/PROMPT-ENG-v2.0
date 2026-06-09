import { resolveAgentPermissions } from "@/lib/agent-permissions";
import {
  DEFAULT_AGENT_SYSTEM_PROMPT,
  threadDisplayTitle,
} from "@/lib/chat-utils";
import type { Chat, ChatThread } from "@/types/chat";
import {
  AGENT_PERMISSION_KEYS,
  AGENT_PERMISSION_OPTIONS,
} from "@/types/agent-permissions";

export interface AgentSettingsSummary {
  name: string;
  promptSummary: string;
  permissionsSummary: string;
  messageCount: number;
}

export function summarizeAgentSettings(
  thread: ChatThread,
  threadIndex: number,
): AgentSettingsSummary {
  const name = threadDisplayTitle(thread, threadIndex);
  const permissions = resolveAgentPermissions(thread);
  const enabledCount = AGENT_PERMISSION_KEYS.filter((key) => permissions[key]).length;
  const totalCount = AGENT_PERMISSION_KEYS.length;

  let permissionsSummary: string;
  if (enabledCount === totalCount) {
    permissionsSummary = "All permissions enabled";
  } else if (enabledCount === 0) {
    permissionsSummary = "No permissions enabled";
  } else {
    const enabledLabels = AGENT_PERMISSION_OPTIONS.filter(
      (option) => permissions[option.key],
    ).map((option) => option.label);
    permissionsSummary = `${enabledCount} of ${totalCount}: ${enabledLabels.join(", ")}`;
  }

  const rawPrompt = thread.systemPrompt?.trim() || DEFAULT_AGENT_SYSTEM_PROMPT;
  const promptSummary =
    rawPrompt.length > 120 ? `${rawPrompt.slice(0, 120)}…` : rawPrompt;

  return {
    name,
    promptSummary,
    permissionsSummary,
    messageCount: thread.messages.length,
  };
}

export interface AgentListEntry {
  chatId: string;
  threadId: string;
  thread: ChatThread;
  threadIndex: number;
  summary: AgentSettingsSummary;
}

export interface ProjectAgentGroup {
  chatId: string;
  projectName: string;
  agents: AgentListEntry[];
}

export function collectActiveAgentsByProject(
  workspaces: Chat[],
): ProjectAgentGroup[] {
  return workspaces
    .map((chat) => ({
      chatId: chat.id,
      projectName: chat.title?.trim() || "New Chat",
      agents: chat.threads.map((thread, index) => ({
        chatId: chat.id,
        threadId: thread.id,
        thread,
        threadIndex: index,
        summary: summarizeAgentSettings(thread, index),
      })),
    }))
    .filter((group) => group.agents.length > 0);
}
