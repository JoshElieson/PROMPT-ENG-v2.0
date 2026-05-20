import type { LayoutPresetId } from "@/lib/layout-defaults";
import { cn } from "@/lib/utils";

interface LayoutThumbnailProps {
  presetId: LayoutPresetId;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

const box = "rounded-[1px]";

const hoverHighlight =
  "group-data-[highlighted]:border-muted-foreground/50 group-data-[highlighted]:ring-1 group-data-[highlighted]:ring-zinc-600/80";

/** Mini wireframe of the workspace — LeetCode-style layout preview. */
export function LayoutThumbnail({
  presetId,
  active,
  disabled,
  className,
}: LayoutThumbnailProps) {
  if (presetId === "create") {
    return (
      <span
        className={cn(
          "flex h-11 w-[4.25rem] items-center justify-center rounded border border-dashed border-border bg-surface/40",
          active && "border-accent/60 ring-1 ring-accent/30",
          hoverHighlight,
          className,
        )}
        aria-hidden
      >
        <span className="text-lg font-light leading-none text-muted group-data-[highlighted]:text-foreground">
          +
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex h-11 w-[4.25rem] gap-px rounded border border-border-subtle bg-background p-0.5",
        active && "border-accent/60 ring-1 ring-accent/30",
        hoverHighlight,
        className,
      )}
      aria-hidden
    >
      <span className={cn("w-1 shrink-0 bg-muted/70", box)} />
      <span className="flex w-[22%] shrink-0 flex-col gap-px">
        <span className={cn("min-h-0 flex-[11] bg-muted/45", box)} />
        <span className={cn("min-h-0 flex-[9] bg-muted/30", box)} />
      </span>
      <span className={cn("min-w-0 flex-1 bg-muted/20", box)} />
      <span className="flex w-[26%] shrink-0 flex-col gap-px">
        <span className={cn("min-h-0 flex-[13] bg-muted/45", box)} />
        <span className={cn("min-h-0 flex-[7] bg-muted/30", box)} />
      </span>
    </span>
  );
}
