import { useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  CircleDashed,
  FilePenLine,
  FileSearch,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentActivityEvent, AgentActivityType } from "@/types/agent-activity";

interface AIActivityStreamProps {
  events: AgentActivityEvent[];
  className?: string;
}

const TYPE_META: Record<
  AgentActivityType,
  { label: string; icon: typeof CircleDashed; className: string }
> = {
  analyzing: {
    label: "Analyzing",
    icon: Sparkles,
    className: "text-indigo-300",
  },
  searching: {
    label: "Searching",
    icon: Search,
    className: "text-sky-300",
  },
  reading: {
    label: "Reading",
    icon: FileText,
    className: "text-slate-300",
  },
  planning: {
    label: "Planning",
    icon: FileSearch,
    className: "text-violet-300",
  },
  editing: {
    label: "Editing",
    icon: FilePenLine,
    className: "text-amber-300",
  },
  creating: {
    label: "Creating",
    icon: CircleDashed,
    className: "text-emerald-300",
  },
  deleting: {
    label: "Deleting",
    icon: Trash2,
    className: "text-rose-300",
  },
  checking: {
    label: "Checking",
    icon: ShieldCheck,
    className: "text-cyan-300",
  },
  error: {
    label: "Error",
    icon: TriangleAlert,
    className: "text-rose-300",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    className: "text-emerald-300",
  },
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AIActivityStream({ events, className }: AIActivityStreamProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const hasEvents = events.length > 0;

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events],
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [sortedEvents]);

  if (!hasEvents) return null;

  return (
    <section
      className={cn(
        "border-border/65 bg-panel/30 rounded-lg border px-3 py-2",
        className,
      )}
      aria-live="polite"
      aria-label="AI activity stream"
    >
      <header className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          AI Activity
        </span>
        <span className="text-muted-foreground/80 text-[11px]">
          {sortedEvents.length} {sortedEvents.length === 1 ? "event" : "events"}
        </span>
      </header>

      <div
        ref={listRef}
        className="max-h-44 space-y-1.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
      >
        {sortedEvents.map((event) => {
          const meta = TYPE_META[event.type];
          const Icon = meta.icon;
          return (
            <article
              key={event.id}
              className="bg-background/35 rounded-md px-2 py-1.5"
            >
              <div className="flex items-start gap-2">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.className)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-[11px] font-medium", meta.className)}>
                      {meta.label}
                    </span>
                    <time className="text-muted-foreground/80 text-[10px]">
                      {formatTimestamp(event.timestamp)}
                    </time>
                  </div>
                  <p className="text-foreground/90 text-xs leading-relaxed">
                    {event.message}
                  </p>
                  {event.filePath ? (
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {event.filePath}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
