import type { AuthProvider, AuthSession, AuthUser } from "@/types/auth";

type StoredUser = AuthUser & { avatarUrl?: string };
type StoredSession = {
  accessToken?: string;
  access_token?: string;
  loginAt?: number;
  login_at?: number;
  provider?: AuthProvider;
  user?: StoredUser;
};

export function normalizeAuthUser(raw: unknown): AuthUser {
  if (!raw || typeof raw !== "object") {
    throw new Error("Could not load your profile.");
  }

  const data = raw as AuthUser & { avatarUrl?: string; sub?: string };
  const login =
    typeof data.login === "string" && data.login
      ? data.login
      : typeof data.email === "string" && data.email.includes("@")
        ? data.email.split("@")[0]
        : typeof data.sub === "string"
          ? data.sub
          : "";

  if (!login) {
    throw new Error("Could not load your profile.");
  }

  return {
    id: typeof data.id === "number" ? data.id : 0,
    login,
    name: data.name ?? null,
    avatar_url: data.avatar_url ?? data.avatarUrl ?? "",
    email: data.email ?? null,
  };
}

type RawAuthSession = AuthSession & {
  access_token?: string;
  login_at?: number;
};

export function normalizeAuthSession(raw: unknown): AuthSession {
  if (!raw || typeof raw !== "object") {
    throw new Error("Sign-in did not return a valid session.");
  }

  const data = raw as RawAuthSession;
  const accessToken = data.accessToken ?? data.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Sign-in did not return an access token.");
  }

  const provider: AuthProvider =
    data.provider === "google" || data.provider === "github"
      ? data.provider
      : "github";

  return {
    accessToken,
    loginAt: data.loginAt ?? data.login_at ?? Date.now(),
    provider,
    user: normalizeAuthUser(data.user),
  };
}

export function normalizeStoredSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as StoredSession;
  const accessToken = data.accessToken ?? data.access_token;
  const user = data.user;
  if (!accessToken || !user) return null;

  const login =
    user.login ??
    (typeof user.email === "string" && user.email.includes("@")
      ? user.email.split("@")[0]
      : "");
  if (!login) return null;

  const provider: AuthProvider =
    data.provider === "google" || data.provider === "github"
      ? data.provider
      : "github";

  return {
    accessToken,
    loginAt: typeof data.loginAt === "number" ? data.loginAt : Date.now(),
    provider,
    user: {
      id: user.id,
      login,
      name: user.name ?? null,
      avatar_url: user.avatar_url ?? user.avatarUrl ?? "",
      email: user.email ?? null,
    },
  };
}
