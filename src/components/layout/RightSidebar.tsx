import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { WeightSlider } from "@/components/ui/weight-slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanels, ResizableSidebar } from "@/components/ui/resizable-panels";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { ModelLogo } from "@/components/models/ModelLogo";
import { popularAiModels } from "@/data/ai-models";
import { useRoundTable } from "@/context/RoundTableContext";
import { cn } from "@/lib/utils";

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
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
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

function SkeletonLines() {
  return (
    <section className="space-y-2.5 py-2">
      {[100, 85, 70, 45].map((w) => (
        <span
          key={w}
          className="block h-2 animate-pulse rounded-full bg-panel-elevated"
          style={{ width: `${w}%` }}
        />
      ))}
    </section>
  );
}

function RoundTableSection() {
  const [roundTableEnabled, setRoundTableEnabled] = useState(true);
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
      active
      headerExtra={
        <Switch
          checked={roundTableEnabled}
          onCheckedChange={setRoundTableEnabled}
          aria-label="Toggle Round Table"
        />
      }
    >
      <ScrollArea className="h-full">
        <section className="p-4">
          {roundTableEnabled ? (
            tableModels.length === 0 ? (
              <p className="text-xs text-muted">
                Add models in the Model Cart to use the Round Table.
              </p>
            ) : (
              <>
                <p className="mb-3 text-[11px] text-muted">
                  Click to include or exclude · set each model&apos;s input
                  share (0–100%)
                </p>
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

function ResponseSection() {
  return (
    <SidebarPanel title="Response" active>
      <ScrollArea className="h-full">
        <section className="p-4">
          <section className="flex items-center justify-between">
            <span className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Streaming
              <ChevronDown className="h-3 w-3" />
            </span>
          </section>
          <p className="mt-3 text-xs text-muted">Synthesizing response...</p>
          <SkeletonLines />
        </section>
      </ScrollArea>
    </SidebarPanel>
  );
}

export function RightSidebar() {
  return (
    <ResizableSidebar
      side="right"
      defaultWidth={288}
      minWidth={240}
      maxWidth={480}
      storageKey="prompt:right-sidebar-width"
      className="min-h-0"
    >
      <ResizablePanels
        direction="vertical"
        storageKey="prompt:right-panels"
        defaultSizes={[0.55, 0.45]}
        className="min-h-0 flex-1"
        panels={[
          { id: "round-table", minSize: 120, content: <RoundTableSection /> },
          { id: "response", minSize: 100, content: <ResponseSection /> },
        ]}
      />

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
