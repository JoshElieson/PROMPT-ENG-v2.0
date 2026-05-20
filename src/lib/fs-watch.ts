import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";

export interface ProjectFsChangedEvent {
  rootPath: string;
  paths: string[];
}

export async function syncProjectFsWatchers(
  rootPaths: string[],
): Promise<void> {
  if (!isTauri()) return;
  await invoke("sync_project_fs_watchers", { rootPaths });
}

export async function listenProjectFsChanged(
  handler: (event: ProjectFsChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProjectFsChangedEvent>("project-fs-changed", (event) => {
    handler(event.payload);
  });
}
