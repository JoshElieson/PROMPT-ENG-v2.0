import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@/lib/tauri";

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
