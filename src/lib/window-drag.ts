import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/tauri";

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  "[data-no-drag]",
].join(", ");

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR)
  );
}

/** Start native window drag (frameless title bar). Skips buttons and other controls. */
export function startWindowDrag(event: MouseEvent): void {
  if (!isTauri() || event.button !== 0 || isInteractiveTarget(event.target)) {
    return;
  }
  void getCurrentWindow().startDragging();
}

export function tauriDragRegionProps(): Record<string, boolean> | undefined {
  return isTauri() ? { "data-tauri-drag-region": true } : undefined;
}
