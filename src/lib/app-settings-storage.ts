import { getModelById } from "@/data/ai-models";
import { normalizeTargetModelIds } from "@/lib/ai-chat";

export const APP_SETTINGS_STORAGE_KEY = "prompt:app-settings:v1";

export type AppTheme = "system" | "dark" | "light";

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
  theme: "dark",
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

export function normalizeAppSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_APP_SETTINGS;
  const defaultModel =
    typeof raw.defaultModel === "string"
      ? (getModelById(raw.defaultModel)?.id ??
        normalizeTargetModelIds([raw.defaultModel])[0] ??
        DEFAULT_APP_SETTINGS.defaultModel)
      : DEFAULT_APP_SETTINGS.defaultModel;
  const theme = raw.theme;
  const normalizedTheme: AppTheme =
    theme === "system" || theme === "dark" || theme === "light"
      ? theme
      : DEFAULT_APP_SETTINGS.theme;
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
    return normalizeAppSettings(JSON.parse(raw));
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
