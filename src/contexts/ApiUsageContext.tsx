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
  emptyApiUsage,
  mergeApiUsage,
  type ApiUsageTotals,
} from "@/lib/token-usage";
import { loadApiUsage, saveApiUsage } from "@/lib/storage";

interface ApiUsageContextValue {
  usage: ApiUsageTotals;
  addUsage: (delta: ApiUsageTotals) => void;
  resetUsage: () => void;
}

const ApiUsageContext = createContext<ApiUsageContextValue | null>(null);

export function ApiUsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<ApiUsageTotals>(() => loadApiUsage());

  useEffect(() => {
    saveApiUsage(usage);
  }, [usage]);

  const addUsage = useCallback((delta: ApiUsageTotals) => {
    if (delta.tokens <= 0 && delta.costUsd <= 0) return;
    setUsage((prev) => mergeApiUsage(prev, delta));
  }, []);

  const resetUsage = useCallback(() => {
    setUsage(emptyApiUsage());
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
