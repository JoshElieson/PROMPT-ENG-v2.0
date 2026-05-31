import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SidebarView } from "@/components/layout/ActivityBar";
import type { MenuActionId } from "@/data/menu-items";
import {
  clearWindowLayoutStorage,
  LEFT_SIDEBAR_COLLAPSED_KEY,
  WORKSPACE_LAYOUT_PRESET_KEY,
  type LayoutPresetId,
} from "@/lib/layout-defaults";
import { loadLayoutBool, saveLayoutBool } from "@/lib/layout-storage";

const WORKSPACE_BOTTOM_PANEL_KEY = "prompt:workspace-terminal-open";

export type BottomPanelBootTab = "terminal" | "browser";

export type BottomPanelKindsVisible = {
  terminal: boolean;
  browser: boolean;
};

type BottomPanelControl = {
  isKindVisible: (kind: BottomPanelBootTab) => boolean;
  focusKind: (kind: BottomPanelBootTab) => void;
  hideKind: (kind: BottomPanelBootTab) => void;
};

type SidebarControlFn = () => void;

interface LayoutContextValue {
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  activeLayoutId: LayoutPresetId;
  layoutResetNonce: number;
  applyDefaultLayout: () => void;
  applyLayoutPreset: (presetId: LayoutPresetId) => void;
  registerLeftSidebarExpand: (fn: SidebarControlFn) => () => void;
  registerLeftSidebarToggle: (fn: SidebarControlFn) => () => void;
  notifyLeftSidebarCollapsed: (collapsed: boolean) => void;
  leftSidebarCollapsed: boolean;
  setLeftSidebarViewVisible: (view: "explorer" | "agents", visible: boolean) => void;
  dispatchMenuAction: (action: MenuActionId) => void;
  workspaceBottomPanelOpen: boolean;
  setWorkspaceBottomPanelOpen: (open: boolean) => void;
  bottomPanelBoot: BottomPanelBootTab | null;
  requestBottomPanelTab: (kind: BottomPanelBootTab) => void;
  clearBottomPanelBoot: () => void;
  bottomPanelKindsVisible: BottomPanelKindsVisible;
  reportBottomPanelKindsVisible: (visible: BottomPanelKindsVisible) => void;
  registerBottomPanelControl: (control: BottomPanelControl) => () => void;
  toggleBottomPanelKind: (kind: BottomPanelBootTab) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function loadLayoutPreset(): LayoutPresetId {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUT_PRESET_KEY);
    if (raw === null) return "default";
    const parsed = JSON.parse(raw);
    return parsed === "horizontal" ? "horizontal" : "default";
  } catch {
    return "default";
  }
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [activeLayoutId, setActiveLayoutId] = useState<LayoutPresetId>(loadLayoutPreset);
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  const [workspaceBottomPanelOpen, setWorkspaceBottomPanelOpen] = useState(() =>
    loadLayoutBool(WORKSPACE_BOTTOM_PANEL_KEY, false),
  );
  const [bottomPanelBoot, setBottomPanelBoot] =
    useState<BottomPanelBootTab | null>(null);
  const [bottomPanelKindsVisible, setBottomPanelKindsVisible] =
    useState<BottomPanelKindsVisible>({ terminal: false, browser: false });
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() =>
    loadLayoutBool(LEFT_SIDEBAR_COLLAPSED_KEY, false),
  );

  const leftSidebarExpandRef = useRef<SidebarControlFn | null>(null);
  const leftSidebarToggleRef = useRef<SidebarControlFn | null>(null);
  const bottomPanelControlRef = useRef<BottomPanelControl | null>(null);

  useEffect(() => {
    saveLayoutBool(WORKSPACE_BOTTOM_PANEL_KEY, workspaceBottomPanelOpen);
  }, [workspaceBottomPanelOpen]);

  useEffect(() => {
    localStorage.setItem(WORKSPACE_LAYOUT_PRESET_KEY, JSON.stringify(activeLayoutId));
  }, [activeLayoutId]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const expandLeftSidebar = useCallback(() => {
    leftSidebarExpandRef.current?.();
  }, []);

  const toggleLeftSidebar = useCallback(() => {
    leftSidebarToggleRef.current?.();
  }, []);

  const registerLeftSidebarExpand = useCallback((fn: SidebarControlFn) => {
    leftSidebarExpandRef.current = fn;
    return () => {
      if (leftSidebarExpandRef.current === fn) {
        leftSidebarExpandRef.current = null;
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

  const notifyLeftSidebarCollapsed = useCallback((collapsed: boolean) => {
    setLeftSidebarCollapsed(collapsed);
  }, []);

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

  const reportBottomPanelKindsVisible = useCallback(
    (visible: BottomPanelKindsVisible) => {
      setBottomPanelKindsVisible(visible);
    },
    [],
  );

  const registerBottomPanelControl = useCallback((control: BottomPanelControl) => {
    bottomPanelControlRef.current = control;
    return () => {
      if (bottomPanelControlRef.current === control) {
        bottomPanelControlRef.current = null;
      }
    };
  }, []);

  const toggleBottomPanelKind = useCallback(
    (kind: BottomPanelBootTab) => {
      if (!workspaceBottomPanelOpen) {
        requestBottomPanelTab(kind);
        return;
      }
      const control = bottomPanelControlRef.current;
      if (!control) {
        requestBottomPanelTab(kind);
        return;
      }
      if (control.isKindVisible(kind)) {
        control.hideKind(kind);
      } else {
        control.focusKind(kind);
      }
    },
    [workspaceBottomPanelOpen, requestBottomPanelTab],
  );

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

  const applyLayoutPreset = useCallback((presetId: LayoutPresetId) => {
    clearWindowLayoutStorage();
    setLeftSidebarCollapsed(false);
    setActiveLayoutId(presetId);
    setLayoutResetNonce((n) => n + 1);
  }, []);

  const applyDefaultLayout = useCallback(() => {
    applyLayoutPreset("default");
  }, [applyLayoutPreset]);

  const dispatchMenuAction = useCallback(
    (action: MenuActionId) => {
      switch (action) {
        case "view.workspaceTerminal":
          toggleBottomPanelKind("terminal");
          break;
        case "view.workspaceBrowser":
          toggleBottomPanelKind("browser");
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
        default:
          break;
      }
    },
    [expandLeftSidebar, toggleLeftSidebar, toggleBottomPanelKind],
  );

  const value = useMemo(
    () => ({
      settingsOpen,
      openSettings,
      closeSettings,
      sidebarView,
      setSidebarView,
      activeLayoutId,
      layoutResetNonce,
      applyDefaultLayout,
      applyLayoutPreset,
      registerLeftSidebarExpand,
      registerLeftSidebarToggle,
      notifyLeftSidebarCollapsed,
      leftSidebarCollapsed,
      setLeftSidebarViewVisible,
      dispatchMenuAction,
      workspaceBottomPanelOpen,
      setWorkspaceBottomPanelOpen,
      bottomPanelBoot,
      requestBottomPanelTab,
      clearBottomPanelBoot,
      bottomPanelKindsVisible,
      reportBottomPanelKindsVisible,
      registerBottomPanelControl,
      toggleBottomPanelKind,
    }),
    [
      settingsOpen,
      openSettings,
      closeSettings,
      sidebarView,
      activeLayoutId,
      layoutResetNonce,
      applyDefaultLayout,
      applyLayoutPreset,
      registerLeftSidebarExpand,
      registerLeftSidebarToggle,
      notifyLeftSidebarCollapsed,
      leftSidebarCollapsed,
      setLeftSidebarViewVisible,
      dispatchMenuAction,
      workspaceBottomPanelOpen,
      bottomPanelBoot,
      requestBottomPanelTab,
      clearBottomPanelBoot,
      bottomPanelKindsVisible,
      reportBottomPanelKindsVisible,
      registerBottomPanelControl,
      toggleBottomPanelKind,
    ],
  );

  return (
    <LayoutContext.Provider value={value}>
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
  workspaceBottomPanelOpen: boolean,
  sidebarView: SidebarView,
  leftSidebarCollapsed: boolean,
  bottomPanelKindsVisible: BottomPanelKindsVisible,
): boolean | undefined {
  if (action === "view.workspaceTerminal") {
    return workspaceBottomPanelOpen && bottomPanelKindsVisible.terminal;
  }
  if (action === "view.workspaceBrowser") {
    return workspaceBottomPanelOpen && bottomPanelKindsVisible.browser;
  }
  if (action === "view.explorer") {
    return sidebarView === "explorer" && !leftSidebarCollapsed;
  }
  if (action === "view.agentCart") {
    return sidebarView === "agents" && !leftSidebarCollapsed;
  }
  return undefined;
}
