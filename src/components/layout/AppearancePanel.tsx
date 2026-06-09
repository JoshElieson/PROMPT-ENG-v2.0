import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LAYOUT_PICKER_ITEM_COUNT,
  LayoutPicker,
} from "@/components/layout/LayoutPicker";
import { useLayout } from "@/contexts/LayoutContext";
import { LAYOUT_PRESETS } from "@/lib/layout-defaults";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;

interface AppearancePanelProps {
  anchor: DOMRect;
  onClose: () => void;
}

export function AppearancePanel({ anchor, onClose }: AppearancePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    activeLayoutId,
    activeSavedLayoutSlot,
    savedLayoutSlots,
    applyLayoutPreset,
    applySavedLayout,
    saveCurrentLayout,
  } = useLayout();
  const [highlight, setHighlight] = useState(() => {
    const presetIndex = activeSavedLayoutSlot ?? (activeLayoutId === "horizontal" ? 1 : 0);
    return Math.max(0, Math.min(presetIndex, LAYOUT_PICKER_ITEM_COUNT - 1));
  });
  const [position, setPosition] = useState<{ top: number; left: number }>(() => ({
    top: anchor.top,
    left: anchor.right + ANCHOR_GAP,
  }));

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchor.right + ANCHOR_GAP;
    if (left + PANEL_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
      left = anchor.left - PANEL_WIDTH - ANCHOR_GAP;
    }
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
    );

    let top = anchor.top;
    if (top + height > viewportHeight - VIEWPORT_MARGIN) {
      top = viewportHeight - height - VIEWPORT_MARGIN;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    setPosition({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setHighlight((prev) => Math.min(prev + 1, LAYOUT_PICKER_ITEM_COUNT - 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setHighlight((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (highlight < LAYOUT_PRESETS.length) {
          const preset = LAYOUT_PRESETS[highlight];
          if (preset && !preset.disabled) {
            applyLayoutPreset(preset.id);
            onClose();
          }
          return;
        }
        const slot = highlight - LAYOUT_PRESETS.length;
        const snapshot = savedLayoutSlots[slot];
        if (snapshot) {
          applySavedLayout(slot);
          onClose();
        } else {
          saveCurrentLayout(slot);
        }
      }
    },
    [
      highlight,
      onClose,
      applyLayoutPreset,
      applySavedLayout,
      saveCurrentLayout,
      savedLayoutSlots,
    ],
  );

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      data-appearance-panel=""
      aria-label="Appearance"
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-panel/95 text-foreground shadow-[0_8px_24px_rgba(2,6,23,0.34)] backdrop-blur-md",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        top: position.top,
        left: position.left,
        width: PANEL_WIDTH,
      }}
      onKeyDown={handleKeyDown}
    >
      <p className="border-b border-border-subtle px-3 py-2 text-[11px] font-medium tracking-wide text-muted">
        Layout
      </p>
      <div className="p-3">
        <LayoutPicker
          variant="panel"
          highlight={highlight}
          onHighlightChange={setHighlight}
          onPresetSelect={onClose}
          onSavedSelect={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
