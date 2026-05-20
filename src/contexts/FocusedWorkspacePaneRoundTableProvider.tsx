import { useCallback, useMemo, type ReactNode } from "react";
import { useChats } from "@/contexts/ChatsContext";
import { PaneRoundTableProvider } from "@/contexts/PaneRoundTableContext";
import { assignLeafModels, findLeaf } from "@/lib/center-workspace-layout";
import type { PaneModelSession } from "@/types/workspace-pane";

/**
 * Mirrors the focused center workspace pane's model session for any UI outside
 * the pane tree (sidebars). Split panes still use their own nested
 * {@link PaneRoundTableProvider}, which wins for `useChatRoundTable` there.
 */
export function FocusedWorkspacePaneRoundTableProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { activeWorkspaceLayout, patchActiveWorkspaceLayout } = useChats();

  const focusedLeafId = activeWorkspaceLayout?.focusedLeafId ?? null;

  const session = useMemo(() => {
    if (!activeWorkspaceLayout || !focusedLeafId) return null;
    const leaf = findLeaf(activeWorkspaceLayout.root, focusedLeafId);
    return leaf?.models ?? null;
  }, [activeWorkspaceLayout, focusedLeafId]);

  const onSessionChange = useCallback(
    (next: PaneModelSession) => {
      if (!focusedLeafId) return;
      patchActiveWorkspaceLayout((prev) =>
        assignLeafModels(prev, focusedLeafId, next),
      );
    },
    [focusedLeafId, patchActiveWorkspaceLayout],
  );

  if (!session) {
    return children;
  }

  return (
    <PaneRoundTableProvider session={session} onSessionChange={onSessionChange}>
      {children}
    </PaneRoundTableProvider>
  );
}
