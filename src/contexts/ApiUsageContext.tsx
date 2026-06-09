import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyUsageDeltas,
  buildTokenLimitMessage,
  emptyApiUsageSnapshot,
  isAtTokenLimit,
  type ApiUsageSnapshot,
  type ModelUsageDelta,
} from "@/lib/token-usage";
import {
  currentUsagePeriodKey,
  formatUsagePeriodResetDate,
  loadUserUsageRecord,
  saveUserUsageRecord,
  userAccountKey,
} from "@/lib/user-usage-storage";
import type { UserPlan } from "@/types/user-plan";

interface ApiUsageContextValue {
  usage: ApiUsageSnapshot;
  plan: UserPlan | null;
  isSignedIn: boolean;
  isHydrated: boolean;
  isAtTokenLimit: boolean;
  tokenLimitMessage: string | null;
  signInRequiredMessage: string | null;
  usagePeriodResetLabel: string;
  addUsage: (deltas: ModelUsageDelta[]) => void;
}

const ApiUsageContext = createContext<ApiUsageContextValue | null>(null);

export function ApiUsageProvider({ children }: { children: ReactNode }) {
  const { session, isHydrated: authHydrated } = useAuth();
  const accountKey = session
    ? userAccountKey(session.provider, session.user.id)
    : null;

  const [usage, setUsage] = useState<ApiUsageSnapshot>(() =>
    emptyApiUsageSnapshot(),
  );
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [periodKey, setPeriodKey] = useState(currentUsagePeriodKey());
  const [isHydrated, setIsHydrated] = useState(false);
  const [prevAccountKey, setPrevAccountKey] = useState<string | null>(null);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;

    void (async () => {
      if (!accountKey) {
        if (!cancelled) {
          setUsage(emptyApiUsageSnapshot());
          setPlan(null);
          setPeriodKey(currentUsagePeriodKey());
          setIsHydrated(true);
        }
        return;
      }

      const record = await loadUserUsageRecord(accountKey);
      if (cancelled) return;
      setUsage(record.usage);
      setPlan(record.plan);
      setPeriodKey(record.periodKey);
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountKey, authHydrated]);

  if (accountKey !== prevAccountKey) {
    setPrevAccountKey(accountKey);
    if (!accountKey) {
      setUsage(emptyApiUsageSnapshot());
      setPlan(null);
      setPeriodKey(currentUsagePeriodKey());
    }
  }

  const persistRecord = useCallback(
    async (
      nextUsage: ApiUsageSnapshot,
      nextPlan: UserPlan,
      nextPeriodKey: string,
    ) => {
      if (!accountKey) return;
      const saved = await saveUserUsageRecord(accountKey, {
        plan: nextPlan,
        periodKey: nextPeriodKey,
        usage: nextUsage,
        updatedAt: Date.now(),
      });
      setPeriodKey(saved.periodKey);
    },
    [accountKey],
  );

  const addUsage = useCallback(
    (deltas: ModelUsageDelta[]) => {
      if (!accountKey || !plan || deltas.length === 0) return;

      setUsage((prev) => {
        if (isAtTokenLimit(plan, prev.totals.tokens)) return prev;
        const next = applyUsageDeltas(prev, deltas);
        void persistRecord(next, plan, periodKey);
        return next;
      });
    },
    [accountKey, plan, periodKey, persistRecord],
  );

  const usagePeriodResetLabel = formatUsagePeriodResetDate();
  const signedIn = accountKey != null && plan != null;
  const atLimit = signedIn && isAtTokenLimit(plan, usage.totals.tokens);
  const tokenLimitMessage = atLimit
    ? buildTokenLimitMessage(usagePeriodResetLabel)
    : null;
  const signInRequiredMessage =
    authHydrated && !signedIn
      ? "Sign in to send messages. Your monthly token allowance is tracked per account."
      : null;

  const value = useMemo(
    () => ({
      usage,
      plan,
      isSignedIn: signedIn,
      isHydrated: authHydrated && isHydrated,
      isAtTokenLimit: atLimit,
      tokenLimitMessage,
      signInRequiredMessage,
      usagePeriodResetLabel,
      addUsage,
    }),
    [
      usage,
      plan,
      signedIn,
      authHydrated,
      isHydrated,
      atLimit,
      tokenLimitMessage,
      signInRequiredMessage,
      usagePeriodResetLabel,
      addUsage,
    ],
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
