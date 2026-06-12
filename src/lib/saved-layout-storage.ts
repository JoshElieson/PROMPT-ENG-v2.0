import {
  DEFAULT_LEFT_PANEL_SIZES,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  LEFT_SIDEBAR_COLLAPSED_KEY,
  type LayoutPresetId,
} from "@/lib/layout-defaults";
import {
  loadLayoutBool,
  loadLayoutPx,
  loadLayoutSizes,
  saveLayoutBool,
  saveLayoutPx,
  saveLayoutSizes,
} from "@/lib/layout-storage";

export type SavedLayoutBottomPanelKindsVisible = {
  terminal: boolean;
  browser: boolean;
};

const SAVED_LAYOUTS_STORAGE_KEY = "prompt:saved-layouts:v1";
export const MAX_SAVED_LAYOUTS = 2;

const LEFT_SIDEBAR_WIDTH_KEY = "prompt:left-sidebar-width";
const LEFT_PANELS_EXPLORER_KEY = "prompt:left-panels-explorer";
const WORKSPACE_BOTTOM_PANEL_KEY = "prompt:workspace-terminal-open";
const WORKSPACE_TERMINAL_SPLIT_VERTICAL_KEY = "prompt:workspace-terminal-split-vertical";
const WORKSPACE_TERMINAL_SPLIT_HORIZONTAL_KEY = "prompt:workspace-terminal-split-horizontal";

export interface SavedLayoutSnapshot {
  activeLayoutId: LayoutPresetId;
  leftSidebarWidth: number;
  leftSidebarCollapsed: boolean;
  leftPanelsExplorer: [number, number];
  workspaceBottomPanelOpen: boolean;
  workspaceTerminalSplitVertical: [number, number];
  workspaceTerminalSplitHorizontal: [number, number];
  bottomPanelKindsVisible: SavedLayoutBottomPanelKindsVisible;
}

export type SavedLayoutSlot = SavedLayoutSnapshot | null;

function parsePair(raw: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) return fallback;
  const a = raw[0];
  const b = raw[1];
  if (typeof a !== "number" || typeof b !== "number" || a <= 0 || b <= 0) return fallback;
  const sum = a + b;
  return [a / sum, b / sum];
}

function parseSnapshot(raw: unknown): SavedLayoutSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const activeLayoutId =
    value.activeLayoutId === "horizontal" ? "horizontal" : "default";
  const leftSidebarWidth =
    typeof value.leftSidebarWidth === "number" && value.leftSidebarWidth > 0
      ? value.leftSidebarWidth
      : DEFAULT_LEFT_SIDEBAR_WIDTH;
  const leftSidebarCollapsed =
    typeof value.leftSidebarCollapsed === "boolean"
      ? value.leftSidebarCollapsed
      : false;
  const leftPanelsExplorer = parsePair(
    value.leftPanelsExplorer,
    [...DEFAULT_LEFT_PANEL_SIZES],
  );
  const workspaceBottomPanelOpen =
    typeof value.workspaceBottomPanelOpen === "boolean"
      ? value.workspaceBottomPanelOpen
      : false;
  const workspaceTerminalSplitVertical = parsePair(
    value.workspaceTerminalSplitVertical,
    [0.78, 0.22],
  );
  const workspaceTerminalSplitHorizontal = parsePair(
    value.workspaceTerminalSplitHorizontal,
    [0.62, 0.38],
  );
  const bottomRaw = value.bottomPanelKindsVisible;
  const bottomPanelKindsVisible =
    bottomRaw &&
    typeof bottomRaw === "object" &&
    typeof (bottomRaw as SavedLayoutBottomPanelKindsVisible).terminal === "boolean" &&
    typeof (bottomRaw as SavedLayoutBottomPanelKindsVisible).browser === "boolean"
      ? {
          terminal: (bottomRaw as SavedLayoutBottomPanelKindsVisible).terminal,
          browser: (bottomRaw as SavedLayoutBottomPanelKindsVisible).browser,
        }
      : { terminal: false, browser: false };

  return {
    activeLayoutId,
    leftSidebarWidth,
    leftSidebarCollapsed,
    leftPanelsExplorer,
    workspaceBottomPanelOpen,
    workspaceTerminalSplitVertical,
    workspaceTerminalSplitHorizontal,
    bottomPanelKindsVisible,
  };
}

export function loadSavedLayoutSlots(): SavedLayoutSlot[] {
  try {
    const raw = localStorage.getItem(SAVED_LAYOUTS_STORAGE_KEY);
    if (!raw) return [null, null];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [null, null];
    return [
      parseSnapshot(parsed[0]),
      parseSnapshot(parsed[1]),
    ];
  } catch {
    return [null, null];
  }
}

export function persistSavedLayoutSlots(slots: SavedLayoutSlot[]): void {
  localStorage.setItem(SAVED_LAYOUTS_STORAGE_KEY, JSON.stringify(slots));
}

export function captureCurrentLayoutSnapshot(
  bottomPanelKindsVisible: SavedLayoutBottomPanelKindsVisible,
  activeLayoutId: LayoutPresetId,
  workspaceBottomPanelOpen: boolean,
): SavedLayoutSnapshot {
  return {
    activeLayoutId,
    leftSidebarWidth: loadLayoutPx(LEFT_SIDEBAR_WIDTH_KEY, DEFAULT_LEFT_SIDEBAR_WIDTH),
    leftSidebarCollapsed: loadLayoutBool(LEFT_SIDEBAR_COLLAPSED_KEY, false),
    leftPanelsExplorer: parsePair(
      loadLayoutSizes(LEFT_PANELS_EXPLORER_KEY, [...DEFAULT_LEFT_PANEL_SIZES]),
      [...DEFAULT_LEFT_PANEL_SIZES],
    ),
    workspaceBottomPanelOpen,
    workspaceTerminalSplitVertical: parsePair(
      loadLayoutSizes(WORKSPACE_TERMINAL_SPLIT_VERTICAL_KEY, [0.78, 0.22]),
      [0.78, 0.22],
    ),
    workspaceTerminalSplitHorizontal: parsePair(
      loadLayoutSizes(WORKSPACE_TERMINAL_SPLIT_HORIZONTAL_KEY, [0.62, 0.38]),
      [0.62, 0.38],
    ),
    bottomPanelKindsVisible: { ...bottomPanelKindsVisible },
  };
}

export function applySavedLayoutSnapshot(snapshot: SavedLayoutSnapshot): void {
  saveLayoutPx(LEFT_SIDEBAR_WIDTH_KEY, snapshot.leftSidebarWidth);
  saveLayoutBool(LEFT_SIDEBAR_COLLAPSED_KEY, snapshot.leftSidebarCollapsed);
  saveLayoutSizes(LEFT_PANELS_EXPLORER_KEY, [...snapshot.leftPanelsExplorer]);
  saveLayoutBool(WORKSPACE_BOTTOM_PANEL_KEY, snapshot.workspaceBottomPanelOpen);
  saveLayoutSizes(
    WORKSPACE_TERMINAL_SPLIT_VERTICAL_KEY,
    [...snapshot.workspaceTerminalSplitVertical],
  );
  saveLayoutSizes(
    WORKSPACE_TERMINAL_SPLIT_HORIZONTAL_KEY,
    [...snapshot.workspaceTerminalSplitHorizontal],
  );
}
