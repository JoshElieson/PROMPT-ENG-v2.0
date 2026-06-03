import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { LayoutThumbnail } from "@/components/layout/LayoutThumbnail";
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
  const { activeLayoutId, applyLayoutPreset } = useLayout();
  const [highlight, setHighlight] = useState(() =>
    Math.max(
      0,
      LAYOUT_PRESETS.findIndex((preset) => preset.id === activeLayoutId),
    ),
  );
  const [position, setPosition] = useState<{ top: number; left: number }>(() => ({
    top: anchor.top,
    left: anchor.right + ANCHOR_GAP,
  }));

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const height = panel?.offsetHeight ?? 160;
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

  const selectPreset = useCallback(
    (index: number) => {
      const preset = LAYOUT_PRESETS[index];
      if (!preset || preset.disabled) return;
      applyLayoutPreset(preset.id);
      onClose();
    },
    [applyLayoutPreset, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setHighlight((prev) => Math.min(prev + 1, LAYOUT_PRESETS.length - 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setHighlight((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectPreset(highlight);
      }
    },
    [highlight, onClose, selectPreset],
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
      <div className="flex gap-2 p-3">
        {LAYOUT_PRESETS.map((preset, index) => {
          const isActive = preset.id === activeLayoutId && !preset.disabled;
          const highlighted = index === highlight;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={preset.disabled}
              className={cn(
                "group flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 text-left outline-none transition-colors duration-150",
                highlighted && "border-border bg-menu-hover",
                isActive && "border-accent/30 bg-panel-elevated/80",
                preset.disabled && "cursor-default opacity-80",
              )}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => selectPreset(index)}
            >
              <LayoutThumbnail
                presetId={preset.id}
                active={isActive}
                disabled={preset.disabled}
              />
              <span
                className={cn(
                  "flex w-full items-center justify-center gap-1 text-center text-[11px] leading-tight",
                  isActive ? "text-accent" : "text-muted-foreground",
                  highlighted && "text-foreground",
                )}
              >
                {preset.label}
                {isActive && <Check className="h-3 w-3 shrink-0" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
