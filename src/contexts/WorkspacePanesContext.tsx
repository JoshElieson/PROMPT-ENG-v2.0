import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLayout } from "@/contexts/LayoutContext";
import { useChats } from "@/contexts/ChatsContext";
import {
  assignLeafModels,
  assignLeafScrollTop,
  collectLeafIds,
  countPanes,
  ensureFocusedLeafExists,
} from "@/lib/center-workspace-layout";
import { normalizeVisiblePaneIds } from "@/lib/pane-group-layout";
import type { PaneModelSession } from "@/types/workspace-pane";
import { MAX_WORKSPACE_PANES } from "@/types/workspace-pane";

interface WorkspacePanesContextValue {
  layout: NonNullable<ReturnType<typeof useChats>["activeWorkspaceLayout"]>;
  paneCount: number;
  maxPanes: number;
  focusedLeafId: string;
  setFocusedLeafId: (leafId: string) => void;
  expandLayout: (aspectWide: boolean) => boolean;
  /** Removes this pane's thread and merges layout (4→3→2→1). */
  closeLeaf: (leafId: string) => boolean;
  onLeafModelsChange: (leafId: string, models: PaneModelSession) => void;
  onLeafScrollChange: (leafId: string, scrollTop: number) => void;
  splitOrientation: "horizontal" | "vertical";
  visibleLeafIds: string[];
  setVisibleLeafIds: (ids: string[]) => void;
  dragLeafId: string | null;
  setDragLeafId: (leafId: string | null) => void;
}

const WorkspacePanesContext = createContext<WorkspacePanesContextValue | null>(
  null,
);

export function WorkspacePanesProvider({ children }: { children: ReactNode }) {
  const { activeLayoutId } = useLayout();
  const {
    activeWorkspaceLayout,
    patchActiveWorkspaceLayout,
    expandActiveWorkspaceLayout,
    closeActiveWorkspaceLeaf,
  } = useChats();

  if (!activeWorkspaceLayout) {
    throw new Error(
      "WorkspacePanesProvider requires activeWorkspaceLayout (gate in MainWorkspace).",
    );
  }

  const layout = activeWorkspaceLayout;
  const splitOrientation: "horizontal" | "vertical" =
    activeLayoutId === "horizontal" ? "horizontal" : "vertical";
  const availableLeafIds = useMemo(() => collectLeafIds(layout.root), [layout.root]);
  const [visibleLeafIdsRaw, setVisibleLeafIdsRaw] = useState<string[]>([]);
  const [dragLeafId, setDragLeafId] = useState<string | null>(null);

  const paneCount = useMemo(() => countPanes(layout.root), [layout.root]);

  const setFocusedLeafId = useCallback(
    (leafId: string) => {
      patchActiveWorkspaceLayout((prev) => ({ ...prev, focusedLeafId: leafId }));
      setVisibleLeafIdsRaw((prev) => {
        const normalized = normalizeVisiblePaneIds(
          prev,
          availableLeafIds,
          leafId,
          2,
        );
        if (normalized.includes(leafId)) return normalized;
        const next = [...normalized];
        next[next.length - 1] = leafId;
        return next;
      });
    },
    [availableLeafIds, patchActiveWorkspaceLayout],
  );

  const expandLayout = useCallback(
    (aspectWide: boolean) => expandActiveWorkspaceLayout(aspectWide),
    [expandActiveWorkspaceLayout],
  );

  const closeLeaf = useCallback(
    (leafId: string) => closeActiveWorkspaceLeaf(leafId),
    [closeActiveWorkspaceLeaf],
  );

  const onLeafModelsChange = useCallback(
    (leafId: string, models: PaneModelSession) => {
      patchActiveWorkspaceLayout((prev) =>
        assignLeafModels(prev, leafId, models),
      );
    },
    [patchActiveWorkspaceLayout],
  );

  const onLeafScrollChange = useCallback(
    (leafId: string, scrollTop: number) => {
      patchActiveWorkspaceLayout((prev) =>
        assignLeafScrollTop(prev, leafId, scrollTop),
      );
    },
    [patchActiveWorkspaceLayout],
  );

  const normalizedLayout = useMemo(
    () => ensureFocusedLeafExists(layout),
    [layout],
  );

  const visibleLeafIdsState = useMemo(
    () =>
      normalizeVisiblePaneIds(
        visibleLeafIdsRaw,
        availableLeafIds,
        normalizedLayout.focusedLeafId,
        2,
      ),
    [visibleLeafIdsRaw, availableLeafIds, normalizedLayout.focusedLeafId],
  );

  const setVisibleLeafIds = useCallback(
    (ids: string[]) => {
      setVisibleLeafIdsRaw(
        normalizeVisiblePaneIds(ids, availableLeafIds, normalizedLayout.focusedLeafId, 2),
      );
    },
    [availableLeafIds, normalizedLayout.focusedLeafId],
  );

  const value = useMemo(
    () => ({
      layout: normalizedLayout,
      paneCount,
      maxPanes: MAX_WORKSPACE_PANES,
      focusedLeafId: normalizedLayout.focusedLeafId,
      setFocusedLeafId,
      expandLayout,
      closeLeaf,
      onLeafModelsChange,
      onLeafScrollChange,
      splitOrientation,
      visibleLeafIds: visibleLeafIdsState,
      setVisibleLeafIds,
      dragLeafId,
      setDragLeafId,
    }),
    [
      normalizedLayout,
      paneCount,
      setFocusedLeafId,
      expandLayout,
      closeLeaf,
      onLeafModelsChange,
      onLeafScrollChange,
      splitOrientation,
      visibleLeafIdsState,
      setVisibleLeafIds,
      dragLeafId,
    ],
  );

  return (
    <WorkspacePanesContext.Provider value={value}>
      {children}
    </WorkspacePanesContext.Provider>
  );
}

export function useWorkspacePanes() {
  const ctx = useContext(WorkspacePanesContext);
  if (!ctx) {
    throw new Error("useWorkspacePanes must be used within WorkspacePanesProvider");
  }
  return ctx;
}
