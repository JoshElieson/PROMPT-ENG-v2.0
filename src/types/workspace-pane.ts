/** Maximum number of simultaneous chat panes in the center workspace. */
export const MAX_WORKSPACE_PANES = 7;

/** Per-pane model cart + round table snapshot (independent from sidebar global cart). */
export interface PaneModelSession {
  selectedIds: string[];
  activeIds: string[];
  weights: Record<string, number>;
}

export interface WorkspaceLeafNode {
  type: "leaf";
  id: string;
  /** Thread id within the parent sidebar `Chat` (not a separate chat list entry). */
  threadId: string;
  /** Restored vertical scroll offset for the message list. */
  scrollTop?: number;
  models: PaneModelSession;
}

/** `horizontal` = side-by-side (flex row); `vertical` = stacked (flex column). */
export type WorkspaceSplitDirection = "horizontal" | "vertical";

/** One full-width pane. */
export type SingleWorkspaceRoot = {
  kind: "single";
  leaf: WorkspaceLeafNode;
};

/** Two panes: one split, auto-chosen direction when expanding from single. */
export type DoubleWorkspaceRoot = {
  kind: "double";
  direction: WorkspaceSplitDirection;
  sizes: [number, number];
  first: WorkspaceLeafNode;
  second: WorkspaceLeafNode;
};

/** Three panes: two on top, one full-width below. */
export type TripleWorkspaceRoot = {
  kind: "triple";
  verticalSizes: [number, number];
  topHorizontalSizes: [number, number];
  topLeft: WorkspaceLeafNode;
  topRight: WorkspaceLeafNode;
  bottom: WorkspaceLeafNode;
};

/** Four panes: 2×2 corners. */
export type QuadWorkspaceRoot = {
  kind: "quad";
  verticalSizes: [number, number];
  topHorizontalSizes: [number, number];
  bottomHorizontalSizes: [number, number];
  topLeft: WorkspaceLeafNode;
  topRight: WorkspaceLeafNode;
  bottomLeft: WorkspaceLeafNode;
  bottomRight: WorkspaceLeafNode;
  /** Extra agent tabs beyond the 2×2 base layout (up to MAX_WORKSPACE_PANES). */
  overflow?: WorkspaceLeafNode[];
};

export type CenterWorkspaceRoot =
  | SingleWorkspaceRoot
  | DoubleWorkspaceRoot
  | TripleWorkspaceRoot
  | QuadWorkspaceRoot;

export interface WorkspacePaneLayout {
  /** Persist format version (v2 = fixed corner layouts). */
  version: 2;
  root: CenterWorkspaceRoot;
  /** Leaf id receiving sidebar "active chat" assignments. */
  focusedLeafId: string;
}
