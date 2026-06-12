export type PaneGroupOrientation = "horizontal" | "vertical";

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
