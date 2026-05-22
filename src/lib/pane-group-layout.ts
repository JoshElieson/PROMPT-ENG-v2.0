export type PaneGroupOrientation = "horizontal" | "vertical";

export type PaneDropSlot = "before" | "after" | "replace" | "third";

export type SplitDropSlot = "first" | "second";

/** Apply a 2-pane split drop (shared by workspace and bottom panel). */
export function applySplitDrop(
  visiblePaneIds: string[],
  draggedPaneId: string,
  slot: SplitDropSlot,
): string[] {
  const limited = visiblePaneIds.slice(0, 2);
  const targetIndex = slot === "first" ? 0 : 1;

  if (limited.length === 0) {
    return [draggedPaneId];
  }

  if (limited.length === 1) {
    const existing = limited[0]!;
    if (existing === draggedPaneId) return [existing];
    return targetIndex === 0
      ? [draggedPaneId, existing]
      : [existing, draggedPaneId];
  }

  const first = limited[0]!;
  const second = limited[1]!;
  const currentIndex =
    first === draggedPaneId ? 0 : second === draggedPaneId ? 1 : -1;
  if (currentIndex === targetIndex) return [first, second];

  if (currentIndex >= 0) {
    return [second, first];
  }

  const next: [string, string] = [first, second];
  next[targetIndex] = draggedPaneId;
  return next;
}

export function normalizeVisiblePaneIds(
  visiblePaneIds: string[],
  availablePaneIds: string[],
  fallbackPaneId: string | null,
  maxVisible = 3,
): string[] {
  const available = new Set(availablePaneIds);
  const deduped = visiblePaneIds.filter(
    (id, index) => available.has(id) && visiblePaneIds.indexOf(id) === index,
  );

  const maxCount = Math.min(maxVisible, availablePaneIds.length);
  const ensured = deduped.slice(0, maxCount);
  const fallback =
    fallbackPaneId && available.has(fallbackPaneId)
      ? fallbackPaneId
      : (availablePaneIds[0] ?? null);

  if (ensured.length === 0) {
    return fallback ? [fallback] : [];
  }

  if (fallback && !ensured.includes(fallback)) {
    ensured[ensured.length - 1] = fallback;
  }

  return ensured;
}

function insertRelative(
  ids: string[],
  targetId: string,
  draggedId: string,
  slot: "before" | "after",
): string[] {
  const withoutDragged = ids.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.findIndex((id) => id === targetId);
  if (targetIndex < 0) return withoutDragged;
  const insertAt = slot === "before" ? targetIndex : targetIndex + 1;
  const next = [...withoutDragged];
  next.splice(insertAt, 0, draggedId);
  return next;
}

export function applyPaneDropToVisible({
  visiblePaneIds,
  draggedPaneId,
  targetPaneId,
  slot,
  maxVisible = 3,
}: {
  visiblePaneIds: string[];
  draggedPaneId: string;
  targetPaneId: string;
  slot: PaneDropSlot;
  maxVisible?: number;
}): string[] {
  if (!draggedPaneId) return visiblePaneIds;

  if (slot === "third") {
    const withoutDragged = visiblePaneIds.filter((id) => id !== draggedPaneId);
    if (withoutDragged.length === 0) return [draggedPaneId];

    if (withoutDragged.length === 1) {
      if (withoutDragged[0] === targetPaneId) {
        return [targetPaneId, draggedPaneId];
      }
      return [...withoutDragged, draggedPaneId];
    }

    if (withoutDragged.length === 2) {
      const targetIndex = withoutDragged.findIndex((id) => id === targetPaneId);
      if (targetIndex < 0) return [...withoutDragged, draggedPaneId].slice(-maxVisible);
      const otherId = withoutDragged[targetIndex === 0 ? 1 : 0]!;
      // 3-pane render uses [standalone, nestedA, nestedB].
      // Keep target as nestedA so it becomes the pane that splits.
      return [otherId, targetPaneId, draggedPaneId].slice(0, maxVisible);
    }

    return [...withoutDragged, draggedPaneId].slice(-maxVisible);
  }

  if (!visiblePaneIds.includes(targetPaneId)) {
    return visiblePaneIds;
  }

  if (slot === "replace") {
    const withoutDragged = visiblePaneIds.filter((id) => id !== draggedPaneId);
    const targetIndex = withoutDragged.findIndex((id) => id === targetPaneId);
    if (targetIndex < 0) return visiblePaneIds;
    const next = [...withoutDragged];
    next.splice(targetIndex, 1, draggedPaneId);
    return next.slice(0, maxVisible);
  }

  const reordered = insertRelative(
    visiblePaneIds,
    targetPaneId,
    draggedPaneId,
    slot,
  );
  if (reordered.length <= maxVisible) return reordered;

  if (slot === "before") {
    return reordered.slice(0, maxVisible);
  }
  return reordered.slice(reordered.length - maxVisible);
}
