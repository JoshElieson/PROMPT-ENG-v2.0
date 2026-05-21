import { useEffect } from "react";

import { Terminal } from "lucide-react";

import { LayoutMenu } from "@/components/layout/LayoutMenu";

import { RecursiveSplitWorkspace } from "@/components/layout/RecursiveSplitWorkspace";

import { WorkspaceBottomPanel } from "@/components/workspace/WorkspaceBottomPanel";

import { Button } from "@/components/ui/button";

import { ResizablePanels } from "@/components/ui/resizable-panels";

import { useAppSelection } from "@/contexts/AppSelectionContext";

import { useChats } from "@/contexts/ChatsContext";

import { useLayout } from "@/contexts/LayoutContext";

import { WorkspacePanesProvider } from "@/contexts/WorkspacePanesContext";

import {

  WORKSPACE_HEADER_SURFACE,

  workspaceHeaderRowClass,

} from "@/lib/workspace-header";

import { cn } from "@/lib/utils";



function WorkspaceMainToolbar() {

  const { workspaceBottomPanelOpen, setWorkspaceBottomPanelOpen } = useLayout();

  const { selectBottomPanel } = useAppSelection();



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

          className={cn(

            "group h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground",

            workspaceBottomPanelOpen && "bg-panel-elevated/90 text-foreground",

          )}

          title={

            workspaceBottomPanelOpen ? "Hide panel" : "Show panel"

          }

          aria-label={

            workspaceBottomPanelOpen ? "Hide panel" : "Show panel"

          }

          onClick={() => {

            const next = !workspaceBottomPanelOpen;

            setWorkspaceBottomPanelOpen(next);

            if (next) selectBottomPanel();

          }}

        >

          <Terminal className="h-4 w-4" />

        </Button>

        <LayoutMenu />

      </div>

    </header>

  );

}



function WorkspaceCenter() {

  const { workspaceBottomPanelOpen, setWorkspaceBottomPanelOpen } = useLayout();

  const { selectWorkspaceScreen, zone } = useAppSelection();

  const showBottomPanel = workspaceBottomPanelOpen;



  useEffect(() => {

    if (!showBottomPanel && zone === "bottom-panel") {

      selectWorkspaceScreen();

    }

  }, [showBottomPanel, zone, selectWorkspaceScreen]);



  const handleCloseBottomPanel = () => {

    setWorkspaceBottomPanelOpen(false);

    selectWorkspaceScreen();

  };



  if (!showBottomPanel) {

    return <RecursiveSplitWorkspace />;

  }



  return (

    <ResizablePanels

      direction="vertical"

      storageKey="prompt:workspace-terminal-split"

      defaultSizes={[0.78, 0.22]}

      className="min-h-0 min-w-0 flex-1"

      panels={[

        {

          id: "chat",

          minSize: 160,

          content: <RecursiveSplitWorkspace />,

        },

        {

          id: "terminal",

          minSize: 120,

          content: (

            <WorkspaceBottomPanel

              onClose={handleCloseBottomPanel}

              className="h-full"

            />

          ),

        },

      ]}

    />

  );

}



export function MainWorkspace() {

  const { activeWorkspaceLayout, activeChatId } = useChats();

  const { isWorkspaceScreenSelected } = useAppSelection();



  if (!activeChatId || !activeWorkspaceLayout) {

    return (

      <main className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">

        <div className="text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center text-sm">

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

          isWorkspaceScreenSelected && "ring-1 ring-inset ring-[#6366f1]/18",

        )}

      >

        <WorkspaceMainToolbar />

        <div

          data-workspace-split-host

          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"

        >

          <WorkspaceCenter />

        </div>

      </main>

    </WorkspacePanesProvider>

  );

}

