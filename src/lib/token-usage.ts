import { isAiModelSupported } from "@/lib/ai-chat";
import type { ChatTurn } from "@/lib/ai-chat";

/** Approximate USD per 1M tokens (input / output). Used for estimates only. */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  gpt4o: { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt4-turbo": { inputPerMillion: 10, outputPerMillion: 30 },
  o1: { inputPerMillion: 15, outputPerMillion: 60 },
  claude: { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus": { inputPerMillion: 15, outputPerMillion: 75 },
  gemini: { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
};

const CHARS_PER_TOKEN = 4;
const CHAT_SYSTEM_OVERHEAD = 120;
const WORKSPACE_SYSTEM_OVERHEAD = 900;

export interface ApiUsageTotals {
  tokens: number;
  costUsd: number;
}

export function emptyApiUsage(): ApiUsageTotals {
  return { tokens: 0, costUsd: 0 };
}

export function estimateTextTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / CHARS_PER_TOKEN));
}

export function estimateTurnsTokens(turns: ChatTurn[]): number {
  return turns.reduce((sum, turn) => sum + estimateTextTokens(turn.content), 0);
}

function pricingForModel(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

export function costForTokens(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = pricingForModel(modelId);
  return (
    (inputTokens / 1_000_000) * p.inputPerMillion +
    (outputTokens / 1_000_000) * p.outputPerMillion
  );
}

export function usageDelta(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): ApiUsageTotals {
  const tokens = inputTokens + outputTokens;
  return {
    tokens,
    costUsd: costForTokens(modelId, inputTokens, outputTokens),
  };
}

export function mergeApiUsage(
  current: ApiUsageTotals,
  delta: ApiUsageTotals,
): ApiUsageTotals {
  return {
    tokens: current.tokens + delta.tokens,
    costUsd: current.costUsd + delta.costUsd,
  };
}

/** Mirrors Tauri `default_synthesis_provider` preference order. */
export function defaultSynthesisModelId(): string {
  return "gpt4o";
}

export function estimatePerModelInputTokens(
  history: ChatTurn[],
  userContent: string,
  workspaceEnabled: boolean,
): number {
  const historyTokens = estimateTurnsTokens(history);
  const userTokens = estimateTextTokens(userContent);
  const system =
    CHAT_SYSTEM_OVERHEAD +
    (workspaceEnabled ? WORKSPACE_SYSTEM_OVERHEAD : 0);
  return historyTokens + userTokens + system;
}

export function estimateSynthesisInputTokens(
  userContent: string,
  modelOutputs: string[],
): number {
  const body = modelOutputs.join("\n");
  return (
    estimateTextTokens(userContent) +
    estimateTextTokens(body) +
    CHAT_SYSTEM_OVERHEAD +
    80
  );
}

export function recordSendEstimates(
  history: ChatTurn[],
  userContent: string,
  targetModelIds: string[],
  workspaceEnabled: boolean,
): ApiUsageTotals {
  const models = targetModelIds.filter(isAiModelSupported);
  if (models.length === 0) return emptyApiUsage();

  const inputPerCall = estimatePerModelInputTokens(
    history,
    userContent,
    workspaceEnabled,
  );

  let total = emptyApiUsage();
  for (const modelId of models) {
    total = mergeApiUsage(total, usageDelta(modelId, inputPerCall, 0));
  }
  return total;
}

export function recordResponseEstimates(
  targetModelIds: string[],
  userContent: string,
  outputs: { modelId: string; content: string }[],
  synthesizedContent: string | null,
): ApiUsageTotals {
  const models = targetModelIds.filter(isAiModelSupported);
  if (models.length === 0) return emptyApiUsage();

  let total = emptyApiUsage();

  if (models.length === 1) {
    const out = estimateTextTokens(synthesizedContent ?? outputs[0]?.content ?? "");
    total = mergeApiUsage(total, usageDelta(models[0], 0, out));
    return total;
  }

  for (const entry of outputs) {
    if (!isAiModelSupported(entry.modelId)) continue;
    total = mergeApiUsage(
      total,
      usageDelta(entry.modelId, 0, estimateTextTokens(entry.content)),
    );
  }

  const synthModelId = defaultSynthesisModelId();
  const synthIn = estimateSynthesisInputTokens(
    userContent,
    outputs.map((o) => o.content),
  );
  const synthOut = estimateTextTokens(synthesizedContent ?? "");
  total = mergeApiUsage(total, usageDelta(synthModelId, synthIn, synthOut));

  return total;
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return String(Math.round(tokens));
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const m = tokens / 1_000_000;
  return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
}

export function formatCostUsd(costUsd: number): string {
  if (costUsd < 0.0001) return "$0.00";
  if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
  if (costUsd < 1) return `$${costUsd.toFixed(3)}`;
  if (costUsd < 100) return `$${costUsd.toFixed(2)}`;
  return `$${costUsd.toFixed(2)}`;
}
