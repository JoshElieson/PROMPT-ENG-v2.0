import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@/lib/tauri";

export async function spawnTerminalSession(
  sessionId: string,
  cols: number,
  rows: number,
  cwd?: string | null,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("Terminal requires the Forge desktop app.");
  }
  await invoke("terminal_spawn", {
    id: sessionId,
    cwd: cwd?.trim() ? cwd.trim() : null,
    cols,
    rows,
  });
}

export async function writeTerminalSession(
  sessionId: string,
  data: string,
): Promise<void> {
  await invoke("terminal_write", { id: sessionId, data });
}

export async function resizeTerminalSession(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("terminal_resize", { id: sessionId, cols, rows });
}

export async function killTerminalSession(sessionId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("terminal_kill", { id: sessionId });
}

export async function listenTerminalOutput(
  onData: (sessionId: string, data: string) => void,
): Promise<UnlistenFn> {
  return listen<{ id: string; data: string }>("terminal-output", (event) => {
    onData(event.payload.id, event.payload.data);
  });
}
