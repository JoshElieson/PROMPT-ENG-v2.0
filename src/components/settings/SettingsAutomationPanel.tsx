import { useMemo, useState } from "react";
import { useAutomations } from "@/contexts/AutomationsContext";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  FilePenLine,
  GitCommitHorizontal,
  GitPullRequest,
  Plus,
  Repeat2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useChats } from "@/contexts/ChatsContext";
import { collectActiveAgentsByProject } from "@/lib/agent-settings-summary";
import { sortWorkspaces } from "@/lib/chat-utils";
import {
  createEmptyAutomationDraft,
  type AgentCompletionScope,
  type AutomationDraft,
  type AutomationEventType,
  type AutomationTriggerType,
  type ScheduleFrequency,
} from "@/types/automation";
import { cn } from "@/lib/utils";

const SETTINGS_INPUT_CLASS =
  "border-border-subtle bg-panel-elevated/80 text-foreground focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none";

const SETTINGS_TEXTAREA_CLASS =
  "border-border-subtle bg-panel-elevated/80 text-foreground placeholder:text-muted-foreground/55 focus:border-[#6366f1]/60 w-full resize-y rounded-md border px-2 py-2 text-xs outline-none min-h-[120px]";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TRIGGER_OPTIONS: Array<{
  id: AutomationTriggerType;
  label: string;
  description: string;
  icon: typeof CalendarClock;
}> = [
  {
    id: "schedule",
    label: "Time based",
    description: "Run on a recurring schedule",
    icon: CalendarClock,
  },
  {
    id: "agent-completion",
    label: "Agent completion",
    description: "Run after an agent finishes",
    icon: Bot,
  },
  {
    id: "event",
    label: "Event based",
    description: "Run when something happens in the project",
    icon: Zap,
  },
];

const EVENT_OPTIONS: Array<{
  id: AutomationEventType;
  label: string;
  description: string;
  icon: typeof GitCommitHorizontal;
}> = [
  {
    id: "git-commit",
    label: "Git commit",
    description: "After a new commit is detected",
    icon: GitCommitHorizontal,
  },
  {
    id: "file-change",
    label: "File changed",
    description: "When a file matching a pattern changes",
    icon: FilePenLine,
  },
  {
    id: "branch-push",
    label: "Branch pushed",
    description: "When a branch is pushed to remote",
    icon: GitCommitHorizontal,
  },
  {
    id: "pr-opened",
    label: "Pull request opened",
    description: "When a new pull request is created",
    icon: GitPullRequest,
  },
];

function SettingsCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border-subtle bg-panel/60 rounded-xl border px-4 py-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <p className="text-muted-foreground text-[11px] font-medium">{children}</p>
      {hint ? (
        <p className="text-muted-foreground/80 mt-0.5 text-[10px] leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function summarizeTrigger(automation: AutomationDraft): string {
  if (automation.triggerType === "schedule") {
    const time = automation.scheduleTime;
    if (automation.scheduleFrequency === "hourly") return "Every hour";
    if (automation.scheduleFrequency === "daily") return `Daily at ${time}`;
    if (automation.scheduleFrequency === "weekdays")
      return `Weekdays at ${time}`;
    if (automation.scheduleFrequency === "weekly") {
      const day = WEEKDAY_LABELS[automation.scheduleWeekday] ?? "Mon";
      return `Weekly on ${day} at ${time}`;
    }
    return `Every ${automation.scheduleIntervalMinutes} min`;
  }

  if (automation.triggerType === "agent-completion") {
    if (automation.agentScope === "any") return "After any agent completes";
    if (automation.agentScope === "agents") {
      const count = automation.selectedAgentIds.length;
      return count === 1
        ? "After 1 selected agent completes"
        : `After ${count} selected agents complete`;
    }
    const count = automation.selectedProjectIds.length;
    return count === 1
      ? "After agents in 1 project complete"
      : `After agents in ${count} projects complete`;
  }

  const event = EVENT_OPTIONS.find((option) => option.id === automation.eventType);
  return event?.label ?? "On event";
}

function AutomationListItem({
  automation,
  onEdit,
  onToggle,
}: {
  automation: AutomationDraft;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const taskPreview =
    automation.task.trim().length > 0
      ? automation.task.trim()
      : "No task written yet";

  return (
    <div
      className="border-border-subtle bg-panel/60 flex items-start gap-3 rounded-xl border px-3 py-3"
      data-ai-target={`settings.automation.row.${automation.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {automation.name.trim() || "Untitled automation"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {summarizeTrigger(automation)}
        </p>
        <p className="text-muted-foreground/80 mt-1.5 line-clamp-2 text-xs leading-relaxed">
          {taskPreview}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-7 px-2.5 text-[11px]"
          data-ai-target={`settings.automation.edit.${automation.id}`}
        >
          Edit
        </Button>
        <Switch
          checked={automation.enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${automation.name || "automation"}`}
        />
      </div>
    </div>
  );
}

function TriggerTypeSelector({
  value,
  onChange,
}: {
  value: AutomationTriggerType;
  onChange: (value: AutomationTriggerType) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {TRIGGER_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            data-ai-target={`settings.automation.trigger.${option.id}`}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
              active
                ? "border-[#6366f1]/50 bg-[#6366f1]/10"
                : "border-border-subtle bg-panel/40 hover:bg-panel-elevated/50",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                active ? "text-[#818cf8]" : "text-muted-foreground",
              )}
            />
            <div>
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] leading-relaxed">
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ScheduleTriggerFields({
  draft,
  onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  const showTime =
    draft.scheduleFrequency === "daily" ||
    draft.scheduleFrequency === "weekdays" ||
    draft.scheduleFrequency === "weekly";
  const showWeekday = draft.scheduleFrequency === "weekly";
  const showInterval = draft.scheduleFrequency === "custom";

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Frequency</FieldLabel>
        <select
          value={draft.scheduleFrequency}
          onChange={(event) =>
            onChange({
              scheduleFrequency: event.target.value as ScheduleFrequency,
            })
          }
          className={SETTINGS_INPUT_CLASS}
        >
          <option value="hourly">Every hour</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays (Mon–Fri)</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom interval</option>
        </select>
      </div>

      {showTime ? (
        <div>
          <FieldLabel hint="Uses your local timezone">Time of day</FieldLabel>
          <input
            type="time"
            value={draft.scheduleTime}
            onChange={(event) => onChange({ scheduleTime: event.target.value })}
            className={SETTINGS_INPUT_CLASS}
          />
        </div>
      ) : null}

      {showWeekday ? (
        <div>
          <FieldLabel>Day of week</FieldLabel>
          <select
            value={draft.scheduleWeekday}
            onChange={(event) =>
              onChange({ scheduleWeekday: Number(event.target.value) })
            }
            className={SETTINGS_INPUT_CLASS}
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showInterval ? (
        <div>
          <FieldLabel hint="Minimum 15 minutes">Run every (minutes)</FieldLabel>
          <input
            type="number"
            min={15}
            step={15}
            value={draft.scheduleIntervalMinutes}
            onChange={(event) =>
              onChange({
                scheduleIntervalMinutes: Math.max(
                  15,
                  Number(event.target.value) || 15,
                ),
              })
            }
            className={SETTINGS_INPUT_CLASS}
          />
        </div>
      ) : null}
    </div>
  );
}

function AgentCompletionTriggerFields({
  draft,
  onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  const { chats, activeChat } = useChats();

  const projectGroups = useMemo(() => {
    const byId = new Map(chats.map((chat) => [chat.id, chat]));
    if (activeChat && !byId.has(activeChat.id)) {
      byId.set(activeChat.id, activeChat);
    }
    return collectActiveAgentsByProject(sortWorkspaces([...byId.values()]));
  }, [activeChat, chats]);

  const scopeOptions: Array<{
    id: AgentCompletionScope;
    label: string;
    description: string;
  }> = [
    {
      id: "any",
      label: "Any agent",
      description: "Trigger when any agent in any project completes",
    },
    {
      id: "agents",
      label: "Specific agents",
      description: "Choose individual agents to watch",
    },
    {
      id: "projects",
      label: "Specific projects",
      description: "Trigger when any agent in selected projects completes",
    },
  ];

  const toggleAgent = (threadId: string) => {
    const selected = new Set(draft.selectedAgentIds);
    if (selected.has(threadId)) selected.delete(threadId);
    else selected.add(threadId);
    onChange({ selectedAgentIds: [...selected] });
  };

  const toggleProject = (chatId: string) => {
    const selected = new Set(draft.selectedProjectIds);
    if (selected.has(chatId)) selected.delete(chatId);
    else selected.add(chatId);
    onChange({ selectedProjectIds: [...selected] });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {scopeOptions.map((option) => {
          const active = draft.agentScope === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ agentScope: option.id })}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[#6366f1]/50 bg-[#6366f1]/8"
                  : "border-border-subtle/80 hover:bg-panel-elevated/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border",
                  active
                    ? "border-[#6366f1] bg-[#6366f1]"
                    : "border-border-subtle",
                )}
              />
              <span>
                <span className="text-sm text-foreground">{option.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-[10px] leading-relaxed">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {draft.agentScope === "agents" ? (
        <div>
          <FieldLabel hint="Select one or more agents">
            Agents to watch
          </FieldLabel>
          {projectGroups.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border-subtle px-3 py-4 text-xs">
              No agents yet. Create an agent in a project first.
            </p>
          ) : (
            <div className="border-border-subtle max-h-52 space-y-3 overflow-y-auto rounded-lg border p-2">
              {projectGroups.map((group) => (
                <div key={group.chatId}>
                  <p className="text-muted-foreground mb-1 px-1 text-[10px] font-medium tracking-wide uppercase">
                    {group.projectName}
                  </p>
                  <div className="space-y-0.5">
                    {group.agents.map((agent) => {
                      const checked = draft.selectedAgentIds.includes(
                        agent.threadId,
                      );
                      return (
                        <label
                          key={agent.threadId}
                          className="hover:bg-panel-elevated/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAgent(agent.threadId)}
                            className="accent-[#6366f1]"
                          />
                          <span className="truncate text-xs text-foreground">
                            {agent.summary.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {draft.agentScope === "projects" ? (
        <div>
          <FieldLabel hint="Any agent completing in these projects will trigger">
            Projects to watch
          </FieldLabel>
          {projectGroups.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border-subtle px-3 py-4 text-xs">
              No projects yet.
            </p>
          ) : (
            <div className="border-border-subtle max-h-40 space-y-0.5 overflow-y-auto rounded-lg border p-2">
              {projectGroups.map((group) => {
                const checked = draft.selectedProjectIds.includes(group.chatId);
                return (
                  <label
                    key={group.chatId}
                    className="hover:bg-panel-elevated/50 flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProject(group.chatId)}
                        className="accent-[#6366f1]"
                      />
                      <span className="truncate text-xs text-foreground">
                        {group.projectName}
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {group.agents.length === 1
                        ? "1 agent"
                        : `${group.agents.length} agents`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EventTriggerFields({
  draft,
  onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <FieldLabel>Event type</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {EVENT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = draft.eventType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ eventType: option.id })}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-[#6366f1]/50 bg-[#6366f1]/8"
                    : "border-border-subtle/80 hover:bg-panel-elevated/40",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    active ? "text-[#818cf8]" : "text-muted-foreground",
                  )}
                />
                <span>
                  <span className="text-xs font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px] leading-relaxed">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {draft.eventType === "git-commit" || draft.eventType === "branch-push" ? (
        <div>
          <FieldLabel hint="Leave empty to match any branch">
            Branch filter (optional)
          </FieldLabel>
          <input
            type="text"
            value={draft.eventBranch}
            onChange={(event) => onChange({ eventBranch: event.target.value })}
            placeholder="e.g. main, release/*"
            className={SETTINGS_INPUT_CLASS}
          />
        </div>
      ) : null}

      {draft.eventType === "file-change" ? (
        <div>
          <FieldLabel hint="Glob pattern relative to project root">
            File pattern
          </FieldLabel>
          <input
            type="text"
            value={draft.eventFilePattern}
            onChange={(event) =>
              onChange({ eventFilePattern: event.target.value })
            }
            placeholder="e.g. src/**/*.ts, package.json"
            className={SETTINGS_INPUT_CLASS}
          />
        </div>
      ) : null}

      {draft.eventType === "pr-opened" ? (
        <div>
          <FieldLabel hint="Limit to PRs targeting a specific branch">
            Target branch (optional)
          </FieldLabel>
          <input
            type="text"
            value={draft.eventBranch}
            onChange={(event) => onChange({ eventBranch: event.target.value })}
            placeholder="e.g. main"
            className={SETTINGS_INPUT_CLASS}
          />
        </div>
      ) : null}
    </div>
  );
}

function AutomationBuilder({
  draft,
  isNew,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: AutomationDraft;
  isNew: boolean;
  onChange: (patch: Partial<AutomationDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const canSave = draft.task.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="gap-1.5 px-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      </div>

      <SettingsCard data-ai-target="settings.automation.builder.name">
        <FieldLabel hint="Helps you recognize this automation in the list">
          Name
        </FieldLabel>
        <input
          type="text"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. Nightly dependency review"
          className={SETTINGS_INPUT_CLASS}
        />
      </SettingsCard>

      <section data-ai-target="settings.automation.builder.trigger">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide">
          When to run
        </p>
        <SettingsCard className="space-y-4">
          <TriggerTypeSelector
            value={draft.triggerType}
            onChange={(triggerType) => onChange({ triggerType })}
          />
          <div className="border-border-subtle border-t pt-4">
            {draft.triggerType === "schedule" ? (
              <ScheduleTriggerFields draft={draft} onChange={onChange} />
            ) : null}
            {draft.triggerType === "agent-completion" ? (
              <AgentCompletionTriggerFields draft={draft} onChange={onChange} />
            ) : null}
            {draft.triggerType === "event" ? (
              <EventTriggerFields draft={draft} onChange={onChange} />
            ) : null}
          </div>
        </SettingsCard>
      </section>

      <section data-ai-target="settings.automation.builder.task">
        <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide">
          Agent task
        </p>
        <SettingsCard>
          <FieldLabel hint="Instructions the agent will receive when this automation runs">
            What should the agent do?
          </FieldLabel>
          <textarea
            value={draft.task}
            onChange={(event) => onChange({ task: event.target.value })}
            placeholder="e.g. Review recent commits, summarize changes, and flag anything that needs attention before the next release."
            rows={6}
            className={SETTINGS_TEXTAREA_CLASS}
          />
        </SettingsCard>
      </section>

      <div className="flex items-center justify-between gap-3 pb-4">
        {!isNew && onDelete ? (
          <Button type="button" variant="outline" size="sm" onClick={onDelete}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            data-ai-target="settings.automation.builder.save"
          >
            {isNew ? "Create automation" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsAutomationPanel() {
  const {
    automations,
    upsertAutomation,
    deleteAutomation,
    setAutomationEnabled,
  } = useAutomations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationDraft | null>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    const next = createEmptyAutomationDraft();
    setDraft(next);
    setEditingId(next.id);
    setIsNew(true);
  };

  const startEdit = (automation: AutomationDraft) => {
    setDraft({ ...automation });
    setEditingId(automation.id);
    setIsNew(false);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
    setIsNew(false);
  };

  const saveDraft = () => {
    if (!draft || draft.task.trim().length === 0) return;
    upsertAutomation(draft);
    cancelEdit();
  };

  const deleteDraft = () => {
    if (!draft) return;
    deleteAutomation(draft.id);
    cancelEdit();
  };

  const toggleEnabled = (id: string, enabled: boolean) => {
    setAutomationEnabled(id, enabled);
  };

  const patchDraft = (patch: Partial<AutomationDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  if (draft && editingId) {
    return (
      <AutomationBuilder
        draft={draft}
        isNew={isNew}
        onChange={patchDraft}
        onSave={saveDraft}
        onCancel={cancelEdit}
        onDelete={isNew ? undefined : deleteDraft}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground min-w-0 text-xs">
          Run agents on a schedule, after completions, or on project events.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-8 shrink-0 gap-1.5 rounded-md px-3 text-sm"
          onClick={startNew}
          data-ai-target="settings.automation.new"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {automations.length === 0 ? (
        <div
          className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center"
          data-ai-target="settings.automation.empty"
        >
          <Repeat2 className="text-muted-foreground mb-3 h-8 w-8 opacity-60" />
          <p className="text-sm font-medium text-foreground">No automations yet</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
            Create your first automation to schedule agent work or react to
            completions and project events.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground mt-4 h-8 gap-1.5 rounded-md px-3 text-sm"
            onClick={startNew}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {automations.map((automation) => (
            <AutomationListItem
              key={automation.id}
              automation={automation}
              onEdit={() => startEdit(automation)}
              onToggle={(enabled) => toggleEnabled(automation.id, enabled)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
