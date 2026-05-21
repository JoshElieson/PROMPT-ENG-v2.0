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
import {
  clearPendingGitHubAuth,
  loadPendingGitHubAuth,
  savePendingGitHubAuth,
} from "@/lib/github-pending-auth";
import type { AuthSession, DeviceFlowPending } from "@/types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isHydrated: boolean;
  isConfigured: boolean;
  isLoggingIn: boolean;
  deviceFlow: DeviceFlowPending | null;
  pollAttempt: number;
  error: string | null;
  startGitHubLogin: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => void;
  clearError: () => void;
  resumePendingLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "GitHub sign-in failed. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowPending | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loginGenerationRef = useRef(0);
  const pollingDeviceCodeRef = useRef<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const refreshSession = useCallback(async () => {
    const stored = await loadAuthSession();
    if (stored) setSession(stored);
    return stored;
  }, []);

  const runPoll = useCallback(async (pending: DeviceFlowPending) => {
    if (!pending.deviceCode) {
      setError("Missing device code. Start sign-in again.");
      return;
    }

    if (pollingDeviceCodeRef.current === pending.deviceCode) {
      return;
    }

    pollingDeviceCodeRef.current = pending.deviceCode;
    const generation = loginGenerationRef.current;

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setIsLoggingIn(true);
    setDeviceFlow(pending);
    setError(null);
    setPollAttempt(0);

    try {
      const nextSession = await completeGitHubDeviceLogin(
        pending,
        controller.signal,
        (attempt) => {
          if (generation === loginGenerationRef.current) {
            setPollAttempt(attempt);
          }
        },
      );

      if (generation !== loginGenerationRef.current) return;
      if (controller.signal.aborted) return;

      clearPendingGitHubAuth();
      setSession(nextSession);
      setDeviceFlow(null);
      setError(null);
      pollingDeviceCodeRef.current = null;
      void saveAuthSession(nextSession);
    } catch (e) {
      if (generation !== loginGenerationRef.current) return;
      if (controller.signal.aborted) return;

      pollingDeviceCodeRef.current = null;
      const message = getErrorMessage(e);
      console.error("[auth] GitHub sign-in failed:", message);
      setError(message);
      setDeviceFlow(loadPendingGitHubAuth() ?? pending);
    } finally {
      if (pollAbortRef.current === controller) {
        pollAbortRef.current = null;
      }
      if (pollingDeviceCodeRef.current === pending.deviceCode) {
        pollingDeviceCodeRef.current = null;
      }
      if (generation === loginGenerationRef.current) {
        setIsLoggingIn(false);
      }
    }
  }, []);

  const resumePendingLogin = useCallback(async () => {
    if (session) return;

    const pending = loadPendingGitHubAuth() ?? deviceFlow;
    if (!pending?.deviceCode) {
      setError("No pending sign-in. Start sign-in again.");
      return;
    }

    pollingDeviceCodeRef.current = null;
    await runPoll(pending);
  }, [session, deviceFlow, runPoll]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadAuthSession();
      if (cancelled) return;
      if (stored) {
        setSession(stored);
        clearPendingGitHubAuth();
      } else {
        const pending = loadPendingGitHubAuth();
        if (pending) setDeviceFlow(pending);
      }
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deviceFlow?.deviceCode || session) return;
    queueMicrotask(() => void runPoll(deviceFlow));
  }, [deviceFlow, session, runPoll]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshSession]);

  const cancelLogin = useCallback(() => {
    loginGenerationRef.current += 1;
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    pollingDeviceCodeRef.current = null;
    clearPendingGitHubAuth();
    setIsLoggingIn(false);
    setDeviceFlow(null);
    setPollAttempt(0);
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

    loginGenerationRef.current += 1;
    const generation = loginGenerationRef.current;

    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    pollingDeviceCodeRef.current = null;
    clearPendingGitHubAuth();

    setError(null);
    setPollAttempt(0);
    setIsLoggingIn(true);
    setDeviceFlow(null);

    try {
      const pending = await startGitHubDeviceFlow();
      if (generation !== loginGenerationRef.current) return;

      savePendingGitHubAuth(pending);
      setDeviceFlow(pending);
    } catch (e) {
      setError(getErrorMessage(e));
      setDeviceFlow(null);
      setIsLoggingIn(false);
    }
  }, []);

  useEffect(() => () => pollAbortRef.current?.abort(), []);

  const value = useMemo(
    () => ({
      session,
      isHydrated,
      isConfigured: isGitHubAuthConfigured(),
      isLoggingIn,
      deviceFlow,
      pollAttempt,
      error,
      startGitHubLogin,
      cancelLogin,
      logout,
      clearError,
      resumePendingLogin,
    }),
    [
      session,
      isHydrated,
      isLoggingIn,
      deviceFlow,
      pollAttempt,
      error,
      startGitHubLogin,
      cancelLogin,
      logout,
      clearError,
      resumePendingLogin,
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
