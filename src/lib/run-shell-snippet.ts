import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";

export async function runShellSnippet(
  command: string,
  workingDir?: string | null,
): Promise<void> {
  if (!isTauri()) {
    throw new Error(
      "Run in terminal requires the Forge desktop app (npm run tauri:dev).",
    );
  }

  await invoke("open_terminal_run_command", {
    command: command.trim(),
    workingDir: workingDir?.trim() ? workingDir.trim() : null,
  });
}
