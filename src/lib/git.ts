import { invoke } from "@tauri-apps/api/core";
import type { GitCommandResult, GitStatusResult } from "@/types/git";
import { isTauri } from "@/lib/tauri";

function requireTauri(): void {
  if (!isTauri()) {
    throw new Error(
      "Git features require the desktop app. Run with: npm run tauri dev",
    );
  }
}

export async function gitStatus(path: string): Promise<GitStatusResult> {
  requireTauri();
  return invoke<GitStatusResult>("git_status", { path });
}

export async function gitPull(path: string): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_pull", { path });
}

export async function gitPush(path: string): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_push", { path });
}

export async function gitFetch(path: string): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_fetch", { path });
}

export async function gitInit(path: string): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_init", { path });
}

export async function gitClone(
  url: string,
  parentPath: string,
): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_clone", { url, parentPath });
}
