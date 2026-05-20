import type {
  CenterWorkspaceRoot,
  DoubleWorkspaceRoot,
  PaneModelSession,
  QuadWorkspaceRoot,
  TripleWorkspaceRoot,
  WorkspaceLeafNode,
  WorkspacePaneLayout,
} from "@/types/workspace-pane";
import { DEFAULT_ROUND_TABLE_IDS } from "@/data/ai-models";
import { DEFAULT_ROUND_TABLE_WEIGHTS } from "@/lib/round-table-weights";

/** Legacy global workspace blob (cleared on reset layout). */
export const WORKSPACE_LAYOUT_KEY = "prompt:center-workspace-panes:v2";

export const LEGACY_WORKSPACE_LAYOUT_KEY = "prompt:center-workspace-panes:v1";

function defaultModelSession(): PaneModelSession {
  const weights: Record<string, number> = { ...DEFAULT_ROUND_TABLE_WEIGHTS };
  for (const id of DEFAULT_ROUND_TABLE_IDS) {
    if (weights[id] == null) weights[id] = 100;
  }
  return {
    selectedIds: [...DEFAULT_ROUND_TABLE_IDS],
    activeIds: [...DEFAULT_ROUND_TABLE_IDS],
    weights,
  };
}

export function createWorkspaceLeaf(threadId: string): WorkspaceLeafNode {
  return {
    type: "leaf",
    id: crypto.randomUUID(),
    threadId,
    scrollTop: 0,
    models: defaultModelSession(),
  };
}

export function createDefaultWorkspaceLayout(threadId: string): WorkspacePaneLayout {
  const leaf = createWorkspaceLeaf(threadId);
  return {
    version: 2,
    root: { kind: "single", leaf },
    focusedLeafId: leaf.id,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseModelSession(raw: unknown): PaneModelSession | null {
  if (!isRecord(raw)) return null;
  const selected = raw.selectedIds;
  const active = raw.activeIds;
  const weightsRaw = raw.weights;
  if (!Array.isArray(selected) || !selected.every((x) => typeof x === "string")) {
    return null;
  }
  if (!Array.isArray(active) || !active.every((x) => typeof x === "string")) {
    return null;
  }
  if (!isRecord(weightsRaw)) return null;
  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries(weightsRaw)) {
    if (typeof v === "number" && Number.isFinite(v)) weights[k] = v;
  }
  return { selectedIds: selected, activeIds: active, weights };
}

function parseLeaf(raw: unknown): WorkspaceLeafNode | null {
  if (!isRecord(raw) || raw.type !== "leaf") return null;
  if (typeof raw.id !== "string") return null;
  const threadId =
    typeof raw.threadId === "string"
      ? raw.threadId
      : typeof raw.chatId === "string"
        ? raw.chatId
        : null;
  if (!threadId) return null;
  const models = parseModelSession(raw.models) ?? defaultModelSession();
  const scrollTop =
    typeof raw.scrollTop === "number" && Number.isFinite(raw.scrollTop)
      ? raw.scrollTop
      : 0;
  return {
    type: "leaf",
    id: raw.id,
    threadId,
    scrollTop,
    models,
  };
}

function parseV2Root(raw: unknown): CenterWorkspaceRoot | null {
  if (!isRecord(raw) || typeof raw.kind !== "string") return null;
  switch (raw.kind) {
    case "single": {
      const leaf = parseLeaf(raw.leaf);
      if (!leaf) return null;
      return { kind: "single", leaf };
    }
    case "double": {
      if (raw.direction !== "horizontal" && raw.direction !== "vertical") return null;
      const first = parseLeaf(raw.first);
      const second = parseLeaf(raw.second);
      if (!first || !second) return null;
      const sizes = parsePair(raw.sizes);
      if (!sizes) return null;
      const d: DoubleWorkspaceRoot = {
        kind: "double",
        direction: raw.direction,
        sizes,
        first,
        second,
      };
      return d;
    }
    case "triple": {
      const topLeft = parseLeaf(raw.topLeft);
      const topRight = parseLeaf(raw.topRight);
      const bottom = parseLeaf(raw.bottom);
      if (!topLeft || !topRight || !bottom) return null;
      const verticalSizes = parsePair(raw.verticalSizes);
      const topHorizontalSizes = parsePair(raw.topHorizontalSizes);
      if (!verticalSizes || !topHorizontalSizes) return null;
      const t: TripleWorkspaceRoot = {
        kind: "triple",
        verticalSizes,
        topHorizontalSizes,
        topLeft,
        topRight,
        bottom,
      };
      return t;
    }
    case "quad": {
      const topLeft = parseLeaf(raw.topLeft);
      const topRight = parseLeaf(raw.topRight);
      const bottomLeft = parseLeaf(raw.bottomLeft);
      const bottomRight = parseLeaf(raw.bottomRight);
      if (!topLeft || !topRight || !bottomLeft || !bottomRight) return null;
      const verticalSizes = parsePair(raw.verticalSizes);
      const topHorizontalSizes = parsePair(raw.topHorizontalSizes);
      const bottomHorizontalSizes = parsePair(raw.bottomHorizontalSizes);
      if (!verticalSizes || !topHorizontalSizes || !bottomHorizontalSizes) return null;
      const q: QuadWorkspaceRoot = {
        kind: "quad",
        verticalSizes,
        topHorizontalSizes,
        bottomHorizontalSizes,
        topLeft,
        topRight,
        bottomLeft,
        bottomRight,
      };
      return q;
    }
    default:
      return null;
  }
}

function parsePair(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = raw[0];
  const b = raw[1];
  if (typeof a !== "number" || typeof b !== "number" || a <= 0 || b <= 0) return null;
  const sum = a + b;
  return [a / sum, b / sum];
}

export function parseWorkspacePaneLayoutV2(raw: unknown): WorkspacePaneLayout | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 2) return null;
  const root = parseV2Root(raw.root);
  if (!root) return null;
  if (typeof raw.focusedLeafId !== "string") return null;
  const ids = collectLeafIdsFromRoot(root);
  if (!ids.includes(raw.focusedLeafId)) return null;
  return { version: 2, root, focusedLeafId: raw.focusedLeafId };
}

function collectLeafIdsFromRoot(root: CenterWorkspaceRoot): string[] {
  switch (root.kind) {
    case "single":
      return [root.leaf.id];
    case "double":
      return [root.first.id, root.second.id];
    case "triple":
      return [root.topLeft.id, root.topRight.id, root.bottom.id];
    case "quad":
      return [
        root.topLeft.id,
        root.topRight.id,
        root.bottomLeft.id,
        root.bottomRight.id,
      ];
    default:
      return [];
  }
}
