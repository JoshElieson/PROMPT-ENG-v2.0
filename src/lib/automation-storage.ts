import type { AutomationDraft } from "@/types/automation";

export const AUTOMATIONS_STORAGE_KEY = "prompt:automations:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeAutomation(raw: unknown): AutomationDraft | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim()) {
    return null;
  }

  const triggerType = raw.triggerType;
  const scheduleFrequency = raw.scheduleFrequency;
  const agentScope = raw.agentScope;
  const eventType = raw.eventType;

  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "",
    enabled: raw.enabled !== false,
    triggerType:
      triggerType === "schedule" ||
      triggerType === "agent-completion" ||
      triggerType === "event"
        ? triggerType
        : "schedule",
    scheduleFrequency:
      scheduleFrequency === "hourly" ||
      scheduleFrequency === "daily" ||
      scheduleFrequency === "weekdays" ||
      scheduleFrequency === "weekly" ||
      scheduleFrequency === "custom"
        ? scheduleFrequency
        : "daily",
    scheduleTime:
      typeof raw.scheduleTime === "string" && raw.scheduleTime.trim()
        ? raw.scheduleTime
        : "09:00",
    scheduleWeekday:
      typeof raw.scheduleWeekday === "number" &&
      raw.scheduleWeekday >= 0 &&
      raw.scheduleWeekday <= 6
        ? raw.scheduleWeekday
        : 1,
    scheduleIntervalMinutes:
      typeof raw.scheduleIntervalMinutes === "number" &&
      raw.scheduleIntervalMinutes >= 15
        ? raw.scheduleIntervalMinutes
        : 60,
    agentScope:
      agentScope === "any" || agentScope === "agents" || agentScope === "projects"
        ? agentScope
        : "any",
    selectedAgentIds: normalizeStringArray(raw.selectedAgentIds),
    selectedProjectIds: normalizeStringArray(raw.selectedProjectIds),
    eventType:
      eventType === "git-commit" ||
      eventType === "file-change" ||
      eventType === "branch-push" ||
      eventType === "pr-opened"
        ? eventType
        : "git-commit",
    eventBranch: typeof raw.eventBranch === "string" ? raw.eventBranch : "",
    eventFilePattern:
      typeof raw.eventFilePattern === "string" ? raw.eventFilePattern : "",
    task: typeof raw.task === "string" ? raw.task : "",
    lastRunAt:
      typeof raw.lastRunAt === "number" && Number.isFinite(raw.lastRunAt)
        ? raw.lastRunAt
        : undefined,
  };
}

export function readAutomations(): AutomationDraft[] {
  try {
    const raw = localStorage.getItem(AUTOMATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeAutomation(item))
      .filter((item): item is AutomationDraft => item != null);
  } catch {
    return [];
  }
}

export function writeAutomations(automations: AutomationDraft[]): void {
  try {
    localStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(automations));
  } catch {
    // ignore quota / private mode errors
  }
}
