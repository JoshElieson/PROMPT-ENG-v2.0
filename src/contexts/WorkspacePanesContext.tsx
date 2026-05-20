import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useChats } from "@/contexts/ChatsContext";
import {
  assignLeafModels,
  assignLeafScrollTop,
  countPanes,
  ensureFocusedLeafExists,
} from "@/lib/center-workspace-layout";
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
}

const WorkspacePanesContext = createContext<WorkspacePanesContextValue | null>(
  null,
);

export function WorkspacePanesProvider({ children }: { children: ReactNode }) {
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

  const paneCount = useMemo(() => countPanes(layout.root), [layout.root]);

  const setFocusedLeafId = useCallback(
    (leafId: string) => {
      patchActiveWorkspaceLayout((prev) => ({ ...prev, focusedLeafId: leafId }));
    },
    [patchActiveWorkspaceLayout],
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

  const value = useMemo(
    () => ({
      layout: ensureFocusedLeafExists(layout),
      paneCount,
      maxPanes: MAX_WORKSPACE_PANES,
      focusedLeafId: layout.focusedLeafId,
      setFocusedLeafId,
      expandLayout,
      closeLeaf,
      onLeafModelsChange,
      onLeafScrollChange,
    }),
    [
      layout,
      paneCount,
      setFocusedLeafId,
      expandLayout,
      closeLeaf,
      onLeafModelsChange,
      onLeafScrollChange,
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
