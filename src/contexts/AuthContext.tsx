import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from "@/lib/auth-storage";
import {
  completeGitHubDeviceLogin,
  isGitHubAuthConfigured,
  startGitHubDeviceFlow,
} from "@/lib/github-auth";
import type { AuthSession, DeviceFlowPending } from "@/types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isConfigured: boolean;
  isLoggingIn: boolean;
  deviceFlow: DeviceFlowPending | null;
  error: string | null;
  startGitHubLogin: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadAuthSession(),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowPending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelLogin = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoggingIn(false);
    setDeviceFlow(null);
  }, []);

  const logout = useCallback(() => {
    cancelLogin();
    clearAuthSession();
    setSession(null);
    setError(null);
  }, [cancelLogin]);

  const clearError = useCallback(() => setError(null), []);

  const startGitHubLogin = useCallback(async () => {
    if (!isGitHubAuthConfigured()) {
      setError(
        "Add VITE_GITHUB_CLIENT_ID to .env (GitHub OAuth app with Device Flow enabled).",
      );
      return;
    }

    cancelLogin();
    setError(null);
    setIsLoggingIn(true);

    try {
      const pending = await startGitHubDeviceFlow();
      setDeviceFlow(pending);

      const controller = new AbortController();
      abortRef.current = controller;

      const nextSession = await completeGitHubDeviceLogin(
        pending,
        controller.signal,
      );

      saveAuthSession(nextSession);
      setSession(nextSession);
      setDeviceFlow(null);
    } catch (e) {
      if (e instanceof Error && e.message !== "Sign-in cancelled") {
        setError(e.message);
      }
      setDeviceFlow(null);
    } finally {
      abortRef.current = null;
      setIsLoggingIn(false);
    }
  }, [cancelLogin]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const value = useMemo(
    () => ({
      session,
      isConfigured: isGitHubAuthConfigured(),
      isLoggingIn,
      deviceFlow,
      error,
      startGitHubLogin,
      cancelLogin,
      logout,
      clearError,
    }),
    [
      session,
      isLoggingIn,
      deviceFlow,
      error,
      startGitHubLogin,
      cancelLogin,
      logout,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
