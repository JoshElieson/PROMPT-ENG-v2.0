import type { ProjectMemory } from "@/types/agent-memory";
import { normalizeAgentPermissions } from "@/lib/agent-permissions";
import { normalizeProjectTools } from "@/lib/project-tools";
import type {
  ApiUsageSnapshot,
  ModelUsageTotals,
} from "@/lib/token-usage";
import type { Chat, ChatMessage, ChatThread } from "@/types/chat";
import type { NodePermissions, Project } from "@/types/project";
import { DEFAULT_PERMISSIONS } from "@/types/project";
import { parseWorkspacePaneLayoutV2 } from "@/lib/workspace-pane-storage";

const PROJECTS_KEY = "prompt:projects:v1";
const PERMISSIONS_KEY = "prompt:permissions:v1";
const CHATS_KEY = "prompt:chats:v1";
const ACTIVE_CHAT_KEY = "prompt:active-chat:v1";
const API_USAGE_KEY = "prompt:api-usage:v1";
const PROJECT_MEMORY_KEY = "prompt:project-memory:v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is Partial<Project> =>
          Boolean(value) && typeof value === "object",
      )
      .map((project) => {
        const now = Date.now();
        const addedAt =
          typeof project.addedAt === "number" ? project.addedAt : now;
        const normalized: Project = {
          id:
            typeof project.id === "string" && project.id.length > 0
              ? project.id
              : crypto.randomUUID(),
          name: typeof project.name === "string" ? project.name : "Project",
          rootPath:
            typeof project.rootPath === "string" ? project.rootPath : "",
          addedAt,
        };
        return normalized;
      })
      .filter((project) => project.rootPath.length > 0);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function normalizePermission(value: unknown): NodePermissions {
  if (!value || typeof value !== "object") return DEFAULT_PERMISSIONS;

  const record = value as Record<string, unknown>;

  if (typeof record.enabled === "boolean") {
    return { enabled: record.enabled };
  }

  const legacyEnabled = Boolean(
    record.inContext || record.canRead || record.canWrite,
  );
  return { enabled: legacyEnabled };
}

function loadPermissions(): Record<string, NodePermissions> {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, NodePermissions> = {};
    for (const [path, value] of Object.entries(parsed)) {
      result[path] = normalizePermission(value);
    }
    return result;
  } catch {
    return {};
  }
}

function normalizeChatPermissions(
  raw: unknown,
): Record<string, NodePermissions> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, NodePermissions> = {};
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    result[path] = normalizePermission(value);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isChatThread(value: unknown): value is ChatThread {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.messages) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.systemPrompt === undefined || typeof value.systemPrompt === "string") &&
    (value.agentPermissions === undefined ||
      normalizeAgentPermissions(value.agentPermissions) != null)
  );
}

function isLegacyChat(value: unknown): value is Chat & { messages: ChatMessage[] } {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.messages) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    !Array.isArray(value.threads)
  );
}

function isModernChat(value: unknown): value is Chat {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.threads) || value.threads.length === 0) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    value.threads.every(isChatThread)
  );
}

function migrateLegacyChat(
  chat: Chat & { messages: ChatMessage[] },
  legacyPermissions: Record<string, NodePermissions> | null,
): Chat {
  const threadId = crypto.randomUUID();
  const permissions =
    normalizeChatPermissions(
      (chat as unknown as Record<string, unknown>).permissions,
    ) ?? (legacyPermissions && Object.keys(legacyPermissions).length > 0
      ? { ...legacyPermissions }
      : undefined);

  const { messages, ...rest } = chat;
  return {
    ...(rest as Omit<Chat, "threads" | "workspace" | "permissions">),
    permissions,
    threads: [
      {
        id: threadId,
        messages: Array.isArray(messages) ? messages : [],
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    ],
    workspace: undefined,
  };
}

export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const legacyPermissions = loadPermissions();
    const hasLegacy = Object.keys(legacyPermissions).length > 0;
    const permCopy = hasLegacy ? { ...legacyPermissions } : null;

    return parsed
      .filter((v): v is unknown => v != null)
      .map((item) => {
        if (isModernChat(item)) {
          const record = item as Chat;
          const permissions =
            normalizeChatPermissions(
              (record as unknown as Record<string, unknown>).permissions,
            ) ?? (permCopy ?? undefined);
          const rawWorkspace = (record as unknown as Record<string, unknown>)
            .workspace;
          const workspace =
            rawWorkspace != null
              ? parseWorkspacePaneLayoutV2(rawWorkspace)
              : record.workspace;
          const projectTools = normalizeProjectTools(
            (record as unknown as Record<string, unknown>).projectTools,
          );
          const base = {
            ...record,
            projectTools,
            workspace: workspace ?? undefined,
          };
          return permissions ? { ...base, permissions } : base;
        }
        if (isLegacyChat(item)) {
          return migrateLegacyChat(item, permCopy);
        }
        return null;
      })
      .filter((c): c is Chat => c != null);
  } catch {
    return [];
  }
}

export function saveChats(chats: Chat[]): void {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

export function loadActiveChatId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_CHAT_KEY);
    return raw || null;
  } catch {
    return null;
  }
}

export function saveActiveChatId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

function parseFiniteNonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function parseModelUsageTotals(value: unknown): ModelUsageTotals | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    inputTokens: parseFiniteNonNegative(record.inputTokens),
    outputTokens: parseFiniteNonNegative(record.outputTokens),
    costUsd: parseFiniteNonNegative(record.costUsd),
  };
}

export function loadApiUsage(): ApiUsageSnapshot {
  try {
    const raw = localStorage.getItem(API_USAGE_KEY);
    if (!raw) return { totals: { tokens: 0, costUsd: 0 }, byModel: {} };
    const parsed = JSON.parse(raw) as {
      tokens?: unknown;
      costUsd?: unknown;
      byModel?: unknown;
    };
    const tokens = parseFiniteNonNegative(parsed.tokens);
    const costUsd = parseFiniteNonNegative(parsed.costUsd);
    const byModel: Record<string, ModelUsageTotals> = {};
    if (parsed.byModel && typeof parsed.byModel === "object") {
      for (const [modelId, entry] of Object.entries(parsed.byModel)) {
        const usage = parseModelUsageTotals(entry);
        if (!usage) continue;
        if (
          usage.inputTokens <= 0 &&
          usage.outputTokens <= 0 &&
          usage.costUsd <= 0
        ) {
          continue;
        }
        byModel[modelId] = usage;
      }
    }
    return { totals: { tokens, costUsd }, byModel };
  } catch {
    return { totals: { tokens: 0, costUsd: 0 }, byModel: {} };
  }
}

export function loadProjectMemories(): Record<string, ProjectMemory> {
  try {
    const raw = localStorage.getItem(PROJECT_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const result: Record<string, ProjectMemory> = {};
    for (const [chatId, memory] of Object.entries(parsed)) {
      if (!isRecord(memory)) continue;
      if (
        typeof memory.projectId !== "string" ||
        !isRecord(memory.agents) ||
        !Array.isArray(memory.records) ||
        !Array.isArray(memory.sharedIndex)
      ) {
        continue;
      }
      result[chatId] = {
        projectId: memory.projectId,
        agents: memory.agents as ProjectMemory["agents"],
        records: memory.records as ProjectMemory["records"],
        sharedIndex: memory.sharedIndex as ProjectMemory["sharedIndex"],
        lastUpdatedAt:
          typeof memory.lastUpdatedAt === "number"
            ? memory.lastUpdatedAt
            : Date.now(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function saveProjectMemories(
  memories: Record<string, ProjectMemory>,
): void {
  localStorage.setItem(PROJECT_MEMORY_KEY, JSON.stringify(memories));
}
