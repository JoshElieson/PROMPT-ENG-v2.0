import { SquareSplitHorizontal } from "lucide-react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { RecursiveSplitWorkspace } from "@/components/layout/RecursiveSplitWorkspace";
import { Button } from "@/components/ui/button";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useChats } from "@/contexts/ChatsContext";
import {
  WorkspacePanesProvider,
  useWorkspacePanes,
} from "@/contexts/WorkspacePanesContext";
import {
  WORKSPACE_HEADER_SURFACE,
  workspaceHeaderRowClass,
} from "@/lib/workspace-header";
import { cn } from "@/lib/utils";

function WorkspaceMainToolbar() {
  const { expandLayout, paneCount, maxPanes } = useWorkspacePanes();

  const handleSplit = () => {
    const host = document.querySelector<HTMLElement>(
      "[data-workspace-split-host]",
    );
    const rect = host?.getBoundingClientRect();
    const wide = rect ? rect.width >= rect.height : true;
    expandLayout(wide);
  };

  return (
    <header
      className={workspaceHeaderRowClass(
        true,
        cn(
          WORKSPACE_HEADER_SURFACE,
          "shrink-0 justify-end gap-1.5 px-2",
        ),
      )}
    >
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group h-7 w-7 shrink-0 text-muted-foreground hover:bg-zinc-700 hover:text-foreground"
          title={
            paneCount >= maxPanes
              ? "Maximum panes (4)"
              : "Add pane (split direction follows workspace shape)"
          }
          disabled={paneCount >= maxPanes}
          onClick={handleSplit}
          aria-label="Add chat pane"
        >
          <SquareSplitHorizontal className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Button>
        <LayoutMenu />
      </div>
    </header>
  );
}

export function MainWorkspace() {
  const { activeWorkspaceLayout, activeChatId } = useChats();
  const { isWorkspaceScreenSelected } = useAppSelection();

  if (!activeChatId || !activeWorkspaceLayout) {
    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No chat selected. Create or open a chat from the left sidebar.
        </div>
      </main>
    );
  }

  return (
    <WorkspacePanesProvider>
      <main
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-background",
          isWorkspaceScreenSelected && "ring-1 ring-inset ring-accent/15",
        )}
      >
        <WorkspaceMainToolbar />
        <div
          data-workspace-split-host
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <RecursiveSplitWorkspace />
        </div>
      </main>
    </WorkspacePanesProvider>
  );
}
