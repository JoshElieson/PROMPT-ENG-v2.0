import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Globe, Plus, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useLayout } from "@/contexts/LayoutContext";
import { killTerminalSession } from "@/lib/workspace-terminal";
import {
  applySplitDrop,
  normalizeVisiblePaneIds,
  type SplitDropSlot,
} from "@/lib/pane-group-layout";
import { cn } from "@/lib/utils";

const BOTTOM_PANEL_MAX_VISIBLE = 2;

function findOtherKindTab(
  tabs: BottomPanelTab[],
  kind: BottomPanelTabKind,
): BottomPanelTab | undefined {
  return tabs.find((tab) => tab.kind !== kind);
}

/** Keep the active tab visible; auto-pair terminal + browser when both exist. */
function normalizeBottomPanelVisibleIds(
  tabs: BottomPanelTab[],
  visibleIds: string[],
  activeTabId: string,
): string[] {
  const available = tabs.map((tab) => tab.id);
  const active = tabs.find((tab) => tab.id === activeTabId);
  const normalized = normalizeVisiblePaneIds(
    visibleIds,
    available,
    activeTabId,
    BOTTOM_PANEL_MAX_VISIBLE,
  );

  if (!active) return normalized;

  const otherKind = findOtherKindTab(tabs, active.kind);
  if (!otherKind) return normalized;

  if (normalized.length >= 2) return normalized;

  if (normalized.length === 0) {
    return [otherKind.id, activeTabId];
  }

  const soleId = normalized[0]!;
  if (soleId === activeTabId) {
    return otherKind.id === activeTabId
      ? normalized
      : [otherKind.id, activeTabId];
  }

  return normalized.includes(activeTabId)
    ? normalized
    : [soleId, activeTabId];
}

function splitVisibleWithTab(
  tabs: BottomPanelTab[],
  visibleIds: string[],
  tabId: string,
  slot: SplitDropSlot,
): string[] {
  const available = tabs.map((tab) => tab.id);
  const base = normalizeVisiblePaneIds(
    visibleIds,
    available,
    tabId,
    BOTTOM_PANEL_MAX_VISIBLE,
  );
  return applySplitDrop(base, tabId, slot);
}

export type BottomPanelTabKind = "terminal" | "browser";

export interface BottomPanelTab {
  id: string;
  title: string;
  kind: BottomPanelTabKind;
}

type DropSide = "before" | "after";

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

function kindsVisibleFromState(
  tabs: BottomPanelTab[],
  visibleTabIds: string[],
): { terminal: boolean; browser: boolean } {
  const visible = new Set(visibleTabIds);
  let terminal = false;
  let browser = false;
  for (const tab of tabs) {
    if (!visible.has(tab.id)) continue;
    if (tab.kind === "terminal") terminal = true;
    else browser = true;
  }
  return { terminal, browser };
}

interface WorkspaceBottomPanelContextValue {
  tabs: BottomPanelTab[];
  activeTabId: string;
  activeTabKind: BottomPanelTabKind;
  splitOrientation: "horizontal" | "vertical";
  visibleTabIds: string[];
  isKindVisible: (kind: BottomPanelTabKind) => boolean;
  focusKind: (kind: BottomPanelTabKind) => void;
  hideKind: (kind: BottomPanelTabKind) => void;
  setVisibleTabIds: (ids: string[], focusTabId?: string) => void;
  addTab: (kind: BottomPanelTabKind) => void;
  selectTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  requestTabFocus: (tabId: string) => void;
  reorderTabs: (sourceTabId: string, targetTabId: string, side: DropSide) => void;
  dragTabId: string | null;
  setDragTabId: (tabId: string | null) => void;
  twoPaneSizes: [number, number];
  setTwoPaneSizes: (sizes: [number, number]) => void;
  threePanePrimarySizes: [number, number];
  setThreePanePrimarySizes: (sizes: [number, number]) => void;
  threePaneSecondarySizes: [number, number];
  setThreePaneSecondarySizes: (sizes: [number, number]) => void;
  newTabMenuOpen: boolean;
  setNewTabMenuOpen: (open: boolean) => void;
}

const WorkspaceBottomPanelContext =
  createContext<WorkspaceBottomPanelContextValue | null>(null);

export function WorkspaceBottomPanelProvider({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { selectBottomPanel } = useAppSelection();
  const {
    bottomPanelBoot,
    clearBottomPanelBoot,
    activeLayoutId,
    workspaceBottomPanelOpen,
    reportBottomPanelKindsVisible,
    registerBottomPanelControl,
  } = useLayout();
  // Only seed a tab when the panel is actually open at mount; otherwise start
  // empty so a closed panel never holds a stale tab that gets auto-paired back
  // in when a different kind is opened later.
  const initialPanelOpen = useRef(workspaceBottomPanelOpen).current;
  const initialKind: BottomPanelTabKind =
    bottomPanelBoot === "browser" ? "browser" : "terminal";
  const terminalCounterRef = useRef(
    initialPanelOpen && initialKind === "terminal" ? 1 : 0,
  );
  const browserCounterRef = useRef(
    initialPanelOpen && initialKind === "browser" ? 1 : 0,
  );
  const [tabs, setTabs] = useState<BottomPanelTab[]>(() =>
    initialPanelOpen ? [createTab(initialKind, 1)] : [],
  );
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? "");
  const splitOrientation: "horizontal" | "vertical" =
    activeLayoutId === "horizontal" ? "horizontal" : "vertical";
  const [visibleTabIdsRaw, setVisibleTabIdsRaw] = useState<string[]>([]);
  // When the user explicitly hides a kind (View menu / dock toggle), suppress the
  // terminal+browser auto-pairing so the hidden pane isn't immediately restored.
  // Re-enabled by any action that intends to show a kind (focus/add/select/drop).
  const [autoPairSuppressed, setAutoPairSuppressed] = useState(false);
  const visibleTabIdsState = useMemo(
    () =>
      autoPairSuppressed
        ? normalizeVisiblePaneIds(
            visibleTabIdsRaw,
            tabs.map((tab) => tab.id),
            activeTabId,
            BOTTOM_PANEL_MAX_VISIBLE,
          )
        : normalizeBottomPanelVisibleIds(tabs, visibleTabIdsRaw, activeTabId),
    [tabs, visibleTabIdsRaw, activeTabId, autoPairSuppressed],
  );
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [twoPaneSizes, setTwoPaneSizes] = useState<[number, number]>([0.5, 0.5]);
  const [threePanePrimarySizes, setThreePanePrimarySizes] = useState<[number, number]>([
    0.5,
    0.5,
  ]);
  const [threePaneSecondarySizes, setThreePaneSecondarySizes] = useState<
    [number, number]
  >([0.5, 0.5]);
  const [newTabMenuOpen, setNewTabMenuOpen] = useState(false);
  const tabsRef = useRef(tabs);
  const visibleTabIdsRef = useRef(visibleTabIdsState);
  const focusKindRef = useRef<(kind: BottomPanelTabKind) => void>(() => {});
  const hideKindRef = useRef<(kind: BottomPanelTabKind) => void>(() => {});
  const restoreKindsRef = useRef<
    (visible: { terminal: boolean; browser: boolean }) => void
  >(() => {});

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    visibleTabIdsRef.current = visibleTabIdsState;
  }, [visibleTabIdsState]);

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
      setTabs((prev) => {
        const next = [...prev, tab];
        setVisibleTabIdsRaw((visiblePrev) =>
          splitVisibleWithTab(next, visiblePrev, tab.id, "second"),
        );
        return next;
      });
      setActiveTabId(tab.id);
      setAutoPairSuppressed(false);
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
      setVisibleTabIdsRaw((prev) =>
        normalizeBottomPanelVisibleIds(tabsRef.current, prev, existing.id),
      );
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
      setTabs((prev) => {
        const next = [...prev, tab];
        setVisibleTabIdsRaw((visiblePrev) =>
          normalizeBottomPanelVisibleIds(next, visiblePrev, tab.id),
        );
        return next;
      });
      setActiveTabId(tab.id);
    }
    setAutoPairSuppressed(false);
    selectBottomPanel();
    clearBottomPanelBoot();
  }, [bottomPanelBoot, clearBottomPanelBoot, selectBottomPanel]);

  const requestTabFocus = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const selectTab = useCallback(
    (tabId: string) => {
      requestTabFocus(tabId);
      // Selecting an already-visible tab should just focus it; re-normalizing here
      // would auto-pair an explicitly hidden kind back in.
      if (!visibleTabIdsRef.current.includes(tabId)) {
        setAutoPairSuppressed(false);
        setVisibleTabIdsRaw((prev) =>
          normalizeBottomPanelVisibleIds(tabsRef.current, prev, tabId),
        );
      }
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
        // Clear the removed tab so a re-opened panel starts fresh instead of
        // resurrecting the closed kind via auto-pairing.
        setTabs(next);
        setVisibleTabIdsRaw([]);
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

  const setVisibleTabIds = useCallback((ids: string[], focusTabId?: string) => {
    setAutoPairSuppressed(false);
    setVisibleTabIdsRaw((prev) =>
      normalizeBottomPanelVisibleIds(
        tabsRef.current,
        ids.length > 0 ? ids : prev,
        focusTabId ?? activeTabId,
      ),
    );
  }, [activeTabId]);

  const activeTabKind = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    return tab?.kind ?? "terminal";
  }, [tabs, activeTabId]);

  const isKindVisible = useCallback(
    (kind: BottomPanelTabKind) => {
      const visible = new Set(visibleTabIdsState);
      return tabs.some((tab) => tab.kind === kind && visible.has(tab.id));
    },
    [tabs, visibleTabIdsState],
  );

  const focusKind = useCallback(
    (kind: BottomPanelTabKind) => {
      const existing = tabsRef.current.find((t) => t.kind === kind);
      if (existing) {
        selectTab(existing.id);
        return;
      }
      addTab(kind);
    },
    [addTab, selectTab],
  );

  const hideKind = useCallback(
    (kind: BottomPanelTabKind) => {
      const currentTabs = tabsRef.current;
      const currentVisible = visibleTabIdsRef.current;
      const visibleKindIds = currentVisible.filter((id) => {
        const tab = currentTabs.find((t) => t.id === id);
        return tab?.kind === kind;
      });
      if (visibleKindIds.length === 0) return;

      const otherVisibleIds = currentVisible.filter((id) => !visibleKindIds.includes(id));
      if (otherVisibleIds.length > 0) {
        const nextFocus =
          otherVisibleIds.find((id) => id === activeTabId) ?? otherVisibleIds[0]!;
        // Respect explicit "hide kind" actions without auto-pairing kinds back in.
        setAutoPairSuppressed(true);
        setVisibleTabIdsRaw(
          normalizeVisiblePaneIds(
            otherVisibleIds,
            currentTabs.map((tab) => tab.id),
            nextFocus,
            BOTTOM_PANEL_MAX_VISIBLE,
          ),
        );
        setActiveTabId(nextFocus);
        return;
      }

      // Hiding the final visible kind should fully collapse the panel, even if
      // hidden tabs still exist in state.
      for (const tab of currentTabs) {
        if (tab.kind === "terminal") {
          void killTerminalSession(tab.id);
        }
      }
      setTabs([]);
      setVisibleTabIdsRaw([]);
      setActiveTabId("");
      setAutoPairSuppressed(false);
      onClose();
    },
    [activeTabId, onClose],
  );

  const restoreKinds = useCallback(
    (visible: { terminal: boolean; browser: boolean }) => {
      const kinds: BottomPanelTabKind[] = [];
      if (visible.terminal) kinds.push("terminal");
      if (visible.browser) kinds.push("browser");

      if (kinds.length === 0) {
        onClose();
        return;
      }

      setAutoPairSuppressed(false);
      setTabs((prev) => {
        let next = [...prev];
        for (const kind of kinds) {
          if (!next.some((tab) => tab.kind === kind)) {
            if (kind === "terminal") {
              const nextIndex = terminalCounterRef.current + 1;
              terminalCounterRef.current = nextIndex;
              next = [...next, createTab("terminal", nextIndex)];
            } else {
              const nextIndex = browserCounterRef.current + 1;
              browserCounterRef.current = nextIndex;
              next = [...next, createTab("browser", nextIndex)];
            }
          }
        }
        const visibleIds = kinds
          .map((kind) => next.find((tab) => tab.kind === kind)?.id)
          .filter((id): id is string => Boolean(id));
        const focusId = visibleIds[visibleIds.length - 1] ?? "";
        setVisibleTabIdsRaw(visibleIds);
        if (focusId) setActiveTabId(focusId);
        return next;
      });
      selectBottomPanel();
    },
    [onClose, selectBottomPanel],
  );

  useEffect(() => {
    focusKindRef.current = focusKind;
    hideKindRef.current = hideKind;
    restoreKindsRef.current = restoreKinds;
  }, [focusKind, hideKind, restoreKinds]);

  useEffect(() => {
    if (!workspaceBottomPanelOpen) {
      reportBottomPanelKindsVisible({ terminal: false, browser: false });
      return;
    }
    reportBottomPanelKindsVisible(
      kindsVisibleFromState(tabs, visibleTabIdsState),
    );
  }, [
    workspaceBottomPanelOpen,
    tabs,
    visibleTabIdsState,
    reportBottomPanelKindsVisible,
  ]);

  useEffect(() => {
    return registerBottomPanelControl({
      isKindVisible: (kind) =>
        kindsVisibleFromState(tabsRef.current, visibleTabIdsRef.current)[kind],
      focusKind: (kind) => focusKindRef.current(kind),
      hideKind: (kind) => hideKindRef.current(kind),
      restoreKinds: (visible) => restoreKindsRef.current(visible),
    });
  }, [registerBottomPanelControl]);

  const reorderTabs = useCallback(
    (sourceTabId: string, targetTabId: string, side: DropSide) => {
      setTabs((prev) => reorderByPlacement(prev, sourceTabId, targetTabId, side));
    },
    [],
  );

  const value = useMemo<WorkspaceBottomPanelContextValue>(
    () => ({
      tabs,
      activeTabId,
      activeTabKind,
      splitOrientation,
      visibleTabIds: visibleTabIdsState,
      isKindVisible,
      focusKind,
      hideKind,
      setVisibleTabIds,
      addTab,
      selectTab,
      closeTab,
      requestTabFocus,
      reorderTabs,
      dragTabId,
      setDragTabId,
      twoPaneSizes,
      setTwoPaneSizes,
      threePanePrimarySizes,
      setThreePanePrimarySizes,
      threePaneSecondarySizes,
      setThreePaneSecondarySizes,
      newTabMenuOpen,
      setNewTabMenuOpen,
    }),
    [
      tabs,
      activeTabId,
      activeTabKind,
      splitOrientation,
      visibleTabIdsState,
      isKindVisible,
      focusKind,
      hideKind,
      setVisibleTabIds,
      addTab,
      selectTab,
      closeTab,
      requestTabFocus,
      reorderTabs,
      dragTabId,
      twoPaneSizes,
      threePanePrimarySizes,
      threePaneSecondarySizes,
      newTabMenuOpen,
    ],
  );

  return (
    <WorkspaceBottomPanelContext.Provider value={value}>
      {children}
    </WorkspaceBottomPanelContext.Provider>
  );
}

export function useWorkspaceBottomPanel() {
  const ctx = useContext(WorkspaceBottomPanelContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceBottomPanel requires WorkspaceBottomPanelProvider.",
    );
  }
  return ctx;
}

export function WorkspaceBottomPanelTabs({
  showClosePanel = true,
  onClosePanel,
}: {
  showClosePanel?: boolean;
  onClosePanel?: () => void;
}) {
  const {
    tabs,
    activeTabId,
    visibleTabIds,
    selectTab,
    closeTab,
    addTab,
    reorderTabs,
    setVisibleTabIds,
    requestTabFocus,
    setNewTabMenuOpen,
    dragTabId,
    setDragTabId,
  } = useWorkspaceBottomPanel();
  const [dropHint, setDropHint] = useState<{
    targetTabId: string;
    side: DropSide;
  } | null>(null);

  const handleTabDragStart = useCallback(
    (tabId: string, e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabId);
      setDragTabId(tabId);
    },
    [setDragTabId],
  );

  const handleTabDrop = useCallback(
    (targetTabId: string, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceTabId = e.dataTransfer.getData("text/plain");
      if (!sourceTabId) return;
      const side =
        dropHint?.targetTabId === targetTabId
          ? dropHint.side
          : dropSideFromPointer(e);
      reorderTabs(sourceTabId, targetTabId, side);
      const slot: SplitDropSlot = side === "before" ? "first" : "second";
      const nextVisible = splitVisibleWithTab(
        tabs,
        visibleTabIds,
        sourceTabId,
        slot,
      );
      setVisibleTabIds(nextVisible, sourceTabId);
      requestTabFocus(sourceTabId);
      setDragTabId(null);
      setDropHint(null);
    },
    [
      dropHint,
      reorderTabs,
      requestTabFocus,
      setDragTabId,
      setVisibleTabIds,
      tabs,
      visibleTabIds,
    ],
  );

  const tabList = (
    <>
      {tabs.map((tab) => {
        const isVisible = visibleTabIds.includes(tab.id);
        const isFocused = tab.id === activeTabId;
        const Icon = tab.kind === "terminal" ? Terminal : Globe;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isVisible}
            draggable
            className={cn(
              "group relative flex shrink-0 cursor-grab items-center rounded-lg border text-xs font-medium transition-all duration-150 active:cursor-grabbing",
              dragTabId === tab.id && "opacity-70",
              isVisible
                ? cn(
                    "border-[#6366f1]/28 bg-panel-elevated/72 text-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]",
                    isFocused &&
                      "shadow-[inset_0_0_0_1px_rgba(99,102,241,0.22),0_0_0_1px_rgba(99,102,241,0.08)]",
                  )
                : "border-transparent text-muted-foreground hover:border-border hover:bg-panel-elevated/70 hover:text-foreground",
            )}
            onDragStart={(e) => handleTabDragStart(tab.id, e)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (!dragTabId || dragTabId === tab.id) {
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
                setDragTabId(null);
              setDropHint(null);
            }}
          >
            {dropHint?.targetTabId === tab.id && dropHint.side === "before" && (
              <span className="pointer-events-none absolute inset-y-0 -left-0.5 w-0.5 rounded-full bg-[#818cf8]" />
            )}
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 py-1 pr-0.5 pl-1"
              title={tab.title}
              onClick={() => selectTab(tab.id)}
            >
              <Icon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              <span>{tab.title}</span>
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
    </>
  );

  const newTabButton = (
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
  );

  const closePanelButton =
    showClosePanel && onClosePanel ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0"
        title="Close panel"
        aria-label="Close panel"
        onClick={onClosePanel}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    ) : null;

  return (
    <div className="flex w-full min-w-0 items-center gap-0.5">
      <div className="flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto">
        {tabList}
        {newTabButton}
      </div>
      {closePanelButton ? (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {closePanelButton}
        </div>
      ) : null}
    </div>
  );
}
