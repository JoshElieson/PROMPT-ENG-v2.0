import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "prompt:model-mode:v1";

type StoredModelMode = {
  autoEnabled?: boolean;
  deeperEnabled?: boolean;
};

function loadStoredMode(): StoredModelMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredModelMode;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredMode(mode: StoredModelMode): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mode));
}

interface ModelModeContextValue {
  autoEnabled: boolean;
  deeperEnabled: boolean;
  setAutoEnabled: (enabled: boolean) => void;
  setDeeperEnabled: (enabled: boolean) => void;
  /** Models picked on the last auto send (for UI hints). */
  lastAutoPickedIds: string[];
  setLastAutoPickedIds: (ids: string[]) => void;
}

const ModelModeContext = createContext<ModelModeContextValue | null>(null);

export function ModelModeProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredMode();
  const [autoEnabled, setAutoEnabledState] = useState(
    stored.autoEnabled ?? true,
  );
  const [deeperEnabled, setDeeperEnabledState] = useState(
    stored.deeperEnabled ?? false,
  );
  const [lastAutoPickedIds, setLastAutoPickedIds] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setTimeout(
      () =>
        saveStoredMode({
          autoEnabled,
          deeperEnabled,
        }),
      300,
    );
    return () => window.clearTimeout(id);
  }, [autoEnabled, deeperEnabled]);

  const setAutoEnabled = useCallback((enabled: boolean) => {
    setAutoEnabledState(enabled);
    if (!enabled) setLastAutoPickedIds([]);
  }, []);

  const setDeeperEnabled = useCallback((enabled: boolean) => {
    setDeeperEnabledState(enabled);
  }, []);

  const value = useMemo(
    () => ({
      autoEnabled,
      deeperEnabled,
      setAutoEnabled,
      setDeeperEnabled,
      lastAutoPickedIds,
      setLastAutoPickedIds,
    }),
    [
      autoEnabled,
      deeperEnabled,
      setAutoEnabled,
      setDeeperEnabled,
      lastAutoPickedIds,
    ],
  );

  return (
    <ModelModeContext.Provider value={value}>
      {children}
    </ModelModeContext.Provider>
  );
}

export function useModelMode() {
  const ctx = useContext(ModelModeContext);
  if (!ctx) {
    throw new Error("useModelMode must be used within ModelModeProvider");
  }
  return ctx;
}
