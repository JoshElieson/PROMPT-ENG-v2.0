import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readAppSettings } from "@/lib/app-settings-storage";
import { isTauri } from "@/lib/tauri";

export type AgentNotificationKind = "complete" | "attention";

export interface AgentFinishNotificationParams {
  workspaceName: string;
  agentName: string;
  kind?: AgentNotificationKind;
}

async function isAppBackgrounded(): Promise<boolean> {
  const appWindow = getCurrentWindow();
  const [isMinimized, isFocused] = await Promise.all([
    appWindow.isMinimized(),
    appWindow.isFocused(),
  ]);
  return isMinimized || !isFocused;
}

export async function notifyAgentWhenBackgrounded(
  params: AgentFinishNotificationParams,
): Promise<void> {
  if (!isTauri()) return;
  if (!readAppSettings().systemNotifications) return;
  if (!(await isAppBackgrounded())) return;

  await invoke("show_agent_finish_notification", {
    workspace: params.workspaceName,
    agent: params.agentName,
    attention: params.kind === "attention",
  });
}

export async function notifyAgentFinishedWhenBackgrounded(
  params: Omit<AgentFinishNotificationParams, "kind">,
): Promise<void> {
  await notifyAgentWhenBackgrounded({ ...params, kind: "complete" });
}

export async function notifyAgentNeedsAttentionWhenBackgrounded(
  params: Omit<AgentFinishNotificationParams, "kind">,
): Promise<void> {
  await notifyAgentWhenBackgrounded({ ...params, kind: "attention" });
}
