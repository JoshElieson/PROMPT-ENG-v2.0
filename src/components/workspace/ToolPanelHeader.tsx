import { WorkspaceBottomPanelTabs } from "@/contexts/WorkspaceBottomPanelContext";
import { workspaceHeaderBorder } from "@/lib/workspace-header";
import { cn } from "@/lib/utils";

interface ToolPanelHeaderProps {
  onClosePanel: () => void;
}

/** Local tab row for terminal/browser tabs inside the right-side tool panel. */
export function ToolPanelHeader({ onClosePanel }: ToolPanelHeaderProps) {
  return (
    <header
      className={cn(
        "bg-panel/85 relative z-20 flex h-8 shrink-0 items-center justify-start border-b pr-2 pl-1",
        workspaceHeaderBorder(false),
      )}
    >
      <WorkspaceBottomPanelTabs onClosePanel={onClosePanel} />
    </header>
  );
}
