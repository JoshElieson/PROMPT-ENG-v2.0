import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getModelById } from "@/data/ai-models";
import { buildForgeKnowledgePrompt } from "@/lib/forge-knowledge";
import { prependActiveRulesPrompt } from "@/lib/user-rules-prompt";
import { formatInvokeError } from "@/lib/git";
import { isTauri } from "@/lib/tauri";

import type { AiWorkspacePayload } from "@/types/chat";
import type { RuleApplicationContext } from "@/types/rule";

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
  action: "read" | "write" | "status";
  path: string;
  added?: number;
  removed?: number;
}

/** App model ids backed by configured providers in the Tauri layer (legacy short ids). */
const SUPPORTED_AI_MODEL_IDS = new Set([
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

/** Legacy / provider-style ids mapped to app model ids. */
const MODEL_ID_ALIASES: Record<string, string> = {
  "openai/gpt-4o": "gpt-4o",
  "openai/gpt-4-turbo": "gpt-4-turbo",
  "openai/o1": "o1",
  "openai/gpt-5.4": "gpt-5.4",
  "openai/gpt-4.1": "gpt-4.1",
  "gpt-4o": "gpt-4o",
  "gpt-4-turbo": "gpt-4-turbo",
  "anthropic/claude": "claude",
  "anthropic/claude-opus": "claude-opus",
  "claude-3-5-sonnet": "claude",
  "claude-3-opus": "claude-opus",
  "google/gemini": "gemini",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "deepseek/deepseek-chat": "deepseek-chat",
  "deepseek/deepseek-v4-pro": "deepseek-v4-pro",
  "xai/grok": "grok",
  "xai/grok-4.3": "grok-4.3",
};

function modelIdIsWired(modelId: string): boolean {
  return (
    SUPPORTED_AI_MODEL_IDS.has(modelId) ||
    modelId.startsWith("gemini") ||
    modelId.startsWith("claude") ||
    modelId.startsWith("gpt-") ||
    modelId.startsWith("chatgpt-") ||
    modelId.startsWith("o1") ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4") ||
    modelId.startsWith("deepseek") ||
    modelId.startsWith("grok")
  );
}

/** Resolve a raw cart/active id to a wired app model id, or null if unsupported. */
function resolveModelId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const byCatalog = getModelById(trimmed);
  if (byCatalog && modelIdIsWired(byCatalog.id)) {
    return byCatalog.id;
  }

  const alias = MODEL_ID_ALIASES[trimmed.toLowerCase()];
  if (alias && modelIdIsWired(alias)) {
    return alias;
  }

  const lower = trimmed.toLowerCase();
  if (modelIdIsWired(lower)) {
    return lower;
  }

  return null;
}

export function isAiModelSupported(modelId: string): boolean {
  return resolveModelId(modelId) != null;
}

/** Normalize a list of model ids: trim, alias, drop duplicates and unsupported entries. */
export function normalizeTargetModelIds(modelIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of modelIds) {
    const id = resolveModelId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
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
  rulesContext?: RuleApplicationContext | null,
  agentContinuation?: string | null,
): Promise<string> {
  requireTauri();
  const resolvedModelId = resolveModelId(modelId);
  if (!resolvedModelId) {
    throw new Error(
      `Model "${modelId.trim()}" is not connected to a provider yet.`,
    );
  }
  const baseSystemPrompt = prependActiveRulesPrompt(system, rulesContext ?? undefined);
  const knowledgePrompt = buildForgeKnowledgePrompt(latestUserQuery(messages)) ?? "";
  const systemPrompt = [baseSystemPrompt, knowledgePrompt]
    .filter((part) => part.trim().length > 0)
    .join("\n\n")
    .trim();
  try {
    return await invoke<string>("ai_chat_complete", {
      modelId: resolvedModelId,
      messages,
      workspace:
        workspace &&
        (workspace.enabledPaths.length > 0 ||
          workspace.allowGit ||
          workspace.allowTerminalPane ||
          workspace.allowBrowserPane)
          ? workspace
          : null,
      system: systemPrompt.length > 0 ? systemPrompt : null,
      streamId: streamId?.trim() ? streamId.trim() : null,
      agentContinuation: agentContinuation?.trim() ? agentContinuation.trim() : null,
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
  rulesContext?: RuleApplicationContext | null,
): Promise<string> {
  requireTauri();
  const baseSystemPrompt = prependActiveRulesPrompt(system, rulesContext ?? undefined);
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
