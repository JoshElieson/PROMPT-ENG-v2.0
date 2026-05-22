import type { ChatThread } from "@/types/chat";
import {
  AGENT_PERMISSION_KEYS,
  DEFAULT_AGENT_PERMISSIONS,
  type AgentPermissions,
} from "@/types/agent-permissions";
import type { PaneActionTarget } from "@/lib/assistant-pane-actions";

export function resolveAgentPermissions(
  thread?: ChatThread | null,
): AgentPermissions {
  return { ...DEFAULT_AGENT_PERMISSIONS, ...thread?.agentPermissions };
}

export function serializeAgentPermissions(
  permissions: AgentPermissions,
): Partial<AgentPermissions> | undefined {
  const partial: Partial<AgentPermissions> = {};
  for (const key of AGENT_PERMISSION_KEYS) {
    if (permissions[key] !== DEFAULT_AGENT_PERMISSIONS[key]) {
      partial[key] = permissions[key];
    }
  }
  return Object.keys(partial).length > 0 ? partial : undefined;
}

export function normalizeAgentPermissions(
  value: unknown,
): Partial<AgentPermissions> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const partial: Partial<AgentPermissions> = {};
  for (const key of AGENT_PERMISSION_KEYS) {
    if (typeof raw[key] === "boolean") {
      partial[key] = raw[key];
    }
  }
  return Object.keys(partial).length > 0 ? partial : undefined;
}

export function isPaneActionAllowed(
  target: PaneActionTarget,
  permissions: AgentPermissions,
): boolean {
  switch (target) {
    case "websites":
      return permissions.browser;
    case "terminal":
      return permissions.terminal;
    case "models":
    case "agent-cart":
      return permissions.inAppSettings;
    case "explorer":
      return true;
    default:
      return true;
  }
}

export function buildAgentPermissionsSystemNote(
  permissions: AgentPermissions,
): string | null {
  const denied: string[] = [];
  if (!permissions.browser) denied.push("browser pane");
  if (!permissions.fileRead) denied.push("file read tools");
  if (!permissions.fileWrite) denied.push("file write/delete tools");
  if (!permissions.terminal) denied.push("terminal pane");
  if (!permissions.git) denied.push("git commands and source control");
  if (!permissions.inAppSettings) {
    denied.push("in-app settings (project tools/description and configuration panes)");
  }

  if (denied.length === 0) return null;
  return (
    "Agent permissions (do not use disabled capabilities): " +
    `the user disabled ${denied.join(", ")} for this agent.`
  );
}
