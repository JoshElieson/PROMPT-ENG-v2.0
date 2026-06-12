import { BrowserTabPane } from "@/components/workspace/BrowserTabPane";
import { TerminalTabPane } from "@/components/workspace/TerminalTabPane";
import { ToolPanelHeader } from "@/components/workspace/ToolPanelHeader";
import { SplitPaneGroup } from "@/components/workspace/SplitPaneGroup";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useWorkspaceBottomPanel } from "@/contexts/WorkspaceBottomPanelContext";
import { useTerminalCwd } from "@/lib/terminal-cwd";
import { cn } from "@/lib/utils";

interface WorkspaceBottomPanelProps {
  onClose: () => void;
  placement?: "bottom" | "side";
  className?: string;
}

export function WorkspaceBottomPanel({
  onClose,
  placement = "bottom",
  className,
}: WorkspaceBottomPanelProps) {
  const { cwd: terminalCwd, ready: terminalCwdReady } = useTerminalCwd();
  const { selectBottomPanel } = useAppSelection();
  const {
    tabs,
    activeTabId,
    splitOrientation,
    visibleTabIds,
    setVisibleTabIds,
    requestTabFocus,
    dragTabId,
    setDragTabId,
    twoPaneSizes,
    setTwoPaneSizes,
    threePanePrimarySizes,
    setThreePanePrimarySizes,
    threePaneSecondarySizes,
    setThreePaneSecondarySizes,
    newTabMenuOpen,
  } = useWorkspaceBottomPanel();
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));

  return (
    <section
      data-workspace-bottom-panel
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col outline-none", className)}
      aria-label={placement === "bottom" ? "Bottom panel" : "Side panel"}
      onMouseDown={() => selectBottomPanel()}
    >
      <ToolPanelHeader onClosePanel={onClose} />

      <div className="relative min-h-0 flex-1">
        <SplitPaneGroup
          visiblePaneIds={visibleTabIds}
          draggingPaneId={dragTabId}
          orientation={splitOrientation}
          twoSizes={twoPaneSizes}
          onTwoSizesChange={setTwoPaneSizes}
          threePrimarySizes={threePanePrimarySizes}
          onThreePrimarySizesChange={setThreePanePrimarySizes}
          threeSecondarySizes={threePaneSecondarySizes}
          onThreeSecondarySizesChange={setThreePaneSecondarySizes}
          onDropComplete={(nextVisibleTabIds) => {
            setVisibleTabIds(nextVisibleTabIds);
            if (dragTabId && nextVisibleTabIds.includes(dragTabId)) {
              requestTabFocus(dragTabId);
            }
            setDragTabId(null);
          }}
          renderPane={(paneId) => {
            const tab = tabById.get(paneId);
            if (!tab) return null;
            return tab.kind === "terminal" ? (
              <TerminalTabPane
                key={tab.id}
                sessionId={tab.id}
                isFocused={tab.id === activeTabId}
                cwd={terminalCwd}
                cwdReady={terminalCwdReady}
                onRequestFocus={requestTabFocus}
              />
            ) : (
              <BrowserTabPane
                key={tab.id}
                tabId={tab.id}
                isFocused={tab.id === activeTabId}
                suppressNativeOverlay={newTabMenuOpen || dragTabId != null}
                onRequestFocus={requestTabFocus}
              />
            );
          }}
        />
      </div>
    </section>
  );
}
