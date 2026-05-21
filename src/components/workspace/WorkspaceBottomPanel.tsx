import { Globe, Plus, Terminal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { BrowserTabPane } from "@/components/workspace/BrowserTabPane";
import { TerminalTabPane } from "@/components/workspace/TerminalTabPane";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useTerminalCwd } from "@/lib/terminal-cwd";
import { useLayout } from "@/contexts/LayoutContext";
import { killTerminalSession } from "@/lib/workspace-terminal";
import { cn } from "@/lib/utils";

export type BottomPanelTabKind = "terminal" | "browser";

export interface BottomPanelTab {
  id: string;
  title: string;
  kind: BottomPanelTabKind;
}

type DropSide = "before" | "after";

interface WorkspaceBottomPanelProps {
  onClose: () => void;
  className?: string;
}

function createTab(kind: BottomPanelTabKind, nextIndex: number): BottomPanelTab {
  const label = kind === "terminal" ? "Terminal" : "Browser";
  return {
    id: crypto.randomUUID(),
    title: `${label} ${nextIndex}`,
    kind,
  };
}

function dropSideFromPointer(e: DragEvent<HTMLDivElement>): DropSide {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
}

function reorderByPlacement(
  items: BottomPanelTab[],
  sourceTabId: string,
  targetTabId: string,
  side: DropSide,
): BottomPanelTab[] {
  if (sourceTabId === targetTabId) return items;
  const sourceIndex = items.findIndex((tab) => tab.id === sourceTabId);
  const targetIndex = items.findIndex((tab) => tab.id === targetTabId);
  if (sourceIndex < 0 || targetIndex < 0) return items;
  const withoutSource = items.filter((tab) => tab.id !== sourceTabId);
  const targetInWithout = withoutSource.findIndex((tab) => tab.id === targetTabId);
  if (targetInWithout < 0) return items;
  const insertAt = side === "before" ? targetInWithout : targetInWithout + 1;
  const moved = items[sourceIndex];
  if (!moved) return items;
  const next = [...withoutSource];
  next.splice(insertAt, 0, moved);
  return next;
}

export function WorkspaceBottomPanel({
  onClose,
  className,
}: WorkspaceBottomPanelProps) {
  const { cwd: terminalCwd, ready: terminalCwdReady } = useTerminalCwd();
  const { selectBottomPanel, isBottomPanelSelected } = useAppSelection();
  const { bottomPanelBoot, clearBottomPanelBoot } = useLayout();
  const initialKind: BottomPanelTabKind =
    bottomPanelBoot === "browser" ? "browser" : "terminal";
  const terminalCounterRef = useRef(initialKind === "browser" ? 0 : 1);
  const browserCounterRef = useRef(initialKind === "browser" ? 1 : 0);
  const [tabs, setTabs] = useState<BottomPanelTab[]>(() =>
    initialKind === "browser"
      ? [createTab("browser", 1)]
      : [createTab("terminal", 1)],
  );
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]!.id);
  const [newTabMenuOpen, setNewTabMenuOpen] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    targetTabId: string;
    side: DropSide;
  } | null>(null);
  const tabsRef = useRef(tabs);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    return () => {
      for (const tab of tabsRef.current) {
        if (tab.kind === "terminal") {
          void killTerminalSession(tab.id);
        }
      }
    };
  }, []);

  const addTab = useCallback(
    (kind: BottomPanelTabKind) => {
      const tab =
        kind === "terminal"
          ? (() => {
              const nextIndex = terminalCounterRef.current + 1;
              terminalCounterRef.current = nextIndex;
              return createTab("terminal", nextIndex);
            })()
          : (() => {
              const nextIndex = browserCounterRef.current + 1;
              browserCounterRef.current = nextIndex;
              return createTab("browser", nextIndex);
            })();
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
      selectBottomPanel();
    },
    [selectBottomPanel],
  );

  useEffect(() => {
    if (!bottomPanelBoot) return;
    const kind = bottomPanelBoot;
    const existing = tabsRef.current.find((t) => t.kind === kind);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const tab =
        kind === "terminal"
          ? (() => {
              const nextIndex = terminalCounterRef.current + 1;
              terminalCounterRef.current = nextIndex;
              return createTab("terminal", nextIndex);
            })()
          : (() => {
              const nextIndex = browserCounterRef.current + 1;
              browserCounterRef.current = nextIndex;
              return createTab("browser", nextIndex);
            })();
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    }
    selectBottomPanel();
    clearBottomPanelBoot();
  }, [bottomPanelBoot, clearBottomPanelBoot, selectBottomPanel]);

  const requestTabFocus = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const selectTab = useCallback(
    (tabId: string) => {
      requestTabFocus(tabId);
      selectBottomPanel();
    },
    [requestTabFocus, selectBottomPanel],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const prev = tabsRef.current;
      const tab = prev.find((t) => t.id === tabId);
      if (tab?.kind === "terminal") {
        void killTerminalSession(tabId);
      }

      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        onClose();
        return;
      }

      setTabs(next);
      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        setActiveTabId(next[Math.min(closedIndex, next.length - 1)]!.id);
      }
    },
    [activeTabId, onClose],
  );

  const reorderTabs = useCallback(
    (sourceTabId: string, targetTabId: string, side: DropSide) => {
      setTabs((prev) => reorderByPlacement(prev, sourceTabId, targetTabId, side));
    },
    [],
  );

  const handleTabDragStart = useCallback((tabId: string, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", tabId);
    setDraggingTabId(tabId);
  }, []);

  const handleTabDrop = useCallback(
    (targetTabId: string, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceTabId = e.dataTransfer.getData("text/plain");
      if (!sourceTabId) return;
      const side = dropHint?.targetTabId === targetTabId
        ? dropHint.side
        : dropSideFromPointer(e);
      reorderTabs(sourceTabId, targetTabId, side);
      setDraggingTabId(null);
      setDropHint(null);
    },
    [dropHint, reorderTabs],
  );

  return (
    <section
      data-workspace-bottom-panel
      className={cn(
        "flex min-h-0 flex-col border-t border-border-subtle bg-panel/85 outline-none",
        isBottomPanelSelected && "ring-1 ring-inset ring-[#6366f1]/24",
        className,
      )}
      aria-label="Bottom panel"
    >
      <header className="border-border-subtle bg-panel relative z-20 flex h-8 shrink-0 items-center gap-1 border-b pr-2 pl-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.kind === "terminal" ? Terminal : Globe;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                draggable
                className={cn(
                  "group relative flex shrink-0 cursor-grab items-center rounded-lg border text-xs font-medium transition-all duration-150 active:cursor-grabbing",
                  draggingTabId === tab.id && "opacity-70",
                  isActive
                    ? "border-[#6366f1]/28 bg-panel-elevated/72 text-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-panel-elevated/70 hover:text-foreground",
                )}
                onDragStart={(e) => handleTabDragStart(tab.id, e)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (!draggingTabId || draggingTabId === tab.id) {
                    setDropHint(null);
                    return;
                  }
                  setDropHint({
                    targetTabId: tab.id,
                    side: dropSideFromPointer(e),
                  });
                }}
                onDrop={(e) => handleTabDrop(tab.id, e)}
                onDragLeave={(e) => {
                  const related = e.relatedTarget as Node | null;
                  if (related && e.currentTarget.contains(related)) return;
                  setDropHint((prev) =>
                    prev?.targetTabId === tab.id ? null : prev,
                  );
                }}
                onDragEnd={() => {
                  setDraggingTabId(null);
                  setDropHint(null);
                }}
              >
                {dropHint?.targetTabId === tab.id && dropHint.side === "before" && (
                  <span className="pointer-events-none absolute inset-y-0 -left-0.5 w-0.5 rounded-full bg-[#818cf8]" />
                )}
                <button
                  type="button"
                  className="flex items-center gap-1 py-1 pr-0.5 pl-2"
                  onClick={() => selectTab(tab.id)}
                >
                  <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                  {tab.title}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-panel-elevated hover:text-foreground mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
                  title={`Close ${tab.title}`}
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
                {dropHint?.targetTabId === tab.id && dropHint.side === "after" && (
                  <span className="pointer-events-none absolute inset-y-0 -right-0.5 w-0.5 rounded-full bg-[#818cf8]" />
                )}
              </div>
            );
          })}
          <DropdownMenu onOpenChange={setNewTabMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-6 w-6 shrink-0 rounded-md"
                title="New tab"
                aria-label="New tab"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              <DropdownMenuItem
                onSelect={() => addTab("terminal")}
                className="gap-2 text-xs"
              >
                <Terminal className="h-3.5 w-3.5" />
                Terminal
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => addTab("browser")}
                className="gap-2 text-xs"
              >
                <Globe className="h-3.5 w-3.5" />
                Browser
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
          title="Close bottom panel"
          aria-label="Close bottom panel"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) =>
          tab.kind === "terminal" ? (
            <TerminalTabPane
              key={tab.id}
              sessionId={tab.id}
              isActive={tab.id === activeTabId}
              cwd={terminalCwd}
              cwdReady={terminalCwdReady}
              onRequestFocus={requestTabFocus}
            />
          ) : (
            <BrowserTabPane
              key={tab.id}
              tabId={tab.id}
              isActive={tab.id === activeTabId}
              suppressNativeOverlay={newTabMenuOpen}
              onRequestFocus={requestTabFocus}
            />
          ),
        )}
      </div>
    </section>
  );
}
