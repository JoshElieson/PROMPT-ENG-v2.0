import type { ReactNode } from "react";
import { X } from "lucide-react";
import { PanelTitleInfo } from "@/components/layout/PanelTitleInfo";
import { workspaceHeaderRowClass } from "@/lib/workspace-header";
import { cn } from "@/lib/utils";

interface SidebarPanelProps {
  title?: string;
  /** Shown in a hover tooltip on the info icon beside the title. */
  titleDescription?: string;
  titleIcon?: ReactNode;
  active?: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
  onClose?: () => void;
  /** When false, panel sizes to content instead of growing in a flex parent. */
  fill?: boolean;
  className?: string;
}

export function SidebarPanel({
  title,
  titleDescription,
  titleIcon,
  active,
  children,
  headerExtra,
  onClose,
  fill = true,
  className,
}: SidebarPanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col bg-panel",
        fill ? "min-h-0 flex-1" : "shrink-0",
        active && "bg-panel-elevated/30",
        className,
      )}
    >
      {(title ?? headerExtra ?? onClose) && (
        <header
          className={workspaceHeaderRowClass(active, "justify-between px-3")}
        >
          {title ? (
            <h3
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider",
                active ? "text-accent" : "text-muted",
              )}
            >
              {titleIcon}
              {title}
              {titleDescription && title && (
                <PanelTitleInfo description={titleDescription} label={title} />
              )}
            </h3>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            {headerExtra}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-panel-elevated hover:text-foreground"
                aria-label={title ? `Close ${title}` : "Close panel"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </header>
      )}
      <section
        className={cn(
          "flex flex-col overflow-hidden",
          fill ? "min-h-0 flex-1" : "shrink-0",
        )}
      >
        {children}
      </section>
    </section>
  );
}
