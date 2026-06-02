import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/tauri";

export async function toggleWindowMaximize(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().toggleMaximize();
}

export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().close();
}
