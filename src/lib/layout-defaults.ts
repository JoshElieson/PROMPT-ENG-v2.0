export type LayoutPresetId = "default" | "horizontal";

export interface LayoutPreset {
  id: LayoutPresetId;
  label: string;
  disabled?: boolean;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "default", label: "Vertical Default" },
  { id: "horizontal", label: "Horizontal Default" },
];

export const DEFAULT_LEFT_SIDEBAR_WIDTH = 224;
export const DEFAULT_LEFT_PANEL_SIZES = [0.55, 0.45] as const;

export const LEFT_SIDEBAR_COLLAPSED_KEY = "prompt:left-sidebar-width:collapsed";
export const WORKSPACE_LAYOUT_PRESET_KEY = "prompt:workspace-layout-preset";

import { LEGACY_WORKSPACE_LAYOUT_KEY, WORKSPACE_LAYOUT_KEY } from "@/lib/workspace-pane-storage";

const WINDOW_LAYOUT_KEYS = [
  "prompt:left-sidebar-width",
  "prompt:left-sidebar-width:collapsed",
  "prompt:left-panels-explorer",
  "prompt:right-sidebar-width",
  "prompt:right-sidebar-width:collapsed",
  "prompt:right-panels-visibility",
  WORKSPACE_LAYOUT_PRESET_KEY,
  WORKSPACE_LAYOUT_KEY,
  LEGACY_WORKSPACE_LAYOUT_KEY,
] as const;

/** Clears persisted window sizes and panel visibility so components can restore defaults. */
export function clearWindowLayoutStorage(): void {
  for (const key of WINDOW_LAYOUT_KEYS) {
    localStorage.removeItem(key);
  }
}
