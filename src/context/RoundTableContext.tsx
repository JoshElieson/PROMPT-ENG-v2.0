import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_ROUND_TABLE_IDS,
  getModelById,
  popularAiModels,
  type RoundTableModel,
} from "@/data/ai-models";
import {
  clampWeight,
  DEFAULT_ROUND_TABLE_WEIGHTS,
  weightForModel,
} from "@/lib/round-table-weights";

const WEIGHTS_STORAGE_KEY = "prompt:round-table-weights:v1";

function loadStoredWeights(): Record<string, number> {
  try {
    const raw = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredWeights(weights: Record<string, number>): void {
  localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
}

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

interface RoundTableContextValue {
  selectedIds: string[];
  activeIds: string[];
  roundTableModels: RoundTableModel[];
  isSelected: (id: string) => boolean;
  isActive: (id: string) => boolean;
  toggleModel: (id: string) => void;
  toggleActive: (id: string) => void;
  setModelWeight: (id: string, weight: number) => void;
}

const RoundTableContext = createContext<RoundTableContextValue | null>(null);

function initialWeights(): Record<string, number> {
  const stored = loadStoredWeights();
  const defaults: Record<string, number> = { ...DEFAULT_ROUND_TABLE_WEIGHTS };
  for (const id of DEFAULT_ROUND_TABLE_IDS) {
    if (defaults[id] == null) defaults[id] = 100;
  }
  return { ...defaults, ...stored };
}

export function RoundTableProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    ...DEFAULT_ROUND_TABLE_IDS,
  ]);
  const [activeIds, setActiveIds] = useState<string[]>([
    ...DEFAULT_ROUND_TABLE_IDS,
  ]);
  const [weights, setWeights] = useState<Record<string, number>>(initialWeights);

  useEffect(() => {
    const id = window.setTimeout(() => saveStoredWeights(weights), 400);
    return () => window.clearTimeout(id);
  }, [weights]);

  const toggleModel = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        setActiveIds((active) => active.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      setActiveIds((active) => {
        const next = active.includes(id) ? active : [...active, id];
        if (!active.includes(id)) {
          setWeights((w) => {
            const restored = weightForModel(w, id);
            return {
              ...w,
              [id]: restored > 0 ? restored : DEFAULT_ROUND_TABLE_WEIGHTS[id] ?? 100,
            };
          });
        }
        return next;
      });
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
      const next = [...prev, id];
      setWeights((w) => {
        const restored = weightForModel(w, id);
        return {
          ...w,
          [id]: restored > 0 ? restored : DEFAULT_ROUND_TABLE_WEIGHTS[id] ?? 100,
        };
      });
      return next;
    });
  }, [selectedIds]);

  const setModelWeight = useCallback((id: string, weight: number) => {
    const clamped = clampWeight(weight);
    setWeights((prev) => ({
      ...prev,
      [id]: clamped,
    }));

    if (clamped === 0) {
      setActiveIds((prev) => {
        if (!prev.includes(id) || prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      });
    }
  }, []);

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
      toggleActive,
      setModelWeight,
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
