import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanels, ResizableSidebar } from "@/components/ui/resizable-panels";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { useRoundTable } from "@/context/RoundTableContext";
import { cn } from "@/lib/utils";

function ModelRow({
  name,
  role,
  weight,
  color,
  initial,
}: {
  name: string;
  role: string;
  weight: number;
  color: string;
  initial: string;
}) {
  return (
    <section className="space-y-2 py-3">
      <section className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initial}
        </span>
        <section className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted">{role}</p>
        </section>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {weight}%
        </span>
      </section>
      <Progress value={weight} indicatorClassName="bg-accent" />
    </section>
  );
}

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
  const { roundTableModels } = useRoundTable();

  return (
    <SidebarPanel
      title="Round Table"
      active
      headerExtra={
        <Switch
          checked={roundTableEnabled}
          onCheckedChange={setRoundTableEnabled}
        />
      }
    >
      <ScrollArea className="h-full">
        <section className="p-4">
          {roundTableEnabled ? (
            <>
              {roundTableModels.map((model) => (
                <ModelRow key={model.id} {...model} />
              ))}
              <p className="border-t border-border-subtle pt-3 text-right text-xs text-muted">
                Total:{" "}
                <span className="font-medium text-foreground">100%</span>
              </p>
            </>
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
