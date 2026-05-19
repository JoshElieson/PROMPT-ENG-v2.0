import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarPanelProps {
  title: string;
  titleIcon?: ReactNode;
  active?: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function SidebarPanel({
  title,
  titleIcon,
  active,
  children,
  headerExtra,
}: SidebarPanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-panel",
        active && "bg-panel-elevated/30",
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-2",
          active && "border-accent/20",
        )}
      >
        <h3
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider",
            active ? "text-accent" : "text-muted",
          )}
        >
          {titleIcon}
          {title}
        </h3>
        {headerExtra}
      </header>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </section>
    </section>
  );
}
