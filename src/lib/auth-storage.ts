import { load, type Store } from "@tauri-apps/plugin-store";
import type { AuthSession } from "@/types/auth";
import { normalizeStoredSession } from "@/lib/auth-session";
import { isTauri } from "@/lib/tauri";

const LOCAL_KEY = "prompt:auth:v1";
const STORE_FILE = "auth.v1.json";
const STORE_KEY = "session";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: false });
  return storePromise;
}

function readLocalSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return normalizeStoredSession(JSON.parse(raw));
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
      const fromStore = normalizeStoredSession(await store.get(STORE_KEY));
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
  const normalized = normalizeStoredSession(session);
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
