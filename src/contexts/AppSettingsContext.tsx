import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getModelById } from "@/data/ai-models";

const STORAGE_KEY = "prompt:app-settings:v1";

export type AppTheme = "system" | "dark" | "light";

export interface AppSettings {
  defaultModel: string;
  theme: AppTheme;
  systemNotifications: boolean;
  warningNotifications: boolean;
  systemTrayIcon: boolean;
  completionSound: boolean;
  dataSharingEnabled: boolean;
}

export interface SettingChangeRequest {
  settingKey: string;
  value: unknown;
  source: "ai" | "user";
}

interface ApplySettingResult {
  ok: boolean;
  reason?: string;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  setSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void;
  applySettingChange: (request: SettingChangeRequest) => ApplySettingResult;
  isValidSettingKey: (key: string) => key is keyof AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: "openai/gpt-4o",
  theme: "dark",
  systemNotifications: true,
  warningNotifications: false,
  systemTrayIcon: true,
  completionSound: false,
  dataSharingEnabled: true,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const defaultModel =
    typeof raw.defaultModel === "string" && getModelById(raw.defaultModel)
      ? raw.defaultModel
      : DEFAULT_SETTINGS.defaultModel;
  const theme = raw.theme;
  const normalizedTheme: AppTheme =
    theme === "system" || theme === "dark" || theme === "light"
      ? theme
      : DEFAULT_SETTINGS.theme;
  return {
    defaultModel,
    theme: normalizedTheme,
    systemNotifications:
      typeof raw.systemNotifications === "boolean"
        ? raw.systemNotifications
        : DEFAULT_SETTINGS.systemNotifications,
    warningNotifications:
      typeof raw.warningNotifications === "boolean"
        ? raw.warningNotifications
        : DEFAULT_SETTINGS.warningNotifications,
    systemTrayIcon:
      typeof raw.systemTrayIcon === "boolean"
        ? raw.systemTrayIcon
        : DEFAULT_SETTINGS.systemTrayIcon,
    completionSound:
      typeof raw.completionSound === "boolean"
        ? raw.completionSound
        : DEFAULT_SETTINGS.completionSound,
    dataSharingEnabled:
      typeof raw.dataSharingEnabled === "boolean"
        ? raw.dataSharingEnabled
        : DEFAULT_SETTINGS.dataSharingEnabled,
  };
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function validateSettingValue(
  settingKey: keyof AppSettings,
  value: unknown,
): { ok: true; value: AppSettings[keyof AppSettings] } | { ok: false; reason: string } {
  if (settingKey === "defaultModel") {
    if (typeof value !== "string" || !getModelById(value)) {
      return { ok: false, reason: "Unknown model id." };
    }
    return { ok: true, value };
  }
  if (settingKey === "theme") {
    if (value !== "system" && value !== "dark" && value !== "light") {
      return { ok: false, reason: "Theme must be system, dark, or light." };
    }
    return { ok: true, value };
  }
  if (typeof value !== "boolean") {
    return { ok: false, reason: `${settingKey} must be a boolean.` };
  }
  return { ok: true, value };
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    if (settings.theme === "dark" || settings.theme === "system") {
      root.classList.add("dark");
      return;
    }
    root.classList.remove("dark");
  }, [settings.theme]);

  const isValidSettingKey = useCallback((key: string): key is keyof AppSettings => {
    return key in DEFAULT_SETTINGS;
  }, []);

  const setSetting = useCallback(
    (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applySettingChange = useCallback(
    (request: SettingChangeRequest): ApplySettingResult => {
      if (!isValidSettingKey(request.settingKey)) {
        return { ok: false, reason: `Unknown setting key: ${request.settingKey}` };
      }
      const validated = validateSettingValue(request.settingKey, request.value);
      if (!validated.ok) {
        return { ok: false, reason: validated.reason };
      }
      setSetting(request.settingKey, validated.value);
      return { ok: true };
    },
    [isValidSettingKey, setSetting],
  );

  const value = useMemo(
    () => ({ settings, setSetting, applySettingChange, isValidSettingKey }),
    [settings, setSetting, applySettingChange, isValidSettingKey],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}

