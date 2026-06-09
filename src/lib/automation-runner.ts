import { aiChatComplete } from "@/lib/ai-chat";
import { automationDisplayName } from "@/lib/automation-match";
import { notifyAutomationComplete } from "@/lib/automation-notifications";
import {
  buildAutomationWorkspace,
  resolveChatForAutomation,
  type AutomationRunContext,
} from "@/lib/automation-workspace";
import { isTauri } from "@/lib/tauri";
import type { AutomationDraft } from "@/types/automation";
import type { Chat } from "@/types/chat";
import type { Project } from "@/types/project";

export const AUTOMATION_MODEL_ID = "gpt4o";

export async function runAutomationTask(
  automation: AutomationDraft,
  chats: Chat[],
  projects: Project[],
  context?: AutomationRunContext,
): Promise<boolean> {
  if (!automation.enabled || automation.task.trim().length === 0) return false;
  if (!isTauri()) return false;

  const chat = resolveChatForAutomation(chats, context);
  const workspace = buildAutomationWorkspace(chat, projects);
  const displayName = automationDisplayName(automation);
  const systemPrompt = [
    "You are running as an automated background task in FORGE.",
    `Automation: ${displayName}`,
    "Complete the requested task thoroughly and concisely.",
  ].join("\n");

  try {
    await aiChatComplete(
      AUTOMATION_MODEL_ID,
      [{ role: "user", content: automation.task.trim() }],
      workspace,
      systemPrompt,
      null,
      chat ? { chatId: chat.id } : null,
    );
    return true;
  } catch {
    return false;
  } finally {
    await notifyAutomationComplete(displayName);
  }
}
