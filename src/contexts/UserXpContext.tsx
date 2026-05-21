import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  addAgentXp,
  clampProgress,
  getLevelFillRatio,
  getLevelFromProgress,
  getXpBarColor,
  loadUserProgress,
  XP_MAX_LEVEL,
} from "@/lib/user-xp";

interface UserXpContextValue {
  progress: number;
  level: number;
  levelFillRatio: number;
  barColor: string;
  isMaxLevel: boolean;
  awardNewAgent: () => void;
}

const UserXpContext = createContext<UserXpContextValue | null>(null);

export function UserXpProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const login = session?.user.login ?? null;
  const [progress, setProgress] = useState(() =>
    login ? loadUserProgress(login) : 0,
  );
  const [prevLogin, setPrevLogin] = useState(login);

  if (login !== prevLogin) {
    setPrevLogin(login);
    setProgress(login ? loadUserProgress(login) : 0);
  }

  const awardNewAgent = useCallback(() => {
    if (!login) return;
    setProgress(addAgentXp(login));
  }, [login]);

  const level = getLevelFromProgress(progress);
  const levelFillRatio = getLevelFillRatio(progress);
  const barColor = getXpBarColor(level);
  const isMaxLevel = level >= XP_MAX_LEVEL;

  const value = useMemo<UserXpContextValue>(
    () => ({
      progress: clampProgress(progress),
      level,
      levelFillRatio,
      barColor,
      isMaxLevel,
      awardNewAgent,
    }),
    [progress, level, levelFillRatio, barColor, isMaxLevel, awardNewAgent],
  );

  return (
    <UserXpContext.Provider value={value}>{children}</UserXpContext.Provider>
  );
}

export function useUserXp(): UserXpContextValue {
  const ctx = useContext(UserXpContext);
  if (!ctx) {
    throw new Error("useUserXp must be used within UserXpProvider");
  }
  return ctx;
}
