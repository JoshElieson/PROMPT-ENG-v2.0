import { invoke } from "@tauri-apps/api/core";
import { readAppSettings } from "@/lib/app-settings-storage";
import { isTauri } from "@/lib/tauri";

export async function notifyAutomationComplete(
  automationName: string,
): Promise<void> {
  if (!isTauri()) return;
  if (!readAppSettings().automationNotifications) return;

  await invoke("show_automation_complete_notification", {
    automationName,
  });
}
