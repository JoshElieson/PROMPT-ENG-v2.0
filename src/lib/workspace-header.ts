import { cn } from "@/lib/utils";

/** Shared top-row chrome for Chats, active models, and Round Table headers. */
export const WORKSPACE_HEADER_ROW = "flex h-9 shrink-0 items-center border-b";

/** Same surface as an active `SidebarPanel` (panel + elevated tint). */
export const WORKSPACE_HEADER_SURFACE = "bg-panel bg-panel-elevated/30";

export function workspaceHeaderBorder(active = false) {
  return active ? "border-workspace-header-line" : "border-border-subtle";
}

export function workspaceHeaderRowClass(active = false, className?: string) {
  return cn(WORKSPACE_HEADER_ROW, workspaceHeaderBorder(active), className);
}
