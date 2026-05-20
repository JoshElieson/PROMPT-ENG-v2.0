import type { Chat, ChatMessage, ChatThread } from "@/types/chat";
import type { NodePermissions, Project } from "@/types/project";
import { DEFAULT_PERMISSIONS } from "@/types/project";
import { parseWorkspacePaneLayoutV2 } from "@/lib/workspace-pane-storage";

const PROJECTS_KEY = "prompt:projects:v1";
const PERMISSIONS_KEY = "prompt:permissions:v1";
const CHATS_KEY = "prompt:chats:v1";
const ACTIVE_CHAT_KEY = "prompt:active-chat:v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
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

export function loadPermissions(): Record<string, NodePermissions> {
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

export function savePermissions(permissions: Record<string, NodePermissions>): void {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
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
    typeof value.updatedAt === "number"
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
          return permissions
            ? { ...record, permissions, workspace: workspace ?? undefined }
            : { ...record, workspace: workspace ?? undefined };
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
