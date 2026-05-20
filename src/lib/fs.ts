import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FsEntry } from "@/types/project";
import { isTauri } from "@/lib/tauri";

export function basename(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || normalized;
}

export async function pickProjectDirectory(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error(
      "Adding local folders requires the desktop app. Run with: npm run tauri dev",
    );
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Add project folder",
  });

  if (selected === null) return null;
  return Array.isArray(selected) ? selected[0] : selected;
}

export async function listDirectory(path: string): Promise<FsEntry[]> {
  if (!isTauri()) {
    return [];
  }

  return invoke<FsEntry[]>("list_directory", { path });
}

/** All paths under a directory (nested folders and files), excluding the root path. */
export async function listDescendantPaths(dirPath: string): Promise<string[]> {
  const entries = await listDirectory(dirPath);
  const paths: string[] = [];

  for (const entry of entries) {
    paths.push(entry.path);
    if (entry.isDirectory) {
      paths.push(...(await listDescendantPaths(entry.path)));
    }
  }

  return paths;
}
