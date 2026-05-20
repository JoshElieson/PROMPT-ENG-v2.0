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
  RIGHT_SIDEBAR_COLLAPSED_KEY,
  type LayoutPresetId,
  type RightPanelId,
  type RightPanelVisibility,
} from "@/lib/layout-defaults";
import {
  loadLayoutBool,
  loadLayoutBoolMap,
  saveLayoutBoolMap,
} from "@/lib/layout-storage";

export type { RightPanelId, RightPanelVisibility };

const RIGHT_PANELS_KEY = "prompt:right-panels-visibility";

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
  dispatchMenuAction: (action: MenuActionId) => void;
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

  const rightSidebarExpandRef = useRef<SidebarControlFn | null>(null);
  const leftSidebarExpandRef = useRef<SidebarControlFn | null>(null);
  const rightSidebarToggleRef = useRef<SidebarControlFn | null>(null);
  const leftSidebarToggleRef = useRef<SidebarControlFn | null>(null);

  useEffect(() => {
    saveLayoutBoolMap(RIGHT_PANELS_KEY, rightPanels);
  }, [rightPanels]);

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
    if (collapsed) {
      setRightPanels(HIDDEN_RIGHT_PANELS);
    }
  }, []);

  const applyDefaultLayout = useCallback(() => {
    clearWindowLayoutStorage();
    setRightPanels(DEFAULT_RIGHT_PANELS);
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
        dispatchMenuAction,
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
): boolean | undefined {
  const panel = menuActionToRightPanel(action);
  if (panel) return rightPanels[panel];
  return undefined;
}
