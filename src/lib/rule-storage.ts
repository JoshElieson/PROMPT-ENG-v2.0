import type { RuleScope, UserRule } from "@/types/rule";

export const RULES_STORAGE_KEY = "prompt:rules:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeScope(value: unknown): RuleScope {
  return value === "projects" || value === "agents" ? value : "all";
}

function normalizeRule(raw: unknown): UserRule | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim()) {
    return null;
  }

  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    enabled: raw.enabled !== false,
    scope: normalizeScope(raw.scope),
    selectedProjectIds: normalizeStringArray(raw.selectedProjectIds),
    selectedAgentIds: normalizeStringArray(raw.selectedAgentIds),
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
  };
}

export function readRules(): UserRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeRule(item))
      .filter((item): item is UserRule => item != null)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

export function writeRules(rules: UserRule[]): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // ignore quota / private mode errors
  }
}
