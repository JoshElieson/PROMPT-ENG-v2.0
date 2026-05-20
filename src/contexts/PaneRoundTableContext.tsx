import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { getModelById, type RoundTableModel } from "@/data/ai-models";
import {
  clampWeight,
  DEFAULT_ROUND_TABLE_WEIGHTS,
  weightForModel,
} from "@/lib/round-table-weights";
import type { PaneModelSession } from "@/types/workspace-pane";

function buildModelsFromWeights(
  activeIds: string[],
  weights: Record<string, number>,
): RoundTableModel[] {
  return activeIds
    .map((id) => {
      const model = getModelById(id);
      if (!model) return null;
      return { ...model, weight: weightForModel(weights, id) };
    })
    .filter((m): m is RoundTableModel => m != null);
}

export interface PaneRoundTableContextValue {
  selectedIds: string[];
  activeIds: string[];
  roundTableModels: RoundTableModel[];
  isSelected: (id: string) => boolean;
  isActive: (id: string) => boolean;
  toggleModel: (id: string) => void;
  deselectModels: (ids: string[]) => void;
  toggleActive: (id: string) => void;
  setModelWeight: (id: string, weight: number) => void;
}

export const PaneRoundTableContext =
  createContext<PaneRoundTableContextValue | null>(null);

interface PaneRoundTableProviderProps {
  session: PaneModelSession;
  onSessionChange: (next: PaneModelSession) => void;
  children: ReactNode;
}

function cloneSession(session: PaneModelSession): PaneModelSession {
  return {
    selectedIds: [...session.selectedIds],
    activeIds: [...session.activeIds],
    weights: { ...session.weights },
  };
}

export function PaneRoundTableProvider({
  session,
  onSessionChange,
  children,
}: PaneRoundTableProviderProps) {
  const { selectedIds, activeIds, weights } = session;

  const patch = useCallback(
    (next: PaneModelSession) => {
      onSessionChange(cloneSession(next));
    },
    [onSessionChange],
  );

  const toggleModel = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        patch({
          selectedIds: selectedIds.filter((x) => x !== id),
          activeIds: activeIds.filter((x) => x !== id),
          weights: { ...weights },
        });
        return;
      }

      const nextActive = activeIds.includes(id) ? activeIds : [...activeIds, id];
      const restored = weightForModel(weights, id);
      const nextWeights = {
        ...weights,
        [id]: restored > 0 ? restored : DEFAULT_ROUND_TABLE_WEIGHTS[id] ?? 100,
      };

      patch({
        selectedIds: [...selectedIds, id],
        activeIds: nextActive,
        weights: nextWeights,
      });
    },
    [selectedIds, activeIds, weights, patch],
  );

  const deselectModels = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const toRemove = ids.filter((id) => selectedIds.includes(id));
      if (toRemove.length === 0) return;
      patch({
        selectedIds: selectedIds.filter((id) => !toRemove.includes(id)),
        activeIds: activeIds.filter((id) => !toRemove.includes(id)),
        weights: { ...weights },
      });
    },
    [selectedIds, activeIds, weights, patch],
  );

  const toggleActive = useCallback(
    (id: string) => {
      if (!selectedIds.includes(id)) return;

      if (activeIds.includes(id)) {
        patch({
          selectedIds: [...selectedIds],
          activeIds: activeIds.filter((x) => x !== id),
          weights: { ...weights },
        });
        return;
      }

      const restored = weightForModel(weights, id);
      patch({
        selectedIds: [...selectedIds],
        activeIds: [...activeIds, id],
        weights: {
          ...weights,
          [id]: restored > 0 ? restored : DEFAULT_ROUND_TABLE_WEIGHTS[id] ?? 100,
        },
      });
    },
    [selectedIds, activeIds, weights, patch],
  );

  const setModelWeight = useCallback(
    (id: string, weight: number) => {
      const clamped = clampWeight(weight);
      const nextWeights = { ...weights, [id]: clamped };
      let nextActive = activeIds;
      if (clamped === 0) {
        nextActive = activeIds.filter((x) => x !== id);
      }
      patch({
        selectedIds: [...selectedIds],
        activeIds: nextActive,
        weights: nextWeights,
      });
    },
    [selectedIds, activeIds, weights, patch],
  );

  const roundTableModels = useMemo(
    () => buildModelsFromWeights(activeIds, weights),
    [activeIds, weights],
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const isActive = useCallback(
    (id: string) => activeIds.includes(id),
    [activeIds],
  );

  const value = useMemo(
    () => ({
      selectedIds,
      activeIds,
      roundTableModels,
      isSelected,
      isActive,
      toggleModel,
      deselectModels,
      toggleActive,
      setModelWeight,
    }),
    [
      selectedIds,
      activeIds,
      roundTableModels,
      isSelected,
      isActive,
      toggleModel,
      deselectModels,
      toggleActive,
      setModelWeight,
    ],
  );

  return (
    <PaneRoundTableContext.Provider value={value}>
      {children}
    </PaneRoundTableContext.Provider>
  );
}

export function usePaneRoundTable() {
  const ctx = useContext(PaneRoundTableContext);
  if (!ctx) {
    throw new Error("usePaneRoundTable must be used within PaneRoundTableProvider");
  }
  return ctx;
}
