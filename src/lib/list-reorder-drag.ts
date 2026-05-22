export type DropSide = "before" | "after";

type DragPointerEvent = {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
};

export function dropSideFromPointer(
  e: DragPointerEvent,
  axis: "horizontal" | "vertical" = "horizontal",
): DropSide {
  const target = e.currentTarget;
  if (!(target instanceof HTMLElement)) return "before";
  const rect = target.getBoundingClientRect();
  if (axis === "vertical") {
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }
  return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
}

export function reorderIdListByPlacement(
  ids: string[],
  sourceId: string,
  targetId: string,
  side: DropSide,
): string[] {
  if (sourceId === targetId) return ids;
  if (!ids.includes(sourceId) || !ids.includes(targetId)) return ids;
  const withoutSource = ids.filter((id) => id !== sourceId);
  const targetIndex = withoutSource.findIndex((id) => id === targetId);
  if (targetIndex < 0) return ids;
  const insertAt = side === "before" ? targetIndex : targetIndex + 1;
  const next = [...withoutSource];
  next.splice(insertAt, 0, sourceId);
  return next;
}
