import { cn } from "@/lib/utils";

/** Shared workspace grid cell — flush edges, no per-panel outer borders. */
export const WORKSPACE_PANEL_BASE =
  "flex min-h-0 min-w-0 flex-col overflow-hidden outline-none";

export const WORKSPACE_PANEL_SURFACE = "bg-panel/85";

/** Subtle focus when this cell owns app selection (not tab chrome). */
export const WORKSPACE_PANEL_FOCUSED =
  "bg-panel-elevated/25 ring-1 ring-inset ring-accent/10";

export function workspacePanelClass({
  focused = false,
  className,
}: {
  focused?: boolean;
  className?: string;
} = {}) {
  return cn(
    WORKSPACE_PANEL_BASE,
    WORKSPACE_PANEL_SURFACE,
    focused && WORKSPACE_PANEL_FOCUSED,
    className,
  );
}
