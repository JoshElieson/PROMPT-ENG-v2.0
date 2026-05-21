import { invoke } from "@tauri-apps/api/core";
import { getModelById } from "@/data/ai-models";
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

export async function aiChatComplete(
  modelId: string,
  messages: ChatTurn[],
  workspace?: AiWorkspacePayload | null,
  system?: string | null,
): Promise<string> {
  requireTauri();
  const systemPrompt = system?.trim();
  try {
    return await invoke<string>("ai_chat_complete", {
      modelId,
      messages,
      workspace:
        workspace && workspace.enabledPaths.length > 0 ? workspace : null,
      system: systemPrompt ? systemPrompt : null,
    });
  } catch (error) {
    throw new Error(
      formatInvokeError(error, "The model could not complete your message."),
    );
  }
}

export async function aiChatSynthesize(
  userMessage: string,
  modelResponses: ModelResponsePayload[],
  system?: string | null,
): Promise<string> {
  requireTauri();
  const systemPrompt = system?.trim();
  try {
    return await invoke<string>("ai_chat_synthesize", {
      userMessage,
      modelResponses: modelResponses.map((r) => ({
        modelId: r.modelId,
        modelName: r.modelName ?? getModelById(r.modelId)?.name,
        content: r.content,
      })),
      system: systemPrompt ? systemPrompt : null,
    });
  } catch (error) {
    throw new Error(
      formatInvokeError(error, "Could not synthesize Round Table responses."),
    );
  }
}
