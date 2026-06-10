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

import {

  APP_SETTINGS_STORAGE_KEY,

  DEFAULT_APP_SETTINGS,

  normalizeAppSettings,

  readAppSettings,

  writeAppSettings,

  type AppSettings,

  type AppTheme,

} from "@/lib/app-settings-storage";

import { isTauri } from "@/lib/tauri";

import { setSystemTrayVisible } from "@/lib/system-tray";

import { applyThemeToDocument } from "@/lib/theme";



export type { AppSettings, AppTheme };



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



const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);



function loadSettings(): AppSettings {

  return readAppSettings();

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

    if (value !== "light" && value !== "dark" && value !== "dark-blue") {

      return { ok: false, reason: "Theme must be light, dark, or dark-blue." };

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

    applyThemeToDocument(settings.theme);

  }, [settings.theme]);



  useEffect(() => {

    if (!isTauri()) return;

    void setSystemTrayVisible(settings.systemTrayIcon).catch(() => {});

  }, [settings.systemTrayIcon]);



  const isValidSettingKey = useCallback((key: string): key is keyof AppSettings => {

    return key in DEFAULT_APP_SETTINGS;

  }, []);



  const setSetting = useCallback(

    (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {

      setSettings((prev) => {

        const next = { ...prev, [key]: value };

        writeAppSettings(next);

        return next;

      });

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



export { APP_SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS, normalizeAppSettings };


