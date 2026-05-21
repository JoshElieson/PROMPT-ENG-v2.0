import { memo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WeightSlider } from "@/components/ui/weight-slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableSidebar } from "@/components/ui/resizable-panels";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { ModelLogo } from "@/components/models/ModelLogo";
import { popularAiModels } from "@/data/ai-models";
import { useApiUsage } from "@/contexts/ApiUsageContext";
import { useModelMode } from "@/contexts/ModelModeContext";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { useLayout, type RightPanelId } from "@/contexts/LayoutContext";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";
import { workspaceHeaderRowClass } from "@/lib/workspace-header";
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
        "space-y-2.5 rounded-xl border px-3 py-3 transition-all duration-150",
        active
          ? "border-[#6366f1]/28 bg-panel-elevated/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-border/60 bg-panel-elevated/35 opacity-78",
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
    autoEnabled,
    deeperEnabled,
    setAutoEnabled,
    setDeeperEnabled,
    lastAutoPickedIds,
  } = useModelMode();
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
      title="Models"
      titleDescription={ROUND_TABLE_DESCRIPTION}
      active
      fill
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <section className={workspaceHeaderRowClass(true, "justify-between gap-1.5 px-3")}>
          <div className="flex shrink-0 items-center gap-1.5">
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Auto
                    </span>
                    <Switch
                      checked={autoEnabled}
                      onCheckedChange={setAutoEnabled}
                      aria-label="Toggle Auto mode"
                      className="scale-[0.85]"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-[260px]">
                  <p className="text-sm font-semibold">Auto</p>
                  <p>
                    Picks the best 1–2 models from your Model Cart for each
                    message. Badges appear only after Auto chooses who responds.
                  </p>
                  {autoEnabled && lastAutoPickedIds.length > 0 && (
                    <p className="mt-1 text-muted">
                      Last send:{" "}
                      {lastAutoPickedIds
                        .map((id) => popularAiModels.find((m) => m.id === id)?.name ?? id)
                        .join(" + ")}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Deeper
                    </span>
                    <Switch
                      checked={deeperEnabled}
                      onCheckedChange={setDeeperEnabled}
                      aria-label="Toggle Deeper mode"
                      className="scale-[0.85]"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-[260px]">
                  <p className="text-sm font-semibold">Deeper</p>
                  <p>
                    Toggle Deeper on to get higher-quality, more thoughtful
                    responses and use the most capable models. This may take
                    longer.
                  </p>
                  <p className="mt-1 text-muted">Billed at the model&apos;s API price.</p>
                </TooltipContent>
              </Tooltip>
          </div>
          <p className="shrink-0 text-[10px] leading-none text-muted">
              {activeCount > 0 ? (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span>
                    Active:{" "}
                    <span className="font-medium text-foreground">
                      {activeCount}
                    </span>
                  </span>
                  <span>
                    Total Input:{" "}
                    <span className="font-medium text-foreground">
                      {allocationSum}%
                    </span>
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No models active for chat
                </span>
              )}
            </p>
        </section>
        <ScrollArea className="min-h-0 flex-1">
          <section className="space-y-1 px-3 py-3">
            {tableModels.length === 0 ? (
              <p className="text-xs text-muted">
                Add models in the Model Cart to configure this panel.
              </p>
            ) : (
              tableModels.map((model) => {
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
              })
            )}
          </section>
        </ScrollArea>
      </div>
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
            "h-56 min-h-56 max-h-56 w-full shrink-0 rounded-xl border border-border/70 bg-panel-elevated/50 transition-opacity",
            !workflowEnabled && "pointer-events-none opacity-40",
          )}
        />
      </section>
    </SidebarPanel>
  );
}

export function RightSidebar() {
  const { usage } = useApiUsage();
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
        <section className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          {[
            {
              label: "Tokens",
              value: formatTokenCount(usage.tokens),
              title: "Estimated API tokens (input + output)",
            },
            {
              label: "Cost",
              value: formatCostUsd(usage.costUsd),
              title: "Estimated API cost from model pricing",
            },
          ].map((stat) => (
            <section
              key={stat.label}
              title={stat.title}
              className="flex h-full min-h-0 flex-col items-center justify-center rounded-xl border border-border bg-panel-elevated/65 px-2 py-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {stat.value}
              </p>
            </section>
          ))}
        </section>

        <button
          type="button"
          className={cn(
            "flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-transparent py-2 text-xs text-muted-foreground transition-all",
            "hover:border-border hover:bg-panel-elevated hover:text-foreground",
          )}
        >
          View Full Breakdown
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </ResizableSidebar>
  );
}
