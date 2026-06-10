import {
  readAppSettings,
  type AppTheme,
} from "@/lib/app-settings-storage";

export type ResolvedTheme = AppTheme;

export function resolveTheme(preference: AppTheme): ResolvedTheme {
  return preference;
}

export function applyThemeToDocument(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved !== "light");
}

export function initThemeFromStorage(): ResolvedTheme {
  const { theme } = readAppSettings();
  applyThemeToDocument(theme);
  return theme;
}
