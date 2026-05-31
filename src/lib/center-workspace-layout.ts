import type {
  CenterWorkspaceRoot,
  DoubleWorkspaceRoot,
  PaneModelSession,
  QuadWorkspaceRoot,
  SingleWorkspaceRoot,
  TripleWorkspaceRoot,
  WorkspaceLeafNode,
  WorkspacePaneLayout,
  WorkspaceSplitDirection,
} from "@/types/workspace-pane";
import { MAX_WORKSPACE_PANES } from "@/types/workspace-pane";

export function cloneModelSession(session: PaneModelSession): PaneModelSession {
  return {
    selectedIds: [...session.selectedIds],
    activeIds: [...session.activeIds],
    weights: { ...session.weights },
  };
}

function normalizePair(a: number, b: number): [number, number] {
  const sum = a + b;
  if (sum <= 0) return [0.5, 0.5];
  return [a / sum, b / sum];
}

export function countPanes(root: CenterWorkspaceRoot): number {
  switch (root.kind) {
    case "single":
      return 1;
    case "double":
      return 2;
    case "triple":
      return 3;
    case "quad":
      return 4 + (root.overflow?.length ?? 0);
    default:
      return 1;
  }
}

export function collectLeafIds(root: CenterWorkspaceRoot): string[] {
  return collectLeaves(root).map((leaf) => leaf.id);
}

export function collectLeaves(root: CenterWorkspaceRoot): WorkspaceLeafNode[] {
  switch (root.kind) {
    case "single":
      return [root.leaf];
    case "double":
      return [root.first, root.second];
    case "triple":
      return [root.topLeft, root.topRight, root.bottom];
    case "quad":
      return [
        root.topLeft,
        root.topRight,
        root.bottomLeft,
        root.bottomRight,
        ...(root.overflow ?? []),
      ];
    default:
      return [];
  }
}

export function findLeaf(
  root: CenterWorkspaceRoot,
  leafId: string,
): WorkspaceLeafNode | null {
  switch (root.kind) {
    case "single":
      return root.leaf.id === leafId ? root.leaf : null;
    case "double":
      if (root.first.id === leafId) return root.first;
      if (root.second.id === leafId) return root.second;
      return null;
    case "triple":
      if (root.topLeft.id === leafId) return root.topLeft;
      if (root.topRight.id === leafId) return root.topRight;
      if (root.bottom.id === leafId) return root.bottom;
      return null;
    case "quad":
      if (root.topLeft.id === leafId) return root.topLeft;
      if (root.topRight.id === leafId) return root.topRight;
      if (root.bottomLeft.id === leafId) return root.bottomLeft;
      if (root.bottomRight.id === leafId) return root.bottomRight;
      return root.overflow?.find((leaf) => leaf.id === leafId) ?? null;
    default:
      return null;
  }
}

export function assignLeafModels(
  layout: WorkspacePaneLayout,
  leafId: string,
  models: PaneModelSession,
): WorkspacePaneLayout {
  const apply = (l: WorkspaceLeafNode) =>
    l.id === leafId ? { ...l, models: cloneModelSession(models) } : l;
  const root = layout.root;
  switch (root.kind) {
    case "single":
      return { ...layout, root: { kind: "single", leaf: apply(root.leaf) } };
    case "double":
      return {
        ...layout,
        root: {
          ...root,
          first: apply(root.first),
          second: apply(root.second),
        },
      };
    case "triple":
      return {
        ...layout,
        root: {
          ...root,
          topLeft: apply(root.topLeft),
          topRight: apply(root.topRight),
          bottom: apply(root.bottom),
        },
      };
    case "quad":
      return {
        ...layout,
        root: {
          ...root,
          topLeft: apply(root.topLeft),
          topRight: apply(root.topRight),
          bottomLeft: apply(root.bottomLeft),
          bottomRight: apply(root.bottomRight),
          overflow: root.overflow?.map(apply),
        },
      };
    default:
      return layout;
  }
}

export function assignLeafScrollTop(
  layout: WorkspacePaneLayout,
  leafId: string,
  scrollTop: number,
): WorkspacePaneLayout {
  const apply = (l: WorkspaceLeafNode) =>
    l.id === leafId ? { ...l, scrollTop } : l;
  const root = layout.root;
  switch (root.kind) {
    case "single":
      return { ...layout, root: { kind: "single", leaf: apply(root.leaf) } };
    case "double":
      return {
        ...layout,
        root: {
          ...root,
          first: apply(root.first),
          second: apply(root.second),
        },
      };
    case "triple":
      return {
        ...layout,
        root: {
          ...root,
          topLeft: apply(root.topLeft),
          topRight: apply(root.topRight),
          bottom: apply(root.bottom),
        },
      };
    case "quad":
      return {
        ...layout,
        root: {
          ...root,
          topLeft: apply(root.topLeft),
          topRight: apply(root.topRight),
          bottomLeft: apply(root.bottomLeft),
          bottomRight: apply(root.bottomRight),
          overflow: root.overflow?.map(apply),
        },
      };
    default:
      return layout;
  }
}

function newLeaf(threadId: string, models: PaneModelSession): WorkspaceLeafNode {
  return {
    type: "leaf",
    id: crypto.randomUUID(),
    threadId,
    scrollTop: 0,
    models: cloneModelSession(models),
  };
}

function nextFocusedLeafId(
  prevFocus: string,
  removedLeafId: string,
  newRoot: CenterWorkspaceRoot,
): string {
  const ids = collectLeafIds(newRoot);
  if (ids.length === 0) return prevFocus;
  if (prevFocus !== removedLeafId && ids.includes(prevFocus)) return prevFocus;
  return ids[0]!;
}

/**
 * Removes one pane from the fixed workspace shapes (inverse of expand), and
 * returns the thread id tied to that leaf so callers can drop it from `Chat.threads`.
 */
export function collapseWorkspaceByLeaf(
  layout: WorkspacePaneLayout,
  leafId: string,
): { layout: WorkspacePaneLayout; removedThreadId: string } | null {
  const root = layout.root;
  const hit = findLeaf(root, leafId);
  if (!hit) return null;

  const removedThreadId = hit.threadId;

  switch (root.kind) {
    case "single":
      return null;
    case "double": {
      let kept: WorkspaceLeafNode;
      if (root.first.id === leafId) kept = root.second;
      else if (root.second.id === leafId) kept = root.first;
      else return null;
      const newRoot: SingleWorkspaceRoot = { kind: "single", leaf: kept };
      return {
        layout: {
          ...layout,
          version: 2,
          root: newRoot,
          focusedLeafId: nextFocusedLeafId(
            layout.focusedLeafId,
            leafId,
            newRoot,
          ),
        },
        removedThreadId,
      };
    }
    case "triple": {
      const t = root;
      if (t.bottom.id === leafId) {
        const newRoot: DoubleWorkspaceRoot = {
          kind: "double",
          direction: "horizontal",
          sizes: normalizePair(t.topHorizontalSizes[0], t.topHorizontalSizes[1]),
          first: t.topLeft,
          second: t.topRight,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      if (t.topLeft.id === leafId) {
        const newRoot: DoubleWorkspaceRoot = {
          kind: "double",
          direction: "vertical",
          sizes: normalizePair(t.verticalSizes[0], t.verticalSizes[1]),
          first: t.topRight,
          second: t.bottom,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      if (t.topRight.id === leafId) {
        const newRoot: DoubleWorkspaceRoot = {
          kind: "double",
          direction: "vertical",
          sizes: normalizePair(t.verticalSizes[0], t.verticalSizes[1]),
          first: t.topLeft,
          second: t.bottom,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      return null;
    }
    case "quad": {
      const q = root;
      const overflow = q.overflow ?? [];
      const overflowIndex = overflow.findIndex((leaf) => leaf.id === leafId);
      if (overflowIndex >= 0) {
        const nextOverflow = overflow.filter((_, i) => i !== overflowIndex);
        const newRoot: QuadWorkspaceRoot = {
          ...q,
          overflow: nextOverflow.length > 0 ? nextOverflow : undefined,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }

      if (overflow.length > 0) {
        const promoted = overflow[0]!;
        const remaining = overflow.slice(1);
        const nextRoot: QuadWorkspaceRoot = {
          ...q,
          overflow: remaining.length > 0 ? remaining : undefined,
        };
        if (q.topLeft.id === leafId) nextRoot.topLeft = promoted;
        else if (q.topRight.id === leafId) nextRoot.topRight = promoted;
        else if (q.bottomLeft.id === leafId) nextRoot.bottomLeft = promoted;
        else if (q.bottomRight.id === leafId) nextRoot.bottomRight = promoted;
        else return null;
        return {
          layout: {
            ...layout,
            version: 2,
            root: nextRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              nextRoot,
            ),
          },
          removedThreadId,
        };
      }

      if (q.bottomRight.id === leafId) {
        const newRoot: TripleWorkspaceRoot = {
          kind: "triple",
          verticalSizes: [q.verticalSizes[0], q.verticalSizes[1]] as [
            number,
            number,
          ],
          topHorizontalSizes: [q.topHorizontalSizes[0], q.topHorizontalSizes[1]] as [
            number,
            number,
          ],
          topLeft: q.topLeft,
          topRight: q.topRight,
          bottom: q.bottomLeft,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      if (q.bottomLeft.id === leafId) {
        const newRoot: TripleWorkspaceRoot = {
          kind: "triple",
          verticalSizes: [q.verticalSizes[0], q.verticalSizes[1]] as [
            number,
            number,
          ],
          topHorizontalSizes: [q.topHorizontalSizes[0], q.topHorizontalSizes[1]] as [
            number,
            number,
          ],
          topLeft: q.topLeft,
          topRight: q.topRight,
          bottom: q.bottomRight,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      if (q.topRight.id === leafId) {
        const newRoot: TripleWorkspaceRoot = {
          kind: "triple",
          verticalSizes: [q.verticalSizes[0], q.verticalSizes[1]] as [
            number,
            number,
          ],
          topHorizontalSizes: normalizePair(
            q.topHorizontalSizes[0],
            q.bottomHorizontalSizes[0],
          ),
          topLeft: q.topLeft,
          topRight: q.bottomLeft,
          bottom: q.bottomRight,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      if (q.topLeft.id === leafId) {
        const newRoot: TripleWorkspaceRoot = {
          kind: "triple",
          verticalSizes: [q.verticalSizes[0], q.verticalSizes[1]] as [
            number,
            number,
          ],
          topHorizontalSizes: normalizePair(
            q.topHorizontalSizes[1],
            q.bottomHorizontalSizes[0],
          ),
          topLeft: q.topRight,
          topRight: q.bottomLeft,
          bottom: q.bottomRight,
        };
        return {
          layout: {
            ...layout,
            version: 2,
            root: newRoot,
            focusedLeafId: nextFocusedLeafId(
              layout.focusedLeafId,
              leafId,
              newRoot,
            ),
          },
          removedThreadId,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

export function expandWorkspaceLayout(
  layout: WorkspacePaneLayout,
  aspectWide: boolean,
  newThreadId: string,
): WorkspacePaneLayout | null {
  const n = countPanes(layout.root);
  if (n >= MAX_WORKSPACE_PANES) return null;

  switch (layout.root.kind) {
    case "single": {
      const L = layout.root.leaf;
      const R = newLeaf(newThreadId, L.models);
      const direction: WorkspaceSplitDirection = aspectWide
        ? "horizontal"
        : "vertical";
      const sizes = normalizePair(0.5, 0.5);
      const root: DoubleWorkspaceRoot = {
        kind: "double",
        direction,
        sizes,
        first: L,
        second: R,
      };
      return { ...layout, version: 2, focusedLeafId: R.id, root };
    }
    case "double": {
      const d = layout.root;
      const bottom = newLeaf(newThreadId, cloneModelSession(d.first.models));
      const root: TripleWorkspaceRoot = {
        kind: "triple",
        verticalSizes: normalizePair(0.55, 0.45),
        topHorizontalSizes: [...d.sizes] as [number, number],
        topLeft: d.first,
        topRight: d.second,
        bottom,
      };
      return { ...layout, version: 2, focusedLeafId: bottom.id, root };
    }
    case "triple": {
      const t = layout.root;
      const bottomRight = newLeaf(
        newThreadId,
        cloneModelSession(t.bottom.models),
      );
      const root: QuadWorkspaceRoot = {
        kind: "quad",
        verticalSizes: [...t.verticalSizes] as [number, number],
        topHorizontalSizes: [...t.topHorizontalSizes] as [number, number],
        bottomHorizontalSizes: normalizePair(0.5, 0.5),
        topLeft: t.topLeft,
        topRight: t.topRight,
        bottomLeft: t.bottom,
        bottomRight,
      };
      return { ...layout, version: 2, focusedLeafId: bottomRight.id, root };
    }
    case "quad": {
      const next = newLeaf(
        newThreadId,
        cloneModelSession(layout.root.bottomRight.models),
      );
      return {
        ...layout,
        version: 2,
        focusedLeafId: next.id,
        root: {
          ...layout.root,
          overflow: [...(layout.root.overflow ?? []), next],
        },
      };
    }
  }
}

export function ensureFocusedLeafExists(
  layout: WorkspacePaneLayout,
): WorkspacePaneLayout {
  const ids = collectLeafIds(layout.root);
  if (ids.includes(layout.focusedLeafId)) return layout;
  const first = ids[0];
  if (!first) return layout;
  return { ...layout, focusedLeafId: first };
}

export function reconcileWorkspaceThreads(
  layout: WorkspacePaneLayout,
  validThreadIds: Set<string>,
  fallbackThreadId: string,
): WorkspacePaneLayout {
  const fix = (leaf: WorkspaceLeafNode): WorkspaceLeafNode =>
    validThreadIds.has(leaf.threadId)
      ? leaf
      : { ...leaf, threadId: fallbackThreadId };

  const root = layout.root;
  let nextRoot: CenterWorkspaceRoot;
  switch (root.kind) {
    case "single":
      nextRoot = { kind: "single", leaf: fix(root.leaf) };
      break;
    case "double":
      nextRoot = {
        ...root,
        first: fix(root.first),
        second: fix(root.second),
      };
      break;
    case "triple":
      nextRoot = {
        ...root,
        topLeft: fix(root.topLeft),
        topRight: fix(root.topRight),
        bottom: fix(root.bottom),
      };
      break;
    case "quad":
      nextRoot = {
        ...root,
        topLeft: fix(root.topLeft),
        topRight: fix(root.topRight),
        bottomLeft: fix(root.bottomLeft),
        bottomRight: fix(root.bottomRight),
        overflow: root.overflow?.map(fix),
      };
      break;
    default:
      nextRoot = root;
  }

  const ids = collectLeafIds(nextRoot);
  const focused = ids.includes(layout.focusedLeafId)
    ? layout.focusedLeafId
    : (ids[0] ?? layout.focusedLeafId);

  return { ...layout, root: nextRoot, focusedLeafId: focused };
}
