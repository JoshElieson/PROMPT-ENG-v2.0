import type { Chat } from "@/types/chat";
import type { NodePermissions, Project } from "@/types/project";
import { DEFAULT_PERMISSIONS } from "@/types/project";

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

  // Legacy: any of context / read / write checked counts as enabled
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

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    Array.isArray(record.messages) &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number"
  );
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

export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const legacyPermissions = loadPermissions();
    const hasLegacy = Object.keys(legacyPermissions).length > 0;

    return parsed.filter(isChat).map((chat) => {
      const record = chat as Chat;
      const permissions =
        normalizeChatPermissions(
          (record as unknown as Record<string, unknown>).permissions,
        ) ??
        (hasLegacy ? { ...legacyPermissions } : undefined);
      return permissions ? { ...record, permissions } : record;
    });
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
