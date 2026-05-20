export type RightPanelId = "roundTable" | "workflow";

export type RightPanelVisibility = Record<RightPanelId, boolean>;

export type LayoutPresetId = "default" | "create";

export interface LayoutPreset {
  id: LayoutPresetId;
  label: string;
  disabled?: boolean;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "default", label: "Default" },
  { id: "create", label: "Create Layout", disabled: true },
];

export const DEFAULT_LEFT_SIDEBAR_WIDTH = 224;
export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 288;
export const DEFAULT_LEFT_PANEL_SIZES = [0.55, 0.45] as const;

export const DEFAULT_RIGHT_PANELS: RightPanelVisibility = {
  roundTable: true,
  workflow: true,
};

export const RIGHT_SIDEBAR_COLLAPSED_KEY = "prompt:right-sidebar-width:collapsed";

const WINDOW_LAYOUT_KEYS = [
  "prompt:left-sidebar-width",
  "prompt:left-sidebar-width:collapsed",
  "prompt:left-panels-explorer",
  "prompt:right-sidebar-width",
  "prompt:right-sidebar-width:collapsed",
  "prompt:right-panels-visibility",
] as const;

/** Clears persisted window sizes and panel visibility so components can restore defaults. */
export function clearWindowLayoutStorage(): void {
  for (const key of WINDOW_LAYOUT_KEYS) {
    localStorage.removeItem(key);
  }
}
