import type { LayoutPresetId } from "@/lib/layout-defaults";
import type { SavedLayoutSnapshot } from "@/lib/saved-layout-storage";
import { cn } from "@/lib/utils";

interface LayoutThumbnailProps {
  presetId: LayoutPresetId;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

const box = "rounded-[1px]";

const hoverHighlight =
  "group-data-[highlighted]:border-muted-foreground/50 group-data-[highlighted]:ring-1 group-data-[highlighted]:ring-[#6366f1]/30";

/** Mini wireframe of the workspace — LeetCode-style layout preview. */
export function LayoutThumbnail({
  presetId,
  active,
  disabled: _disabled,
  className,
}: LayoutThumbnailProps) {
  if (presetId === "horizontal") {
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
        <span className={cn("w-[20%] shrink-0 bg-muted/38", box)} />
        <span className={cn("min-w-0 flex-1 bg-muted/20", box)} />
        <span className={cn("w-[34%] shrink-0 bg-muted/35", box)} />
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

interface SavedLayoutThumbnailProps {
  snapshot: SavedLayoutSnapshot;
  active?: boolean;
  className?: string;
}

/** Mini wireframe derived from a saved layout snapshot. */
export function SavedLayoutThumbnail({
  snapshot,
  active,
  className,
}: SavedLayoutThumbnailProps) {
  const sidebarWidth = snapshot.leftSidebarCollapsed
    ? "w-1"
    : snapshot.activeLayoutId === "horizontal"
      ? "w-[20%]"
      : "w-[22%]";
  const centerSplit = snapshot.workspaceBottomPanelOpen
    ? snapshot.activeLayoutId === "horizontal"
      ? snapshot.workspaceTerminalSplitHorizontal
      : snapshot.workspaceTerminalSplitVertical
    : null;

  if (snapshot.activeLayoutId === "horizontal") {
    const sideWidth =
      centerSplit && snapshot.workspaceBottomPanelOpen
        ? `${Math.round(centerSplit[1] * 100)}%`
        : "34%";

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
        <span className={cn(sidebarWidth, "shrink-0 bg-muted/38", box)} />
        <span className={cn("min-w-0 flex-1 bg-muted/20", box)} />
        {snapshot.workspaceBottomPanelOpen ? (
          <span
            className={cn("shrink-0 bg-muted/35", box)}
            style={{ width: sideWidth }}
          />
        ) : null}
      </span>
    );
  }

  const bottomFlex = centerSplit
    ? Math.max(1, Math.round(centerSplit[1] * 20))
    : 0;
  const topFlex = centerSplit ? Math.max(1, Math.round(centerSplit[0] * 20)) : 20;

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
      <span className={cn("flex shrink-0 flex-col gap-px", sidebarWidth)}>
        <span
          className={cn("min-h-0 bg-muted/45", box)}
          style={{ flex: Math.round(snapshot.leftPanelsExplorer[0] * 20) }}
        />
        <span
          className={cn("min-h-0 bg-muted/30", box)}
          style={{ flex: Math.round(snapshot.leftPanelsExplorer[1] * 20) }}
        />
      </span>
      {snapshot.workspaceBottomPanelOpen ? (
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span
            className={cn("min-h-0 bg-muted/20", box)}
            style={{ flex: topFlex }}
          />
          <span
            className={cn("min-h-0 bg-muted/35", box)}
            style={{ flex: bottomFlex }}
          />
        </span>
      ) : (
        <span className={cn("min-w-0 flex-1 bg-muted/20", box)} />
      )}
    </span>
  );
}
