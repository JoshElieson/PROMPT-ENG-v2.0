import { load, type Store } from "@tauri-apps/plugin-store";
import type { AuthSession, GitHubUser } from "@/types/auth";
import { isTauri } from "@/lib/tauri";

const LOCAL_KEY = "prompt:auth:v1";
const STORE_FILE = "auth.v1.json";
const STORE_KEY = "session";

type StoredUser = GitHubUser & { avatarUrl?: string };
type StoredSession = {
  accessToken?: string;
  access_token?: string;
  loginAt?: number;
  user?: StoredUser;
};

function normalizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as StoredSession;
  const accessToken = data.accessToken ?? data.access_token;
  const user = data.user;
  if (!accessToken || !user?.login) return null;

  return {
    accessToken,
    loginAt: typeof data.loginAt === "number" ? data.loginAt : Date.now(),
    user: {
      id: user.id,
      login: user.login,
      name: user.name ?? null,
      avatar_url: user.avatar_url ?? user.avatarUrl ?? "",
      email: user.email ?? null,
    },
  };
}

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: false });
  return storePromise;
}

function readLocalSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalSession(session: AuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(LOCAL_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (isTauri()) {
    try {
      const store = await getStore();
      const fromStore = normalizeSession(await store.get(STORE_KEY));
      if (fromStore) {
        writeLocalSession(fromStore);
        return fromStore;
      }
    } catch {
      // fall through to localStorage
    }
  }

  const fromLocal = readLocalSession();
  if (fromLocal && isTauri()) {
    try {
      const store = await getStore();
      await store.set(STORE_KEY, fromLocal);
      await store.save();
    } catch {
      // ignore migration errors
    }
  }

  return fromLocal;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const normalized = normalizeSession(session);
  if (!normalized) {
    throw new Error("Could not save sign-in session.");
  }

  writeLocalSession(normalized);

  if (isTauri()) {
    try {
      const store = await getStore();
      await store.set(STORE_KEY, normalized);
      await store.save();
    } catch {
      // Disk store is optional; localStorage already has the session.
    }
  }
}

export async function clearAuthSession(): Promise<void> {
  writeLocalSession(null);

  if (isTauri()) {
    try {
      const store = await getStore();
      await store.delete(STORE_KEY);
      await store.save();
    } catch {
      // ignore
    }
  }
}
