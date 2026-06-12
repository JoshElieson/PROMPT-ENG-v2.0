import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FsEntry } from "@/types/project";
import { isTauri } from "@/lib/tauri";

export function basename(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || normalized;
}

export async function pickProjectDirectory(
  title = "Add project folder",
): Promise<string | null> {
  if (!isTauri()) {
    throw new Error(
      "Adding local folders requires the desktop app. Run with: npm run tauri dev",
    );
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });

  if (selected === null) return null;
  return Array.isArray(selected) ? selected[0] : selected;
}

export async function getUserHomeDir(): Promise<string> {
  if (!isTauri()) {
    throw new Error("Home directory requires the desktop app.");
  }
  return invoke<string>("get_user_home_dir");
}

export async function listDirectory(path: string): Promise<FsEntry[]> {
  if (!isTauri()) {
    return [];
  }

  return invoke<FsEntry[]>("list_directory", { path });
}