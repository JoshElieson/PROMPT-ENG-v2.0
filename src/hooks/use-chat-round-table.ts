import { useContext } from "react";
import { PaneRoundTableContext } from "@/contexts/PaneRoundTableContext";
import type { PaneRoundTableContextValue } from "@/contexts/PaneRoundTableContext";
import { useRoundTable } from "@/contexts/RoundTableContext";
/**
 * Prefer per-pane round table when inside a chat thread tab; otherwise use the
 * global Model Cart / Round Table from the app shell.
 */
export function useChatRoundTable(): PaneRoundTableContextValue {
  const pane = useContext(PaneRoundTableContext);
  const global = useRoundTable();
  if (pane) return pane;
  return {
    selectedIds: global.selectedIds,
    activeIds: global.activeIds,
    roundTableModels: global.roundTableModels,
    isSelected: global.isSelected,
    isActive: global.isActive,
    toggleModel: global.toggleModel,
    deselectModels: global.deselectModels,
    toggleActive: global.toggleActive,
    activateOnlyModel: global.activateOnlyModel,
    setModelWeight: global.setModelWeight,
    reorderSelectedIds: global.reorderSelectedIds,
  };
}
