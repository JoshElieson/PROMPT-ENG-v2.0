import { useEffect } from "react";

import { File, Globe, Terminal } from "lucide-react";

import { LayoutMenu } from "@/components/layout/LayoutMenu";

import {
  RecursiveSplitWorkspace,
  WorkspaceAgentTabs,
} from "@/components/layout/RecursiveSplitWorkspace";

import { WorkspaceBottomPanel } from "@/components/workspace/WorkspaceBottomPanel";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";

import { Button } from "@/components/ui/button";

import { ResizablePanels } from "@/components/ui/resizable-panels";

import { useAppSelection } from "@/contexts/AppSelectionContext";

import { useChats } from "@/contexts/ChatsContext";

import { useLayout } from "@/contexts/LayoutContext";

import {
  WorkspaceBottomPanelProvider,
  useWorkspaceBottomPanel,
  type BottomPanelTabKind,
} from "@/contexts/WorkspaceBottomPanelContext";

import { WorkspacePanesProvider } from "@/contexts/WorkspacePanesContext";

import {
  WORKSPACE_HEADER_SURFACE,
  workspaceHeaderRowClass,
} from "@/lib/workspace-header";

import { cn } from "@/lib/utils";
import {
  WORKSPACE_CHAT_MIN_RATIO,
  WORKSPACE_SECONDARY_COLLAPSE_THRESHOLD_PX,
  WORKSPACE_SECONDARY_MAX_RATIO,
  WORKSPACE_SECONDARY_MIN_PX,
} from "@/lib/workspace-chat-split";

const workspaceToolbarIconClass =
  "group h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground";

function WorkspaceToolbarIconButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
  targetId,
}: {
  icon: typeof Terminal;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  targetId?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      className={cn(
        workspaceToolbarIconClass,
        active && "bg-panel-elevated/90 text-foreground",
        disabled && "opacity-50",
      )}
      title={label}
      data-ai-target={targetId}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function BottomPanelKindButton({
  kind,
  active,
  onClick,
}: {
  kind: BottomPanelTabKind;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = kind === "terminal" ? Terminal : Globe;
  const label = kind === "terminal" ? "Terminal" : "Browser";
  const targetId =
    kind === "terminal"
      ? "workspace.bottom.terminal-toggle"
      : "workspace.bottom.browser-toggle";

  return (
    <WorkspaceToolbarIconButton
      icon={Icon}
      label={label}
      active={active}
      onClick={onClick}
      targetId={targetId}
    />
  );
}

function WorkspaceMainToolbar() {
  const { workspaceBottomPanelOpen, toggleBottomPanelKind } = useLayout();
  const { selectBottomPanel } = useAppSelection();
  const { isKindVisible } = useWorkspaceBottomPanel();

  const openOrFocusKind = (kind: BottomPanelTabKind) => {
    const wasVisible = workspaceBottomPanelOpen && isKindVisible(kind);
    toggleBottomPanelKind(kind);
    if (!wasVisible) selectBottomPanel();
  };

  return (
    <header
      className={workspaceHeaderRowClass(
        true,
        cn(
          WORKSPACE_HEADER_SURFACE,
          "min-w-0 shrink-0 gap-1 overflow-hidden pl-1.5 pr-2",
        ),
      )}
    >
      <WorkspaceAgentTabs />

      <div className="flex shrink-0 items-center gap-1">
        <BottomPanelKindButton
          kind="terminal"
          active={workspaceBottomPanelOpen && isKindVisible("terminal")}
          onClick={() => openOrFocusKind("terminal")}
        />
        <BottomPanelKindButton
          kind="browser"
          active={workspaceBottomPanelOpen && isKindVisible("browser")}
          onClick={() => openOrFocusKind("browser")}
        />
        <WorkspaceToolbarIconButton icon={File} label="Files" disabled />
        <LayoutMenu />
      </div>
    </header>
  );
}

function WorkspaceCenter({
  isHorizontalDefault,
  onCloseBottomPanel,
}: {
  isHorizontalDefault: boolean;
  onCloseBottomPanel: () => void;
}) {
  const { workspaceBottomPanelOpen } = useLayout();
  const {
    selectWorkspaceScreen,
    zone,
    isWorkspaceScreenSelected,
    isBottomPanelSelected,
  } = useAppSelection();

  const showBottomPanel = workspaceBottomPanelOpen;

  useEffect(() => {
    if (!showBottomPanel && zone === "bottom-panel") {
      selectWorkspaceScreen();
    }
  }, [showBottomPanel, zone, selectWorkspaceScreen]);

  if (!showBottomPanel) {
    return (
      <WorkspacePanel focused={isWorkspaceScreenSelected} className="min-h-0 flex-1">
        <RecursiveSplitWorkspace />
      </WorkspacePanel>
    );
  }

  return (
    <ResizablePanels
      direction={isHorizontalDefault ? "horizontal" : "vertical"}
      storageKey={
        isHorizontalDefault
          ? "prompt:workspace-terminal-split-horizontal"
          : "prompt:workspace-terminal-split-vertical"
      }
      defaultSizes={isHorizontalDefault ? [0.62, 0.38] : [0.78, 0.22]}
      className="min-h-0 min-w-0 flex-1"
      onTrailingPanelCollapse={onCloseBottomPanel}
      panels={[
        {
          id: "chat",
          minSize: 160,
          ...(isHorizontalDefault
            ? { minRatio: WORKSPACE_CHAT_MIN_RATIO }
            : {}),
          content: (
            <WorkspacePanel
              focused={isWorkspaceScreenSelected}
              className="min-h-0 flex-1"
            >
              <RecursiveSplitWorkspace />
            </WorkspacePanel>
          ),
        },
        {
          id: "secondary",
          minSize: isHorizontalDefault ? WORKSPACE_SECONDARY_MIN_PX : 120,
          collapsible: true,
          collapseThreshold: WORKSPACE_SECONDARY_COLLAPSE_THRESHOLD_PX,
          ...(isHorizontalDefault
            ? { maxRatio: WORKSPACE_SECONDARY_MAX_RATIO }
            : {}),
          content: (
            <WorkspacePanel focused={isBottomPanelSelected} className="min-h-0 flex-1">
              <WorkspaceBottomPanel
                onClose={onCloseBottomPanel}
                placement={isHorizontalDefault ? "side" : "bottom"}
                className="h-full"
              />
            </WorkspacePanel>
          ),
        },
      ]}
    />
  );
}

function MainWorkspaceBody() {
  const { activeLayoutId, setWorkspaceBottomPanelOpen } = useLayout();
  const { selectWorkspaceScreen } = useAppSelection();
  const isHorizontalDefault = activeLayoutId === "horizontal";

  const handleCloseBottomPanel = () => {
    setWorkspaceBottomPanelOpen(false);
    selectWorkspaceScreen();
  };

  return (
    <>
      <WorkspaceMainToolbar />

      <div
        data-workspace-split-host
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <WorkspaceCenter
          isHorizontalDefault={isHorizontalDefault}
          onCloseBottomPanel={handleCloseBottomPanel}
        />
      </div>
    </>
  );
}

export function MainWorkspace() {
  const { activeWorkspaceLayout, activeChatId } = useChats();
  const { selectWorkspaceScreen } = useAppSelection();
  const { setWorkspaceBottomPanelOpen } = useLayout();

  const handleCloseBottomPanel = () => {
    setWorkspaceBottomPanelOpen(false);
    selectWorkspaceScreen();
  };

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
      <WorkspaceBottomPanelProvider onClose={handleCloseBottomPanel}>
        <main
          className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background"
          data-ai-scope="workspace"
        >
          <MainWorkspaceBody />
        </main>
      </WorkspaceBottomPanelProvider>
    </WorkspacePanesProvider>
  );
}
