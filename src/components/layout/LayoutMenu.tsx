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
  const { activeLayoutId, applyDefaultLayout } = useLayout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Layouts"
          className="group h-7 w-7 shrink-0 text-muted-foreground hover:bg-zinc-700 hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto p-2">
        <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
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
                  "data-[highlighted]:border-border data-[highlighted]:bg-zinc-700",
                  "data-[highlighted]:text-foreground",
                  isActive && "border-accent/30 bg-panel-elevated/80",
                  preset.disabled && "cursor-default opacity-80",
                )}
                onSelect={(event) => {
                  if (preset.disabled) {
                    event.preventDefault();
                    return;
                  }
                  if (preset.id === "default") applyDefaultLayout();
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
