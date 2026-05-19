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
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import { isTauri } from "@/lib/tauri";
import type { AuthSession, DeviceFlowPending } from "@/types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isHydrated: boolean;
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
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowPending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loginGenerationRef = useRef(0);

  const refreshSession = useCallback(async () => {
    const stored = await loadAuthSession();
    if (stored) setSession(stored);
    return stored;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadAuthSession().then((stored) => {
      if (cancelled) return;
      if (stored) setSession(stored);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshSession]);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused && !disposed) void refreshSession();
      })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refreshSession]);

  const cancelLogin = useCallback(() => {
    loginGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoggingIn(false);
    setDeviceFlow(null);
  }, []);

  const logout = useCallback(() => {
    cancelLogin();
    void clearAuthSession();
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
    const generation = loginGenerationRef.current;
    setError(null);
    setIsLoggingIn(true);

    try {
      const pending = await startGitHubDeviceFlow();
      if (generation !== loginGenerationRef.current) return;

      setDeviceFlow(pending);

      const controller = new AbortController();
      abortRef.current = controller;

      const nextSession = await completeGitHubDeviceLogin(
        pending,
        controller.signal,
      );
      if (generation !== loginGenerationRef.current) return;

      setSession(nextSession);
      setDeviceFlow(null);
      void saveAuthSession(nextSession);
    } catch (e) {
      if (generation !== loginGenerationRef.current) return;

      if (e instanceof Error && e.message !== "Sign-in cancelled") {
        setError(e.message);
      }
      setDeviceFlow(null);
    } finally {
      if (generation === loginGenerationRef.current) {
        abortRef.current = null;
        setIsLoggingIn(false);
      }
    }
  }, [cancelLogin]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const value = useMemo(
    () => ({
      session,
      isHydrated,
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
      isHydrated,
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
