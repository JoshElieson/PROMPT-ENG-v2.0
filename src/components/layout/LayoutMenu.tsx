import { Check, LayoutGrid } from "lucide-react";
import { LayoutThumbnail } from "@/components/layout/LayoutThumbnail";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLayout } from "@/contexts/LayoutContext";
import { LAYOUT_PRESETS } from "@/lib/layout-defaults";
import { cn } from "@/lib/utils";

export function LayoutMenu() {
  const { activeLayoutId, applyLayoutPreset } = useLayout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Layouts"
          className="group text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-7 w-7 shrink-0 rounded-md"
        >
          <LayoutGrid className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto p-2">
        <p className="text-muted px-1 pb-2 text-[10px] font-medium tracking-wider uppercase">
          Layout
        </p>
        <div className="flex gap-2">
          {LAYOUT_PRESETS.map((preset) => {
            const isActive = preset.id === activeLayoutId && !preset.disabled;
            return (
              <DropdownMenuItem
                key={preset.id}
                className={cn(
                  "group flex h-auto w-[5.5rem] cursor-pointer flex-col items-center gap-1.5 rounded-md border border-transparent p-2 transition-colors",
                  "data-[highlighted]:border-border data-[highlighted]:bg-panel-elevated/85",
                  "data-[highlighted]:text-foreground",
                  isActive && "border-accent/30 bg-panel-elevated/80",
                  preset.disabled && "cursor-default opacity-80",
                )}
                onSelect={(event) => {
                  if (preset.disabled) {
                    event.preventDefault();
                    return;
                  }
                  applyLayoutPreset(preset.id);
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
                    "group-data-[highlighted]:text-foreground",
                    preset.disabled && "text-muted",
                  )}
                >
                  {preset.label}
                  {isActive && <Check className="h-3 w-3 shrink-0" />}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
