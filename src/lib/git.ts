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

/** Tauri invoke errors are often plain strings, not Error instances. */
export function formatInvokeError(error: unknown, fallback: string): string {
  if (typeof error === "string") return error.trim() || fallback;
  if (error instanceof Error) return error.message.trim() || fallback;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    return message || fallback;
  }
  return fallback;
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

export async function gitCommit(
  path: string,
  message: string,
  stageAll = false,
): Promise<GitCommandResult> {
  requireTauri();
  return invoke<GitCommandResult>("git_commit", { path, message, stageAll });
}
