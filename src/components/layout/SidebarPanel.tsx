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
  /** Centered between title and right-side actions (e.g. toggle). */
  headerCenter?: ReactNode;
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
  headerCenter,
  headerExtra,
  onClose,
  fill = true,
  className,
}: SidebarPanelProps) {
  const titleHeading =
    title ? (
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
    );

  const closeButton = onClose ? (
    <button
      type="button"
      onClick={onClose}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-panel-elevated hover:text-foreground"
      aria-label={title ? `Close ${title}` : "Close panel"}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  ) : null;

  return (
    <section
      className={cn(
        "flex flex-col bg-panel",
        fill ? "min-h-0 flex-1" : "shrink-0",
        active && "bg-panel-elevated/30",
        className,
      )}
    >
      {(title ?? headerCenter ?? headerExtra ?? onClose) && (
        <header
          className={workspaceHeaderRowClass(
            active ?? false,
            headerCenter
              ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3"
              : "justify-between px-3",
          )}
        >
          {headerCenter ? (
            <>
              <div className="flex min-w-0 items-center justify-self-start">
                {titleHeading}
              </div>
              <div className="flex justify-center justify-self-center">
                {headerCenter}
              </div>
              <div className="flex items-center justify-end gap-1 justify-self-end">
                {headerExtra}
                {closeButton}
              </div>
            </>
          ) : (
            <>
              {titleHeading}
              <div className="flex items-center gap-1">
                {headerExtra}
                {closeButton}
              </div>
            </>
          )}
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
