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
  applyUsageDeltas,
  emptyApiUsageSnapshot,
  type ApiUsageSnapshot,
  type ModelUsageDelta,
} from "@/lib/token-usage";
import { loadApiUsage, saveApiUsage } from "@/lib/storage";

interface ApiUsageContextValue {
  usage: ApiUsageSnapshot;
  addUsage: (deltas: ModelUsageDelta[]) => void;
  resetUsage: () => void;
}

const ApiUsageContext = createContext<ApiUsageContextValue | null>(null);

export function ApiUsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<ApiUsageSnapshot>(() => loadApiUsage());

  useEffect(() => {
    saveApiUsage(usage);
  }, [usage]);

  const addUsage = useCallback((deltas: ModelUsageDelta[]) => {
    if (deltas.length === 0) return;
    setUsage((prev) => applyUsageDeltas(prev, deltas));
  }, []);

  const resetUsage = useCallback(() => {
    setUsage(emptyApiUsageSnapshot());
  }, []);

  const value = useMemo(
    () => ({ usage, addUsage, resetUsage }),
    [usage, addUsage, resetUsage],
  );

  return (
    <ApiUsageContext.Provider value={value}>{children}</ApiUsageContext.Provider>
  );
}

export function useApiUsage() {
  const ctx = useContext(ApiUsageContext);
  if (!ctx) {
    throw new Error("useApiUsage must be used within ApiUsageProvider");
  }
  return ctx;
}
