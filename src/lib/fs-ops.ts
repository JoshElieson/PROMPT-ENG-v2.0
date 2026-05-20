import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauri } from "@/lib/tauri";

export interface FindInFolderMatch {
  path: string;
  line: number;
  preview: string;
}

export async function createFsEntry(
  parentPath: string,
  name: string,
  isDirectory: boolean,
): Promise<string> {
  if (!isTauri()) throw new Error("File operations require the desktop app.");
  return invoke<string>("create_fs_entry", {
    parentPath,
    name,
    isDirectory,
  });
}

export async function renameFsEntry(
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (!isTauri()) throw new Error("File operations require the desktop app.");
  await invoke("rename_fs_entry", { fromPath, toPath });
}

export async function removeFsEntry(path: string): Promise<void> {
  if (!isTauri()) throw new Error("File operations require the desktop app.");
  await invoke("remove_fs_entry", { path });
}

export async function copyFsEntry(
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (!isTauri()) throw new Error("File operations require the desktop app.");
  await invoke("copy_fs_entry", { fromPath, toPath });
}

export async function moveFsEntry(
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (!isTauri()) throw new Error("File operations require the desktop app.");
  await invoke("move_fs_entry", { fromPath, toPath });
}

export async function findInDirectory(
  dirPath: string,
  query: string,
  maxResults = 50,
): Promise<FindInFolderMatch[]> {
  if (!isTauri()) throw new Error("Search requires the desktop app.");
  return invoke<FindInFolderMatch[]>("find_in_directory", {
    dirPath,
    query,
    maxResults,
  });
}

export async function relativePathFromRoot(
  rootPath: string,
  path: string,
): Promise<string> {
  if (!isTauri()) {
    return path;
  }
  return invoke<string>("relative_path_from_root", { rootPath, path });
}

export async function revealInFileExplorer(path: string): Promise<void> {
  if (!isTauri()) throw new Error("Reveal in explorer requires the desktop app.");
  await revealItemInDir(path);
}
