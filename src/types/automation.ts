export type AutomationTriggerType = "schedule" | "agent-completion" | "event";

export type ScheduleFrequency =
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "custom";

export type AgentCompletionScope = "any" | "agents" | "projects";

export type AutomationEventType =
  | "git-commit"
  | "file-change"
  | "branch-push"
  | "pr-opened";

export interface AutomationDraft {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  scheduleFrequency: ScheduleFrequency;
  scheduleTime: string;
  scheduleWeekday: number;
  scheduleIntervalMinutes: number;
  agentScope: AgentCompletionScope;
  selectedAgentIds: string[];
  selectedProjectIds: string[];
  eventType: AutomationEventType;
  eventBranch: string;
  eventFilePattern: string;
  task: string;
  /** Unix ms timestamp of the last successful schedule run (persisted). */
  lastRunAt?: number;
}

export function createEmptyAutomationDraft(): AutomationDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    enabled: true,
    triggerType: "schedule",
    scheduleFrequency: "daily",
    scheduleTime: "09:00",
    scheduleWeekday: 1,
    scheduleIntervalMinutes: 60,
    agentScope: "any",
    selectedAgentIds: [],
    selectedProjectIds: [],
    eventType: "git-commit",
    eventBranch: "",
    eventFilePattern: "",
    task: "",
  };
}
