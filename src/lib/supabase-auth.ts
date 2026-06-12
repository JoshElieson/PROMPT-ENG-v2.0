import { load, type Store } from "@tauri-apps/plugin-store";
import { isTauri } from "@/lib/tauri";

export interface SupabaseConfig {
  personalAccessToken: string | null;
  projectRef: string | null;
  projectUrl: string | null;
  anonKey: string | null;
  dbPassword?: string | null;
}

const LOCAL_KEY = "prompt:supabase:v1";
const STORE_FILE = "supabase.v1.json";
const STORE_KEY = "config";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: false });
  return storePromise;
}

export async function loadSupabaseConfig(): Promise<SupabaseConfig> {
  const defaultConfig: SupabaseConfig = {
    personalAccessToken: null,
    projectRef: null,
    projectUrl: null,
    anonKey: null,
  };

  if (isTauri()) {
    try {
      const store = await getStore();
      const fromStore = await store.get<SupabaseConfig>(STORE_KEY);
      if (fromStore) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(fromStore));
        return fromStore;
      }
    } catch {
      // fallback
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export async function saveSupabaseConfig(config: SupabaseConfig): Promise<void> {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config));

  if (isTauri()) {
    try {
      const store = await getStore();
      await store.set(STORE_KEY, config);
      await store.save();
    } catch {
      // ignore
    }
  }
}

export async function clearSupabaseConfig(): Promise<void> {
  localStorage.removeItem(LOCAL_KEY);

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



