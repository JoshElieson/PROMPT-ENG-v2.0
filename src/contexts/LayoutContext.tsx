import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SidebarView } from "@/components/layout/ActivityBar";
import type { MenuActionId } from "@/data/menu-items";
import {
  clearWindowLayoutStorage,
  DEFAULT_RIGHT_PANELS,
  LEFT_SIDEBAR_COLLAPSED_KEY,
  RIGHT_SIDEBAR_COLLAPSED_KEY,
  type LayoutPresetId,
  type RightPanelId,
  type RightPanelVisibility,
} from "@/lib/layout-defaults";
import {
  loadLayoutBool,
  loadLayoutBoolMap,
  saveLayoutBool,
  saveLayoutBoolMap,
} from "@/lib/layout-storage";

export type { RightPanelId, RightPanelVisibility };

const RIGHT_PANELS_KEY = "prompt:right-panels-visibility";
const WORKSPACE_BOTTOM_PANEL_KEY = "prompt:workspace-terminal-open";

export type BottomPanelBootTab = "terminal" | "browser";

type SidebarControlFn = () => void;

interface LayoutContextValue {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  activeLayoutId: LayoutPresetId;
  layoutResetNonce: number;
  applyDefaultLayout: () => void;
  rightPanels: RightPanelVisibility;
  setRightPanelVisible: (id: RightPanelId, visible: boolean) => void;
  isRightPanelVisible: (id: RightPanelId) => boolean;
  registerRightSidebarExpand: (fn: SidebarControlFn) => () => void;
  registerLeftSidebarExpand: (fn: SidebarControlFn) => () => void;
  registerRightSidebarToggle: (fn: SidebarControlFn) => () => void;
  registerLeftSidebarToggle: (fn: SidebarControlFn) => () => void;
  notifyRightSidebarCollapsed: (collapsed: boolean) => void;
  notifyLeftSidebarCollapsed: (collapsed: boolean) => void;
  rightSidebarCollapsed: boolean;
  leftSidebarCollapsed: boolean;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  setLeftSidebarViewVisible: (view: "explorer" | "agents", visible: boolean) => void;
  dispatchMenuAction: (action: MenuActionId) => void;
  workspaceBottomPanelOpen: boolean;
  setWorkspaceBottomPanelOpen: (open: boolean) => void;
  bottomPanelBoot: BottomPanelBootTab | null;
  requestBottomPanelTab: (kind: BottomPanelBootTab) => void;
  clearBottomPanelBoot: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function menuActionToRightPanel(action: MenuActionId): RightPanelId | null {
  if (action === "view.roundTablePanel") return "roundTable";
  if (action === "view.workflowPanel") return "workflow";
  return null;
}

function loadRightPanels(): RightPanelVisibility {
  const stored = loadLayoutBoolMap(RIGHT_PANELS_KEY, DEFAULT_RIGHT_PANELS);
  const sidebarCollapsed = loadLayoutBool(RIGHT_SIDEBAR_COLLAPSED_KEY, false);
  if (sidebarCollapsed) {
    return { roundTable: false, workflow: false };
  }
  return stored;
}

const HIDDEN_RIGHT_PANELS: RightPanelVisibility = {
  roundTable: false,
  workflow: false,
};

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [activeLayoutId, setActiveLayoutId] = useState<LayoutPresetId>("default");
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  const [rightPanels, setRightPanels] = useState<RightPanelVisibility>(loadRightPanels);
  const [workspaceBottomPanelOpen, setWorkspaceBottomPanelOpen] = useState(() =>
    loadLayoutBool(WORKSPACE_BOTTOM_PANEL_KEY, false),
  );
  const [bottomPanelBoot, setBottomPanelBoot] =
    useState<BottomPanelBootTab | null>(null);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() =>
    loadLayoutBool(LEFT_SIDEBAR_COLLAPSED_KEY, false),
  );
  const [rightSidebarCollapsed, setRightSidebarCollapsedState] = useState(() =>
    loadLayoutBool(RIGHT_SIDEBAR_COLLAPSED_KEY, false),
  );

  const rightSidebarExpandRef = useRef<SidebarControlFn | null>(null);
  const leftSidebarExpandRef = useRef<SidebarControlFn | null>(null);
  const rightSidebarToggleRef = useRef<SidebarControlFn | null>(null);
  const leftSidebarToggleRef = useRef<SidebarControlFn | null>(null);

  useEffect(() => {
    saveLayoutBoolMap(RIGHT_PANELS_KEY, rightPanels);
  }, [rightPanels]);

  useEffect(() => {
    saveLayoutBool(WORKSPACE_BOTTOM_PANEL_KEY, workspaceBottomPanelOpen);
  }, [workspaceBottomPanelOpen]);

  const expandRightSidebar = useCallback(() => {
    rightSidebarExpandRef.current?.();
  }, []);

  const expandLeftSidebar = useCallback(() => {
    leftSidebarExpandRef.current?.();
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    leftSidebarToggleRef.current?.();
  }, []);

  const toggleRightSidebar = useCallback(() => {
    rightSidebarToggleRef.current?.();
  }, []);

  const registerRightSidebarExpand = useCallback((fn: SidebarControlFn) => {
    rightSidebarExpandRef.current = fn;
    return () => {
      if (rightSidebarExpandRef.current === fn) {
        rightSidebarExpandRef.current = null;
      }
    };
  }, []);

  const registerLeftSidebarExpand = useCallback((fn: SidebarControlFn) => {
    leftSidebarExpandRef.current = fn;
    return () => {
      if (leftSidebarExpandRef.current === fn) {
        leftSidebarExpandRef.current = null;
      }
    };
  }, []);

  const registerRightSidebarToggle = useCallback((fn: SidebarControlFn) => {
    rightSidebarToggleRef.current = fn;
    return () => {
      if (rightSidebarToggleRef.current === fn) {
        rightSidebarToggleRef.current = null;
      }
    };
  }, []);

  const registerLeftSidebarToggle = useCallback((fn: SidebarControlFn) => {
    leftSidebarToggleRef.current = fn;
    return () => {
      if (leftSidebarToggleRef.current === fn) {
        leftSidebarToggleRef.current = null;
      }
    };
  }, []);

  const setRightPanelVisible = useCallback(
    (id: RightPanelId, visible: boolean) => {
      setRightPanels((prev) => ({ ...prev, [id]: visible }));
      if (visible) expandRightSidebar();
    },
    [expandRightSidebar],
  );

  const isRightPanelVisible = useCallback(
    (id: RightPanelId) => rightPanels[id],
    [rightPanels],
  );

  const notifyRightSidebarCollapsed = useCallback((collapsed: boolean) => {
    setRightSidebarCollapsedState(collapsed);
    if (collapsed) {
      setRightPanels(HIDDEN_RIGHT_PANELS);
    }
  }, []);

  const notifyLeftSidebarCollapsed = useCallback((collapsed: boolean) => {
    setLeftSidebarCollapsed(collapsed);
  }, []);

  const setRightSidebarCollapsed = useCallback(
    (collapsed: boolean) => {
      if (collapsed) {
        if (!rightSidebarCollapsed) {
          toggleRightSidebar();
        }
        return;
      }
      if (rightSidebarCollapsed) {
        expandRightSidebar();
      }
    },
    [expandRightSidebar, rightSidebarCollapsed, toggleRightSidebar],
  );

  const setLeftSidebarViewVisible = useCallback(
    (view: "explorer" | "agents", visible: boolean) => {
      if (visible) {
        setSidebarView(view);
        expandLeftSidebar();
        return;
      }
      if (sidebarView === view && !leftSidebarCollapsed) {
        leftSidebarToggleRef.current?.();
      }
    },
    [sidebarView, leftSidebarCollapsed, expandLeftSidebar],
  );

  const requestBottomPanelTab = useCallback((kind: BottomPanelBootTab) => {
    setBottomPanelBoot(kind);
    setWorkspaceBottomPanelOpen(true);
  }, []);

  const clearBottomPanelBoot = useCallback(() => {
    setBottomPanelBoot(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "`" && e.code !== "Backquote") return;
      e.preventDefault();
      if (workspaceBottomPanelOpen) {
        setWorkspaceBottomPanelOpen(false);
      } else {
        requestBottomPanelTab("terminal");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workspaceBottomPanelOpen, requestBottomPanelTab]);

  const applyDefaultLayout = useCallback(() => {
    clearWindowLayoutStorage();
    setRightPanels(DEFAULT_RIGHT_PANELS);
    setLeftSidebarCollapsed(false);
    setActiveLayoutId("default");
    setLayoutResetNonce((n) => n + 1);
  }, []);

  const dispatchMenuAction = useCallback(
    (action: MenuActionId) => {
      const rightPanel = menuActionToRightPanel(action);
      if (rightPanel) {
        setRightPanelVisible(rightPanel, true);
        return;
      }

      switch (action) {
        case "view.workspaceTerminal":
          requestBottomPanelTab("terminal");
          break;
        case "view.workspaceBrowser":
          requestBottomPanelTab("browser");
          break;
        case "view.explorer":
          setSidebarView("explorer");
          expandLeftSidebar();
          break;
        case "view.agentCart":
          setSidebarView("agents");
          expandLeftSidebar();
          break;
        case "view.toggleLeftSidebar":
          toggleLeftSidebar();
          break;
        case "view.toggleRightSidebar":
          toggleRightSidebar();
          break;
        default:
          break;
      }
    },
    [
      expandLeftSidebar,
      setRightPanelVisible,
      toggleLeftSidebar,
      toggleRightSidebar,
      requestBottomPanelTab,
    ],
  );

  return (
    <LayoutContext.Provider
      value={{
        sidebarView,
        setSidebarView,
        activeLayoutId,
        layoutResetNonce,
        applyDefaultLayout,
        rightPanels,
        setRightPanelVisible,
        isRightPanelVisible,
        registerRightSidebarExpand,
        registerLeftSidebarExpand,
        registerRightSidebarToggle,
        registerLeftSidebarToggle,
        notifyRightSidebarCollapsed,
        notifyLeftSidebarCollapsed,
        rightSidebarCollapsed,
        leftSidebarCollapsed,
        setRightSidebarCollapsed,
        setLeftSidebarViewVisible,
        dispatchMenuAction,
        workspaceBottomPanelOpen,
        setWorkspaceBottomPanelOpen,
        bottomPanelBoot,
        requestBottomPanelTab,
        clearBottomPanelBoot,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error("useLayout must be used within LayoutProvider");
  }
  return ctx;
}

export function menuActionChecked(
  action: MenuActionId,
  rightPanels: RightPanelVisibility,
  workspaceBottomPanelOpen: boolean,
  sidebarView: SidebarView,
  leftSidebarCollapsed: boolean,
): boolean | undefined {
  const panel = menuActionToRightPanel(action);
  if (panel) return rightPanels[panel];
  if (action === "view.workspaceTerminal") return workspaceBottomPanelOpen;
  if (action === "view.explorer") {
    return sidebarView === "explorer" && !leftSidebarCollapsed;
  }
  if (action === "view.agentCart") {
    return sidebarView === "agents" && !leftSidebarCollapsed;
  }
  return undefined;
}
