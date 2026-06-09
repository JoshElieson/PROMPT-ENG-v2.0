import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

export async function setSystemTrayVisible(visible: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_system_tray_visible", { visible });
}
