import { getModelById } from "@/data/ai-models";
import { normalizeTargetModelIds } from "@/lib/ai-chat";

export const APP_SETTINGS_STORAGE_KEY = "prompt:app-settings:v1";
export const THEME_LEGACY_MIGRATION_KEY = "prompt:theme-legacy-migrated:v1";

export type AppTheme = "light" | "dark" | "dark-blue";

export interface AppSettings {
  defaultModel: string;
  theme: AppTheme;
  systemNotifications: boolean;
  automationNotifications: boolean;
  warningNotifications: boolean;
  systemTrayIcon: boolean;
  completionSound: boolean;
  dataSharingEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultModel: "gpt4o",
  theme: "dark-blue",
  systemNotifications: true,
  automationNotifications: true,
  warningNotifications: false,
  systemTrayIcon: true,
  completionSound: false,
  dataSharingEnabled: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTheme(raw: unknown): AppTheme {
  if (raw === "light" || raw === "dark" || raw === "dark-blue") {
    return raw;
  }
  if (raw === "system") {
    return "dark-blue";
  }
  return DEFAULT_APP_SETTINGS.theme;
}

function applyLegacyThemeMigration(settings: AppSettings): AppSettings {
  try {
    if (localStorage.getItem(THEME_LEGACY_MIGRATION_KEY)) {
      return settings;
    }
    localStorage.setItem(THEME_LEGACY_MIGRATION_KEY, "1");
    if (settings.theme !== "dark") {
      return settings;
    }
    const migrated = { ...settings, theme: "dark-blue" as AppTheme };
    writeAppSettings(migrated);
    return migrated;
  } catch {
    return settings;
  }
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_APP_SETTINGS;
  const defaultModel =
    typeof raw.defaultModel === "string"
      ? (getModelById(raw.defaultModel)?.id ??
        normalizeTargetModelIds([raw.defaultModel])[0] ??
        DEFAULT_APP_SETTINGS.defaultModel)
      : DEFAULT_APP_SETTINGS.defaultModel;
  const normalizedTheme = normalizeTheme(raw.theme);
  return {
    defaultModel,
    theme: normalizedTheme,
    systemNotifications:
      typeof raw.systemNotifications === "boolean"
        ? raw.systemNotifications
        : DEFAULT_APP_SETTINGS.systemNotifications,
    automationNotifications:
      typeof raw.automationNotifications === "boolean"
        ? raw.automationNotifications
        : DEFAULT_APP_SETTINGS.automationNotifications,
    warningNotifications:
      typeof raw.warningNotifications === "boolean"
        ? raw.warningNotifications
        : DEFAULT_APP_SETTINGS.warningNotifications,
    systemTrayIcon:
      typeof raw.systemTrayIcon === "boolean"
        ? raw.systemTrayIcon
        : DEFAULT_APP_SETTINGS.systemTrayIcon,
    completionSound:
      typeof raw.completionSound === "boolean"
        ? raw.completionSound
        : DEFAULT_APP_SETTINGS.completionSound,
    dataSharingEnabled:
      typeof raw.dataSharingEnabled === "boolean"
        ? raw.dataSharingEnabled
        : DEFAULT_APP_SETTINGS.dataSharingEnabled,
  };
}

export function readAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const settings = normalizeAppSettings(JSON.parse(raw));
    return applyLegacyThemeMigration(settings);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function writeAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode errors
  }
}
