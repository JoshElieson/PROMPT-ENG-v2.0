import type { ProjectAgentGroup } from "@/lib/agent-settings-summary";
import { cn } from "@/lib/utils";

export interface ScopeOption<T extends string> {
  id: T;
  label: string;
  description: string;
}

export function ScopeOptionList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Array<ScopeOption<T>>;
  value: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
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
  );
}

export function AgentGroupCheckboxList({
  groups,
  selectedIds,
  onToggle,
  maxHeightClass,
}: {
  groups: ProjectAgentGroup[];
  selectedIds: string[];
  onToggle: (threadId: string) => void;
  maxHeightClass: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed border-border-subtle px-3 py-4 text-xs">
        No agents yet. Create an agent in a project first.
      </p>
    );
  }
  return (
    <div
      className={cn(
        "border-border-subtle space-y-3 overflow-y-auto rounded-lg border p-2",
        maxHeightClass,
      )}
    >
      {groups.map((group) => (
        <div key={group.chatId}>
          <p className="text-muted-foreground mb-1 px-1 text-[10px] font-medium tracking-wide uppercase">
            {group.projectName}
          </p>
          <div className="space-y-0.5">
            {group.agents.map((agent) => {
              const checked = selectedIds.includes(agent.threadId);
              return (
                <label
                  key={agent.threadId}
                  className="hover:bg-panel-elevated/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(agent.threadId)}
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
  );
}

export function ProjectCheckboxList({
  groups,
  selectedIds,
  onToggle,
  maxHeightClass,
}: {
  groups: ProjectAgentGroup[];
  selectedIds: string[];
  onToggle: (chatId: string) => void;
  maxHeightClass: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed border-border-subtle px-3 py-4 text-xs">
        No projects yet.
      </p>
    );
  }
  return (
    <div
      className={cn(
        "border-border-subtle space-y-0.5 overflow-y-auto rounded-lg border p-2",
        maxHeightClass,
      )}
    >
      {groups.map((group) => {
        const checked = selectedIds.includes(group.chatId);
        return (
          <label
            key={group.chatId}
            className="hover:bg-panel-elevated/50 flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(group.chatId)}
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
  );
}
