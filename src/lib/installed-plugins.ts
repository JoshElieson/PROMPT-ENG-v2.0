import { useEffect, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_INSTALLED_DATABASE_PLUGIN_IDS,
  SUPABASE_PLUGIN_ID,
} from "@/data/database-plugins";
import { isTauri } from "@/lib/tauri";

export { SUPABASE_PLUGIN_ID };

export const PLUGINS_CHANGED_EVENT = "forge:plugins-changed";

const LOCAL_KEY = "prompt:installed-plugins:v1";
const STORE_FILE = "installed-plugins.v1.json";
const STORE_KEY = "ids";

let storePromise: Promise<Store> | null = null;
let initializePromise: Promise<Set<string>> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: false });
  return storePromise;
}

function defaultInstalledIds(): Set<string> {
  return new Set(DEFAULT_INSTALLED_DATABASE_PLUGIN_IDS);
}

function parseInstalledIds(raw: string | null): Set<string> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

async function syncToTauriStore(ids: Set<string>): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set(STORE_KEY, [...ids]);
    await store.save();
  } catch {
    // ignore
  }
}

function notifyPluginsChanged(ids: Set<string>): void {
  window.dispatchEvent(
    new CustomEvent(PLUGINS_CHANGED_EVENT, {
      detail: { ids: [...ids] },
    }),
  );
}

/** First launch: Supabase only. Persists to localStorage and the Tauri store. */
export async function initializeInstalledPlugins(): Promise<Set<string>> {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    const localRaw = localStorage.getItem(LOCAL_KEY);
    if (localRaw !== null) {
      return parseInstalledIds(localRaw) ?? new Set();
    }

    if (isTauri()) {
      try {
        const store = await getStore();
        const fromStore = await store.get<string[]>(STORE_KEY);
        if (Array.isArray(fromStore) && fromStore.length > 0) {
          const ids = new Set(
            fromStore.filter((id): id is string => typeof id === "string"),
          );
          writeInstalledPluginIds(ids, { notify: false });
          return ids;
        }
      } catch {
        // fall through to first-run defaults
      }
    }

    const defaults = defaultInstalledIds();
    writeInstalledPluginIds(defaults, { notify: false });
    return defaults;
  })();

  return initializePromise;
}

export function readInstalledPluginIds(): Set<string> {
  const fromStorage = parseInstalledIds(localStorage.getItem(LOCAL_KEY));
  if (fromStorage === null) {
    return defaultInstalledIds();
  }
  return fromStorage;
}

export function writeInstalledPluginIds(
  ids: Set<string>,
  options?: { notify?: boolean },
): void {
  const notify = options?.notify !== false;
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
  void syncToTauriStore(ids);
  if (notify) {
    notifyPluginsChanged(ids);
  }
}

export function isPluginInstalled(pluginId: string): boolean {
  return readInstalledPluginIds().has(pluginId);
}

export function installPlugin(pluginId: string): void {
  const ids = readInstalledPluginIds();
  if (ids.has(pluginId)) return;
  const next = new Set(ids);
  next.add(pluginId);
  writeInstalledPluginIds(next);
}

export function uninstallPlugin(pluginId: string): void {
  const ids = readInstalledPluginIds();
  if (!ids.has(pluginId)) return;
  const next = new Set(ids);
  next.delete(pluginId);
  writeInstalledPluginIds(next);
}

export function useInstalledPlugins(): Set<string> {
  const [ids, setIds] = useState(readInstalledPluginIds);

  useEffect(() => {
    let active = true;

    void initializeInstalledPlugins().then((initialized) => {
      if (active) {
        setIds(initialized);
      }
    });

    const onChanged = (event: Event) => {
      const custom = event as CustomEvent<{ ids?: string[] }>;
      const nextIds = custom.detail?.ids;
      if (Array.isArray(nextIds)) {
        setIds(new Set(nextIds));
        return;
      }
      setIds(readInstalledPluginIds());
    };

    window.addEventListener(PLUGINS_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(PLUGINS_CHANGED_EVENT, onChanged);
    };
  }, []);

  return ids;
}
