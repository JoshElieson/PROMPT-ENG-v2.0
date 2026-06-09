import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readRules, writeRules } from "@/lib/rule-storage";
import type { UserRule } from "@/types/rule";

interface RulesContextValue {
  rules: UserRule[];
  upsertRule: (rule: UserRule) => void;
  deleteRule: (id: string) => void;
  setRuleEnabled: (id: string, enabled: boolean) => void;
}

const RulesContext = createContext<RulesContextValue | null>(null);

export function RulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<UserRule[]>(() => readRules());

  useEffect(() => {
    writeRules(rules);
  }, [rules]);

  const upsertRule = useCallback((rule: UserRule) => {
    setRules((prev) => {
      const index = prev.findIndex((item) => item.id === rule.id);
      if (index === -1) return [rule, ...prev];
      const next = [...prev];
      next[index] = rule;
      return next;
    });
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setRuleEnabled = useCallback((id: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
  }, []);

  const value = useMemo(
    () => ({
      rules,
      upsertRule,
      deleteRule,
      setRuleEnabled,
    }),
    [rules, upsertRule, deleteRule, setRuleEnabled],
  );

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useRules(): RulesContextValue {
  const context = useContext(RulesContext);
  if (!context) {
    throw new Error("useRules must be used within RulesProvider");
  }
  return context;
}
