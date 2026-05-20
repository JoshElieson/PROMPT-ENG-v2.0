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
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
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
        className="flex w-full cursor-pointer items-start gap-3 text-left"
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

function RoundTableSection({ onClose }: { onClose: () => void }) {
  const {
    selectedIds,
    activeIds,
    roundTableModels,
    isActive,
    toggleActive,
    setModelWeight,
  } = useChatRoundTable();

  const weightById = new Map(roundTableModels.map((m) => [m.id, m.weight]));
  const tableModels = popularAiModels.filter((m) => selectedIds.includes(m.id));
  const activeCount = activeIds.length;
  const allocationSum = roundTableModels.reduce((sum, m) => sum + m.weight, 0);

  return (
    <SidebarPanel
      title="Round Table"
      titleDescription={ROUND_TABLE_DESCRIPTION}
      active
      fill
      onClose={onClose}
    >
      <ScrollArea className="h-full">
        <section className="p-4">
          {tableModels.length === 0 ? (
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
          )}
        </section>
      </ScrollArea>
    </SidebarPanel>
  );
}

function WorkflowSection({ onClose }: { onClose: () => void }) {
  const [workflowEnabled, setWorkflowEnabled] = useState(false);

  return (
    <SidebarPanel
      title="Workflow"
      titleDescription={WORKFLOW_DESCRIPTION}
      fill={false}
      className="bg-panel-elevated/30"
      onClose={onClose}
      headerCenter={
        <Switch
          checked={workflowEnabled}
          onCheckedChange={setWorkflowEnabled}
          aria-label="Run workflow on send"
          className="scale-90"
        />
      }
      headerExtra={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:bg-panel-elevated hover:text-foreground"
        >
          Edit
        </Button>
      }
    >
      <section className="shrink-0 p-2" aria-label="Workflow">
        <section
          className={cn(
            "h-56 min-h-56 max-h-56 w-full shrink-0 rounded-lg border border-border-subtle bg-panel-elevated/40 transition-opacity",
            !workflowEnabled && "pointer-events-none opacity-40",
          )}
        />
      </section>
    </SidebarPanel>
  );
}

export function RightSidebar() {
  const { rightPanels, setRightPanelVisible } = useLayout();
  const showRoundTable = rightPanels.roundTable;
  const showWorkflow = rightPanels.workflow;
  const closePanel = (id: RightPanelId) => setRightPanelVisible(id, false);

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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <RoundTableSection onClose={() => closePanel("roundTable")} />
          </div>
        )}
        {showWorkflow && !showRoundTable && (
          <div className="min-h-0 flex-1" aria-hidden />
        )}
        {!showRoundTable && !showWorkflow && (
          <p className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted">
            Use View to select a panel.
          </p>
        )}
        {showWorkflow && (
          <div
            className={cn(
              "flex shrink-0 flex-col overflow-hidden",
              showRoundTable && "border-t border-border-subtle",
            )}
          >
            <WorkflowSection onClose={() => closePanel("workflow")} />
          </div>
        )}
      </div>

      <footer className="flex min-h-workspace-dock shrink-0 flex-col gap-2 border-t border-border-subtle px-3 pb-2.5 pt-3">
        <section className="grid min-h-0 flex-1 grid-cols-3 gap-2">
          {[
            { label: "Tokens", value: "12.4k" },
            { label: "Cost", value: "$0.042" },
            { label: "Time", value: "3.2s" },
          ].map((stat) => (
            <section
              key={stat.label}
              className="flex h-full min-h-0 flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface px-2 py-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {stat.value}
              </p>
            </section>
          ))}
        </section>

        <button
          type="button"
          className={cn(
            "flex w-full shrink-0 items-center justify-center gap-1 rounded-lg py-2 text-xs text-muted-foreground",
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
