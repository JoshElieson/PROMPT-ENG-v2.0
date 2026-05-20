import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

/** Start an OS-native drag of real file(s)/folder(s) (desktop, Explorer, other apps). */
export async function startNativeFileDrag(paths: string[]): Promise<void> {
  if (!isTauri() || paths.length === 0) return;
  await invoke("start_file_drag", { paths });
}
