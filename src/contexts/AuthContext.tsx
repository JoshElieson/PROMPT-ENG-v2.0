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
  completeGoogleLogin,
  isGoogleAuthConfigured,
  startGoogleOAuthBrowser,
} from "@/lib/google-auth";
import {
  clearPendingGitHubAuth,
  loadPendingGitHubAuth,
  savePendingGitHubAuth,
} from "@/lib/github-pending-auth";
import { isTauri } from "@/lib/tauri";
import type { AuthProvider, AuthSession, DeviceFlowPending } from "@/types/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isHydrated: boolean;
  isGitHubConfigured: boolean;
  isGoogleConfigured: boolean;
  isLoggingIn: boolean;
  loginProvider: AuthProvider | null;
  deviceFlow: DeviceFlowPending | null;
  pollAttempt: number;
  error: string | null;
  startGitHubLogin: () => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  cancelLogin: () => void;
  logout: () => void;
  clearError: () => void;
  resumePendingLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginProvider, setLoginProvider] = useState<AuthProvider | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowPending | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loginGenerationRef = useRef(0);
  const pollingDeviceCodeRef = useRef<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const googleAbortRef = useRef<AbortController | null>(null);

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
    setLoginProvider("github");
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
      setLoginProvider(null);
      setError(null);
      pollingDeviceCodeRef.current = null;
      void saveAuthSession(nextSession);
    } catch (e) {
      if (generation !== loginGenerationRef.current) return;
      if (controller.signal.aborted) return;

      pollingDeviceCodeRef.current = null;
      const message = getErrorMessage(e, "GitHub sign-in failed. Please try again.");
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
        if (pending) {
          setDeviceFlow(pending);
          setLoginProvider("github");
        }
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
    googleAbortRef.current?.abort();
    googleAbortRef.current = null;
    pollingDeviceCodeRef.current = null;
    clearPendingGitHubAuth();
    setIsLoggingIn(false);
    setLoginProvider(null);
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
    googleAbortRef.current?.abort();
    googleAbortRef.current = null;
    pollingDeviceCodeRef.current = null;
    clearPendingGitHubAuth();

    setError(null);
    setPollAttempt(0);
    setIsLoggingIn(true);
    setLoginProvider("github");
    setDeviceFlow(null);

    try {
      const pending = await startGitHubDeviceFlow();
      if (generation !== loginGenerationRef.current) return;

      savePendingGitHubAuth(pending);
      setDeviceFlow(pending);
    } catch (e) {
      setError(getErrorMessage(e, "GitHub sign-in failed. Please try again."));
      setDeviceFlow(null);
      setIsLoggingIn(false);
      setLoginProvider(null);
    }
  }, []);

  const startGoogleLogin = useCallback(async () => {
    if (!isGoogleAuthConfigured()) {
      setError(
        "Add VITE_GOOGLE_CLIENT_ID to .env (Google OAuth desktop client). See GOOGLE_SETUP.md.",
      );
      return;
    }

    if (!isTauri()) {
      setError(null);
      try {
        await startGoogleOAuthBrowser();
      } catch (e) {
        setError(getErrorMessage(e, "Google sign-in failed. Please try again."));
      }
      return;
    }

    loginGenerationRef.current += 1;
    const generation = loginGenerationRef.current;

    pollAbortRef.current?.abort();
    googleAbortRef.current?.abort();
    const controller = new AbortController();
    googleAbortRef.current = controller;

    setError(null);
    setIsLoggingIn(true);
    setLoginProvider("google");
    setDeviceFlow(null);

    try {
      const nextSession = await completeGoogleLogin(controller.signal);
      if (generation !== loginGenerationRef.current) return;
      if (controller.signal.aborted) return;

      setSession(nextSession);
      setLoginProvider(null);
      setError(null);
      void saveAuthSession(nextSession);
    } catch (e) {
      if (generation !== loginGenerationRef.current) return;
      if (controller.signal.aborted) return;
      setError(getErrorMessage(e, "Google sign-in failed. Please try again."));
    } finally {
      if (googleAbortRef.current === controller) {
        googleAbortRef.current = null;
      }
      if (generation === loginGenerationRef.current) {
        setIsLoggingIn(false);
        setLoginProvider(null);
      }
    }
  }, []);

  useEffect(() => () => pollAbortRef.current?.abort(), []);
  useEffect(() => () => googleAbortRef.current?.abort(), []);

  const value = useMemo(
    () => ({
      session,
      isHydrated,
      isGitHubConfigured: isGitHubAuthConfigured(),
      isGoogleConfigured: isGoogleAuthConfigured(),
      isLoggingIn,
      loginProvider,
      deviceFlow,
      pollAttempt,
      error,
      startGitHubLogin,
      startGoogleLogin,
      cancelLogin,
      logout,
      clearError,
      resumePendingLogin,
    }),
    [
      session,
      isHydrated,
      isLoggingIn,
      loginProvider,
      deviceFlow,
      pollAttempt,
      error,
      startGitHubLogin,
      startGoogleLogin,
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
