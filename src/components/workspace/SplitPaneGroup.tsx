import { useMemo, useState, type ReactNode } from "react";
import {
  applySplitDrop,
  type PaneGroupOrientation,
  type SplitDropSlot,
} from "@/lib/pane-group-layout";
import { cn } from "@/lib/utils";

function dropZoneLabel(slot: SplitDropSlot): string {
  return slot === "first" ? "Drop in first half" : "Drop in second half";
}

export function SplitPaneGroup({
  visiblePaneIds,
  draggingPaneId,
  orientation,
  twoSizes,
  onTwoSizesChange,
  threePrimarySizes,
  onThreePrimarySizesChange,
  threeSecondarySizes,
  onThreeSecondarySizesChange,
  onDropComplete,
  renderPane,
}: {
  visiblePaneIds: string[];
  draggingPaneId: string | null;
  orientation: PaneGroupOrientation;
  twoSizes?: [number, number];
  onTwoSizesChange?: (sizes: [number, number]) => void;
  threePrimarySizes?: [number, number];
  onThreePrimarySizesChange?: (sizes: [number, number]) => void;
  threeSecondarySizes?: [number, number];
  onThreeSecondarySizesChange?: (sizes: [number, number]) => void;
  onDropComplete: (nextVisiblePaneIds: string[]) => void;
  renderPane: (paneId: string) => ReactNode;
}) {
  void twoSizes;
  void threePrimarySizes;
  void onThreePrimarySizesChange;
  void threeSecondarySizes;
  void onThreeSecondarySizesChange;
  const [dropSlot, setDropSlot] = useState<SplitDropSlot | null>(null);
  const [isDragOverGroup, setIsDragOverGroup] = useState(false);
  const isDragging = draggingPaneId != null;
  const visible = useMemo(() => visiblePaneIds.slice(0, 2), [visiblePaneIds]);

  const applyDrop = (slot: SplitDropSlot) => {
    if (!draggingPaneId) return;
    const next = applySplitDrop(visible, draggingPaneId, slot);
    onTwoSizesChange?.([0.5, 0.5]);
    onDropComplete(next);
    setDropSlot(null);
    setIsDragOverGroup(false);
  };

  const splitDirectionClass = orientation === "horizontal" ? "flex-col" : "flex-row";
  const paneClassName =
    "split-pane relative flex min-h-0 min-w-0 flex-1 basis-1/2 overflow-hidden";
  const splitGroupClassName = cn(
    "split-group flex h-full w-full min-h-0 min-w-0 flex-1 overflow-hidden",
    splitDirectionClass,
  );

  const content =
    visible.length <= 1 ? (
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {visible[0] ? renderPane(visible[0]) : null}
      </div>
    ) : (
      <div className={splitGroupClassName}>
        <div className={paneClassName}>{renderPane(visible[0]!)}</div>
        <div className={paneClassName}>{renderPane(visible[1]!)}</div>
      </div>
    );

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden"
      onDragOver={(e) => {
        if (!isDragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOverGroup(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!dropSlot) {
          setDropSlot(null);
          setIsDragOverGroup(false);
          return;
        }
        applyDrop(dropSlot);
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;
        setDropSlot(null);
        setIsDragOverGroup(false);
      }}
    >
      {content}
      {isDragging && isDragOverGroup ? (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className={cn(
              "pointer-events-none flex h-full w-full min-h-0 min-w-0 overflow-hidden rounded-lg border border-[#6366f1]/25 bg-[#6366f1]/5",
              splitDirectionClass,
            )}
          >
            {(["first", "second"] as const).map((slot) => (
              <div
                key={slot}
                role="button"
                aria-label={dropZoneLabel(slot)}
                className={cn(
                  "pointer-events-auto min-h-0 min-w-0 flex-1 border border-dashed border-[#818cf8]/45 bg-[#6366f1]/10 transition-all",
                  dropSlot === slot &&
                    "border-solid border-[#818cf8] bg-[#6366f1]/20 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.4)]",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropSlot(slot);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  applyDrop(slot);
                }}
                onDragLeave={(e) => {
                  const related = e.relatedTarget as Node | null;
                  if (related && e.currentTarget.contains(related)) return;
                  setDropSlot((prev) => (prev === slot ? null : prev));
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
