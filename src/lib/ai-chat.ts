import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getModelById } from "@/data/ai-models";
import { buildForgeKnowledgePrompt } from "@/lib/forge-knowledge";
import { formatInvokeError } from "@/lib/git";
import { isTauri } from "@/lib/tauri";

import type { AiWorkspacePayload } from "@/types/chat";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelResponsePayload {
  modelId: string;
  modelName?: string;
  content: string;
}

export interface AiToolActivityEvent {
  streamId: string;
  action: "read" | "write";
  path: string;
  added?: number;
  removed?: number;
}

/** App model ids backed by configured providers in the Tauri layer. */
export const SUPPORTED_AI_MODEL_IDS = new Set([
  "gpt4o",
  "gpt4-turbo",
  "o1",
  "claude",
  "claude-opus",
  "gemini",
  "gemini-flash",
  "deepseek",
  "grok",
  "grok-fast",
  "grok-reasoning",
  "grok-multi",
  "grok-code",
]);

export function isAiModelSupported(modelId: string): boolean {
  return SUPPORTED_AI_MODEL_IDS.has(modelId) || modelId.startsWith("gemini");
}

function requireTauri(): void {
  if (!isTauri()) {
    throw new Error(
      "AI chat requires the desktop app. Run with: npm run tauri:dev",
    );
  }
}

function latestUserQuery(messages: ChatTurn[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const turn = messages[i];
    if (turn?.role === "user" && turn.content.trim()) {
      return turn.content.trim();
    }
  }
  return "";
}

export async function aiChatComplete(
  modelId: string,
  messages: ChatTurn[],
  workspace?: AiWorkspacePayload | null,
  system?: string | null,
  streamId?: string | null,
): Promise<string> {
  requireTauri();
  const baseSystemPrompt = system?.trim() ?? "";
  const knowledgePrompt = buildForgeKnowledgePrompt(latestUserQuery(messages)) ?? "";
  const systemPrompt = [baseSystemPrompt, knowledgePrompt]
    .filter((part) => part.trim().length > 0)
    .join("\n\n")
    .trim();
  try {
    return await invoke<string>("ai_chat_complete", {
      modelId,
      messages,
      workspace:
        workspace &&
        (workspace.enabledPaths.length > 0 || workspace.allowGit)
          ? workspace
          : null,
      system: systemPrompt.length > 0 ? systemPrompt : null,
      streamId: streamId?.trim() ? streamId.trim() : null,
    });
  } catch (error) {
    const wrapped = new Error(
      formatInvokeError(error, "The model could not complete your message."),
    );
    Object.assign(wrapped, { cause: error });
    throw wrapped;
  }
}

export async function listenAiToolActivity(
  handler: (event: AiToolActivityEvent) => void,
): Promise<UnlistenFn> {
  return listen<AiToolActivityEvent>("ai-tool-activity", (event) => {
    handler(event.payload);
  });
}

export async function aiChatSynthesize(
  userMessage: string,
  modelResponses: ModelResponsePayload[],
  system?: string | null,
): Promise<string> {
  requireTauri();
  const baseSystemPrompt = system?.trim() ?? "";
  const knowledgePrompt = buildForgeKnowledgePrompt(userMessage.trim()) ?? "";
  const systemPrompt = [baseSystemPrompt, knowledgePrompt]
    .filter((part) => part.trim().length > 0)
    .join("\n\n")
    .trim();
  try {
    return await invoke<string>("ai_chat_synthesize", {
      userMessage,
      modelResponses: modelResponses.map((r) => ({
        modelId: r.modelId,
        modelName: r.modelName ?? getModelById(r.modelId)?.name,
        content: r.content,
      })),
      system: systemPrompt.length > 0 ? systemPrompt : null,
    });
  } catch (error) {
    const wrapped = new Error(
      formatInvokeError(error, "Could not synthesize Round Table responses."),
    );
    Object.assign(wrapped, { cause: error });
    throw wrapped;
  }
}
