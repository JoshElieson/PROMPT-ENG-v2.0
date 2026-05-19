import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildRoundTableModels,
  DEFAULT_ROUND_TABLE_IDS,
  popularAiModels,
  type RoundTableModel,
} from "@/data/ai-models";

interface RoundTableContextValue {
  selectedIds: string[];
  activeIds: string[];
  roundTableModels: RoundTableModel[];
  isSelected: (id: string) => boolean;
  isActive: (id: string) => boolean;
  toggleModel: (id: string) => void;
  toggleActive: (id: string) => void;
}

const RoundTableContext = createContext<RoundTableContextValue | null>(null);

export function RoundTableProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    ...DEFAULT_ROUND_TABLE_IDS,
  ]);
  const [activeIds, setActiveIds] = useState<string[]>([
    ...DEFAULT_ROUND_TABLE_IDS,
  ]);

  const toggleModel = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        setActiveIds((active) => active.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      setActiveIds((active) => (active.includes(id) ? active : [...active, id]));
      return [...prev, id];
    });
  }, []);

  const toggleActive = useCallback((id: string) => {
    if (!selectedIds.includes(id)) return;

    setActiveIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, [selectedIds]);

  const roundTableModels = useMemo(
    () => buildRoundTableModels(activeIds),
    [activeIds],
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
      toggleActive,
    }),
    [
      selectedIds,
      activeIds,
      roundTableModels,
      isSelected,
      isActive,
      toggleModel,
      toggleActive,
    ],
  );

  return (
    <RoundTableContext.Provider value={value}>
      {children}
    </RoundTableContext.Provider>
  );
}

export function useRoundTable() {
  const ctx = useContext(RoundTableContext);
  if (!ctx) {
    throw new Error("useRoundTable must be used within RoundTableProvider");
  }
  return ctx;
}

export { popularAiModels };
