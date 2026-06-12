import { useState } from "react";
import { Plus, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AgentGroupCheckboxList,
  ProjectCheckboxList,
  ScopeOptionList,
  type ScopeOption,
} from "@/components/settings/scope-picker";
import { useProjectAgentGroups } from "@/hooks/use-project-agent-groups";
import { useRules } from "@/contexts/RulesContext";
import { isRuleDraftValid, summarizeRuleScope } from "@/lib/user-rules-prompt";
import { createEmptyUserRule, type RuleScope, type UserRule } from "@/types/rule";
import { cn } from "@/lib/utils";

function RuleListItem({
  rule,
  onEdit,
  onToggle,
}: {
  rule: UserRule;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const preview =
    rule.content.trim().length > 0
      ? rule.content.trim()
      : "No rule written yet";

  return (
    <div
      className="border-border-subtle bg-panel/60 flex items-start gap-3 rounded-xl border px-3 py-3"
      data-ai-target={`settings.rules.row.${rule.id}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {rule.title.trim() || "Untitled rule"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {summarizeRuleScope(rule)}
        </p>
        <p className="text-muted-foreground/80 mt-1.5 line-clamp-2 text-xs leading-relaxed">
          {preview}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-7 px-2.5 text-[11px]"
          data-ai-target={`settings.rules.edit.${rule.id}`}
        >
          Edit
        </Button>
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${rule.title || "rule"}`}
        />
      </div>
    </div>
  );
}

function RuleScopeFields({
  draft,
  onChange,
}: {
  draft: UserRule;
  onChange: (patch: Partial<UserRule>) => void;
}) {
  const projectGroups = useProjectAgentGroups();

  const scopeOptions: Array<ScopeOption<RuleScope>> = [
    {
      id: "all",
      label: "All projects & agents",
      description: "Apply this rule everywhere",
    },
    {
      id: "projects",
      label: "Specific projects",
      description: "Apply to every agent in selected projects",
    },
    {
      id: "agents",
      label: "Specific agents",
      description: "Apply only to selected agents",
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
    <div className="border-border-subtle/70 mt-3 space-y-3 border-t pt-3">
      <div>
        <p className="text-muted-foreground text-[11px] font-medium">Apply to</p>
        <p className="text-muted-foreground/80 mt-0.5 text-[10px] leading-relaxed">
          Choose which projects or agents should follow this rule.
        </p>
      </div>

      <ScopeOptionList
        options={scopeOptions}
        value={draft.scope}
        onSelect={(scope) => onChange({ scope })}
      />

      {draft.scope === "agents" ? (
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
            Agents
          </p>
          <AgentGroupCheckboxList
            groups={projectGroups}
            selectedIds={draft.selectedAgentIds}
            onToggle={toggleAgent}
            maxHeightClass="max-h-44"
          />
        </div>
      ) : null}

      {draft.scope === "projects" ? (
        <div>
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
            Projects
          </p>
          <ProjectCheckboxList
            groups={projectGroups}
            selectedIds={draft.selectedProjectIds}
            onToggle={toggleProject}
            maxHeightClass="max-h-36"
          />
        </div>
      ) : null}
    </div>
  );
}

function RuleComposer({
  draft,
  isNew,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: UserRule;
  isNew: boolean;
  onChange: (patch: Partial<UserRule>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const canSave = isRuleDraftValid(draft);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div
        className="border-border-subtle bg-panel/60 flex flex-col rounded-xl border px-3 py-3"
        data-ai-target={isNew ? "settings.rules.new" : "settings.rules.editor"}
      >
        <input
          type="text"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Title"
          className="text-foreground placeholder:text-muted-foreground/55 w-full bg-transparent px-1 py-1 text-sm font-medium outline-none"
          autoFocus
        />
        <textarea
          value={draft.content}
          onChange={(event) => onChange({ content: event.target.value })}
          placeholder="Style request, response language, tone..."
          className="text-foreground placeholder:text-muted-foreground/55 mt-1 min-h-[140px] w-full resize-y bg-transparent px-1 py-1 text-sm leading-relaxed outline-none"
        />
        <RuleScopeFields draft={draft} onChange={onChange} />
        <div className="flex items-center justify-end gap-1 pt-2">
          {!isNew && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive mr-auto h-8 px-3 text-sm"
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground h-8 px-3 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            className={cn(
              "h-8 px-3 text-sm",
              canSave
                ? "text-foreground hover:text-foreground"
                : "text-muted-foreground/45",
            )}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsRulesPanel() {
  const { rules, upsertRule, deleteRule, setRuleEnabled } = useRules();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserRule | null>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    const next = createEmptyUserRule();
    setDraft(next);
    setEditingId(next.id);
    setIsNew(true);
  };

  const startEdit = (rule: UserRule) => {
    setDraft({ ...rule });
    setEditingId(rule.id);
    setIsNew(false);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
    setIsNew(false);
  };

  const saveDraft = () => {
    if (!draft || !isRuleDraftValid(draft)) return;
    upsertRule({
      ...draft,
      title: draft.title.trim(),
      content: draft.content.trim(),
    });
    cancelEdit();
  };

  const deleteDraft = () => {
    if (!draft) return;
    deleteRule(draft.id);
    cancelEdit();
  };

  if (draft && editingId) {
    return (
      <RuleComposer
        draft={draft}
        isNew={isNew}
        onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
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
          Persistent instructions scoped to projects or agents that shape how
          models respond.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-8 shrink-0 gap-1.5 rounded-md px-3 text-sm"
          onClick={startNew}
          data-ai-target="settings.rules.new-button"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {rules.length === 0 ? (
        <div
          className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center"
          data-ai-target="settings.rules.empty"
        >
          <ScrollText className="text-muted-foreground mb-3 h-8 w-8 opacity-60" />
          <p className="text-sm font-medium text-foreground">No rules yet</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
            Add rules to set tone, language, formatting, or other preferences,
            and choose which projects or agents they apply to.
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
          {rules.map((rule) => (
            <RuleListItem
              key={rule.id}
              rule={rule}
              onEdit={() => startEdit(rule)}
              onToggle={(enabled) => setRuleEnabled(rule.id, enabled)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
