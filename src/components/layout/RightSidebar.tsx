import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WeightSlider } from "@/components/ui/weight-slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableSidebar } from "@/components/ui/resizable-panels";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { ModelLogo } from "@/components/models/ModelLogo";
import { popularAiModels } from "@/data/ai-models";
import { useRoundTable } from "@/context/RoundTableContext";
import { useLayout, type RightPanelId } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

const ROUND_TABLE_DESCRIPTION =
  "Send one prompt to several models at once. Adjust each model’s weight, then blend their answers into a single response.";

const WORKFLOW_DESCRIPTION =
  "Build a step-by-step pipeline of models and tools that run in order on your prompt.";

const ModelRow = memo(function ModelRow({
  modelId,
  name,
  role,
  weight,
  orgId,
  active,
  onToggle,
  onWeightChange,
}: {
  modelId: string;
  name: string;
  role: string;
  weight: number;
  orgId: string;
  active: boolean;
  onToggle: (id: string) => void;
  onWeightChange: (id: string, weight: number) => void;
}) {
  return (
    <section
      className={cn(
        "space-y-2.5 border px-3 py-3 transition-colors",
        active
          ? "border-foreground/30 bg-panel-elevated"
          : "border-transparent opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(modelId)}
        aria-pressed={active}
        aria-label={`${active ? "Disable" : "Enable"} ${name} for chat`}
        className="flex w-full items-start gap-3 text-left"
      >
        <ModelLogo orgId={orgId} size="md" muted={!active} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{role}</span>
        </span>
        <span
          className="text-sm font-medium tabular-nums text-muted-foreground"
          title="Model allocation"
        >
          {active ? `${weight}%` : "Off"}
        </span>
      </button>

      <div
        className="px-0.5"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <WeightSlider
          value={active ? weight : 0}
          disabled={!active}
          onChange={(w) => onWeightChange(modelId, w)}
          aria-label={`${name} allocation ${weight}%`}
        />
      </div>
    </section>
  );
});

function RoundTableSection({
  enabled,
  onEnabledChange,
  onClose,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const {
    selectedIds,
    activeIds,
    roundTableModels,
    isActive,
    toggleActive,
    setModelWeight,
  } = useRoundTable();

  const weightById = new Map(roundTableModels.map((m) => [m.id, m.weight]));
  const tableModels = popularAiModels.filter((m) => selectedIds.includes(m.id));
  const activeCount = activeIds.length;
  const allocationSum = roundTableModels.reduce((sum, m) => sum + m.weight, 0);

  return (
    <SidebarPanel
      title="Round Table"
      titleDescription={ROUND_TABLE_DESCRIPTION}
      active={enabled}
      fill={enabled}
      onClose={onClose}
      headerExtra={
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label="Toggle Round Table"
        />
      }
    >
      <ScrollArea className={cn(enabled && "h-full")}>
        <section className="p-4">
          {enabled ? (
            tableModels.length === 0 ? (
              <p className="text-xs text-muted">
                Add models in the Model Cart to use the Round Table.
              </p>
            ) : (
              <>
                <section className="space-y-1">
                  {tableModels.map((model) => {
                    const active = isActive(model.id);
                    return (
                      <ModelRow
                        key={model.id}
                        modelId={model.id}
                        name={model.name}
                        role={model.role}
                        orgId={model.orgId}
                        weight={weightById.get(model.id) ?? 0}
                        active={active}
                        onToggle={toggleActive}
                        onWeightChange={setModelWeight}
                      />
                    );
                  })}
                </section>
                <p className="border-t border-border-subtle pt-3 text-right text-xs text-muted">
                  {activeCount > 0 ? (
                    <>
                      <span className="font-medium text-foreground">
                        {activeCount}
                      </span>{" "}
                      active · Combined input{" "}
                      <span className="font-medium text-foreground">
                        {allocationSum}%
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No models active for chat
                    </span>
                  )}
                </p>
              </>
            )
          ) : (
            <p className="text-xs text-muted">Round Table is off</p>
          )}
        </section>
      </ScrollArea>
    </SidebarPanel>
  );
}

function WorkflowSection({ onClose }: { onClose: () => void }) {
  return (
    <SidebarPanel
      title="Workflow"
      titleDescription={WORKFLOW_DESCRIPTION}
      active
      fill={false}
      onClose={onClose}
      headerExtra={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:bg-zinc-700 hover:text-foreground"
        >
          Edit
        </Button>
      }
    >
      <section className="shrink-0 p-2" aria-label="Workflow">
        <section className="h-48 min-h-48 max-h-48 w-full shrink-0 rounded-lg border border-dashed border-border-subtle bg-surface/50" />
      </section>
    </SidebarPanel>
  );
}

export function RightSidebar() {
  const { rightPanels, setRightPanelVisible } = useLayout();
  const [roundTableEnabled, setRoundTableEnabled] = useState(true);
  const showRoundTable = rightPanels.roundTable;
  const showWorkflow = rightPanels.workflow;
  const closePanel = (id: RightPanelId) => setRightPanelVisible(id, false);

  const roundTableExpanded = showRoundTable && roundTableEnabled;
  const workflowExpanded = showWorkflow && (!showRoundTable || !roundTableEnabled);

  return (
    <ResizableSidebar
      side="right"
      defaultWidth={288}
      minWidth={240}
      maxWidth={480}
      storageKey="prompt:right-sidebar-width"
      className="min-h-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {showRoundTable && (
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden",
              roundTableExpanded && showWorkflow
                ? "min-h-0 flex-1"
                : roundTableExpanded
                  ? "flex-1"
                  : "shrink-0",
            )}
          >
            <RoundTableSection
              enabled={roundTableEnabled}
              onEnabledChange={setRoundTableEnabled}
              onClose={() => closePanel("roundTable")}
            />
          </div>
        )}
        {showWorkflow && (
          <div
            className={cn(
              "flex min-h-0 flex-col overflow-hidden",
              workflowExpanded ? "min-h-0 flex-1" : "shrink-0",
              showRoundTable && "border-t border-border-subtle",
            )}
          >
            <WorkflowSection onClose={() => closePanel("workflow")} />
          </div>
        )}
        {!showRoundTable && !showWorkflow && (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted">
            Use View to select a panel.
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t border-border-subtle p-4">
        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Tokens", value: "12.4k" },
            { label: "Cost", value: "$0.042" },
            { label: "Time", value: "3.2s" },
          ].map((stat) => (
            <section
              key={stat.label}
              className="rounded-lg border border-border-subtle bg-surface px-2 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {stat.value}
              </p>
            </section>
          ))}
        </section>

        <button
          type="button"
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs text-muted-foreground",
            "hover:bg-panel-elevated hover:text-foreground",
          )}
        >
          View Full Breakdown
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </ResizableSidebar>
  );
}
