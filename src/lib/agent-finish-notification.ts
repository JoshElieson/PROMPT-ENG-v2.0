import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/tauri";

export interface AgentFinishNotificationParams {
  workspaceName: string;
  agentName: string;
}

export async function notifyAgentFinishedWhenBackgrounded(
  params: AgentFinishNotificationParams,
): Promise<void> {
  if (!isTauri()) return;

  const appWindow = getCurrentWindow();
  const [isMinimized, isFocused] = await Promise.all([
    appWindow.isMinimized(),
    appWindow.isFocused(),
  ]);
  if (!isMinimized && isFocused) return;

  await invoke("show_agent_finish_notification", {
    workspace: params.workspaceName,
    agent: params.agentName,
  });
}
