import { aiChatComplete } from "@/lib/ai-chat";
import {
  FORGE_AGENT_CONTEXT,
  FORGE_ENGINEERING_GUIDANCE,
} from "@/lib/agent-system-guidance";
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
    FORGE_AGENT_CONTEXT,
    FORGE_ENGINEERING_GUIDANCE,
    "Complete the requested task thoroughly and autonomously using available file and git tools.",
    "Do not ask questions or request confirmation—the automation owner already approved this run.",
    "Investigate the codebase as needed, apply changes directly, and finish the work in one pass.",
  ].join("\n\n");

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
