import { BookmarkPlus, Check, X } from "lucide-react";
import { LayoutThumbnail, SavedLayoutThumbnail } from "@/components/layout/LayoutThumbnail";
import { useLayout } from "@/contexts/LayoutContext";
import { LAYOUT_PRESETS } from "@/lib/layout-defaults";
import { MAX_SAVED_LAYOUTS } from "@/lib/saved-layout-storage";
import { cn } from "@/lib/utils";

type LayoutPickerVariant = "menu" | "panel" | "settings";

interface LayoutPickerProps {
  variant?: LayoutPickerVariant;
  highlight?: number;
  onHighlightChange?: (index: number) => void;
  onPresetSelect?: () => void;
  onSavedSelect?: () => void;
  className?: string;
}

const presetButtonClass = {
  menu: cn(
    "group flex h-auto w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 transition-colors",
    "data-[highlighted]:border-border data-[highlighted]:bg-panel-elevated/85",
    "data-[highlighted]:text-foreground",
  ),
  panel: cn(
    "group flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 text-left outline-none transition-colors duration-150",
  ),
  settings: cn(
    "flex w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 transition-colors",
    "hover:border-border hover:bg-panel-elevated/85",
  ),
};

const savedButtonClass = {
  menu: cn(
    "group flex h-auto w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 transition-colors",
    "data-[highlighted]:border-border data-[highlighted]:bg-panel-elevated/85",
    "data-[highlighted]:text-foreground",
  ),
  panel: cn(
    "group flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 text-left outline-none transition-colors duration-150",
  ),
  settings: cn(
    "flex w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 transition-colors",
    "hover:border-border hover:bg-panel-elevated/85",
  ),
};

export function LayoutPicker({
  variant = "menu",
  highlight,
  onHighlightChange,
  onPresetSelect,
  onSavedSelect,
  className,
}: LayoutPickerProps) {
  const {
    activeLayoutId,
    activeSavedLayoutSlot,
    savedLayoutSlots,
    applyLayoutPreset,
    applySavedLayout,
    saveCurrentLayout,
    deleteSavedLayout,
  } = useLayout();

  const presetStartIndex = 0;
  const savedStartIndex = LAYOUT_PRESETS.length;

  const presetButtons = LAYOUT_PRESETS.map((preset, index) => {
    const isActive =
      preset.id === activeLayoutId && activeSavedLayoutSlot === null && !preset.disabled;
    const highlighted = highlight === presetStartIndex + index;
    return (
      <button
        key={preset.id}
        type="button"
        disabled={preset.disabled}
        data-highlighted={variant === "menu" && highlighted ? "" : undefined}
        className={cn(
          presetButtonClass[variant],
          variant === "panel" && highlighted && "border-border bg-menu-hover",
          isActive && "border-accent/30 bg-panel-elevated/80",
          preset.disabled && "cursor-default opacity-80",
        )}
        onMouseEnter={() => onHighlightChange?.(presetStartIndex + index)}
        onClick={() => {
          if (preset.disabled) return;
          applyLayoutPreset(preset.id);
          onPresetSelect?.();
        }}
      >
        <LayoutThumbnail
          presetId={preset.id}
          active={isActive}
          disabled={preset.disabled}
        />
        <span
          className={cn(
            "flex w-full items-center justify-center gap-1 text-center text-[11px] leading-tight transition-colors",
            isActive ? "text-accent" : "text-muted-foreground",
            (variant === "panel" && highlighted) || variant === "menu"
              ? "group-data-[highlighted]:text-foreground"
              : "",
            variant === "panel" && highlighted && "text-foreground",
            preset.disabled && "text-muted",
          )}
        >
          {preset.label}
          {isActive && <Check className="h-3 w-3 shrink-0" />}
        </span>
      </button>
    );
  });

  const savedButtons = Array.from({ length: MAX_SAVED_LAYOUTS }, (_, slot) => {
    const snapshot = savedLayoutSlots[slot];
    const slotIndex = savedStartIndex + slot;
    const isActive = activeSavedLayoutSlot === slot;
    const highlighted = highlight === slotIndex;

    if (!snapshot) {
      return (
        <button
          key={`save-${slot}`}
          type="button"
          data-highlighted={variant === "menu" && highlighted ? "" : undefined}
          className={cn(
            savedButtonClass[variant],
            variant === "panel" && highlighted && "border-border bg-menu-hover",
            "border-dashed border-border-subtle text-muted-foreground hover:border-border hover:bg-panel-elevated/60 hover:text-foreground",
          )}
          onMouseEnter={() => onHighlightChange?.(slotIndex)}
          onClick={() => {
            saveCurrentLayout(slot);
          }}
        >
          <span
            className={cn(
              "flex h-11 w-[4.25rem] items-center justify-center rounded border border-dashed border-border-subtle bg-background/60",
              variant === "panel" && highlighted && "border-border",
            )}
            aria-hidden
          >
            <BookmarkPlus className="h-4 w-4" />
          </span>
          <span
            className={cn(
              "flex w-full items-center justify-center text-center text-[11px] leading-tight",
              variant === "panel" && highlighted && "text-foreground",
            )}
          >
            Save current
          </span>
        </button>
      );
    }

    return (
      <div key={`saved-${slot}`} className="relative">
        <button
          type="button"
          data-highlighted={variant === "menu" && highlighted ? "" : undefined}
          className={cn(
            savedButtonClass[variant],
            variant === "panel" && highlighted && "border-border bg-menu-hover",
            isActive && "border-accent/30 bg-panel-elevated/80",
          )}
          onMouseEnter={() => onHighlightChange?.(slotIndex)}
          onClick={() => {
            applySavedLayout(slot);
            onSavedSelect?.();
          }}
        >
          <SavedLayoutThumbnail snapshot={snapshot} active={isActive} />
          <span
            className={cn(
              "flex w-full items-center justify-center gap-1 text-center text-[11px] leading-tight transition-colors",
              isActive ? "text-accent" : "text-muted-foreground",
              (variant === "panel" && highlighted) || variant === "menu"
                ? "group-data-[highlighted]:text-foreground"
                : "",
              variant === "panel" && highlighted && "text-foreground",
            )}
          >
            Saved {slot + 1}
            {isActive && <Check className="h-3 w-3 shrink-0" />}
          </span>
        </button>
        {variant === "settings" && (
          <button
            type="button"
            title={`Delete saved layout ${slot + 1}`}
            aria-label={`Delete saved layout ${slot + 1}`}
            className="text-muted-foreground hover:bg-panel-elevated hover:text-foreground absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-panel shadow-sm transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              deleteSavedLayout(slot);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  });

  if (variant === "settings") {
    return (
      <div className={cn("flex flex-wrap items-start gap-4", className)}>
        <div className="flex gap-3">{presetButtons}</div>
        <div className="border-border-subtle flex gap-3 border-l pl-4">
          {savedButtons}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex gap-2">{presetButtons}</div>
      <div className="flex gap-2">{savedButtons}</div>
    </div>
  );
}

export const LAYOUT_PICKER_ITEM_COUNT = LAYOUT_PRESETS.length + MAX_SAVED_LAYOUTS;
