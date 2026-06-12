import { isAiModelSupported } from "@/lib/ai-chat";
import type { ChatTurn } from "@/lib/ai-chat";
import type { UserPlan } from "@/types/user-plan";

/** Approximate USD per 1M tokens (input / output). Used for estimates only. */
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  gpt4o: { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt4-turbo": { inputPerMillion: 10, outputPerMillion: 30 },
  "gpt-4-turbo": { inputPerMillion: 10, outputPerMillion: 30 },
  "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-4.1-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gpt-5": { inputPerMillion: 5, outputPerMillion: 15 },
  "gpt-5-mini": { inputPerMillion: 1, outputPerMillion: 4 },
  "gpt-5-nano": { inputPerMillion: 0.25, outputPerMillion: 1 },
  "gpt-5.1": { inputPerMillion: 5, outputPerMillion: 15 },
  "gpt-5.2": { inputPerMillion: 5, outputPerMillion: 15 },
  "gpt-5.4": { inputPerMillion: 5, outputPerMillion: 15 },
  "gpt-5.4-mini": { inputPerMillion: 1, outputPerMillion: 4 },
  "gpt-5.4-nano": { inputPerMillion: 0.25, outputPerMillion: 1 },
  "gpt-5.2-pro": { inputPerMillion: 8, outputPerMillion: 24 },
  "gpt-5.1-codex": { inputPerMillion: 5, outputPerMillion: 15 },
  "gpt-5.1-mini": { inputPerMillion: 1, outputPerMillion: 4 },
  "chatgpt-4o-latest": { inputPerMillion: 2.5, outputPerMillion: 10 },
  o1: { inputPerMillion: 15, outputPerMillion: 60 },
  "o1-mini": { inputPerMillion: 3, outputPerMillion: 12 },
  o3: { inputPerMillion: 10, outputPerMillion: 40 },
  "o3-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  "o4-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  claude: { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-fable-5": { inputPerMillion: 10, outputPerMillion: 50 },
  "claude-opus-4-8": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-opus-4-7": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-opus-4-6": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-opus-4-5": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-sonnet-4-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5": { inputPerMillion: 1, outputPerMillion: 5 },
  gemini: { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gemini-2.5-flash": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-2.5-flash-lite": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-3.5-flash": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gemini-3.1-pro-preview": { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-3.1-flash-lite": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-3-flash-preview": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gemini-3-pro-preview": { inputPerMillion: 1.25, outputPerMillion: 5 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gemini-2.0-flash-lite": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "deepseek-v4-pro": { inputPerMillion: 0.55, outputPerMillion: 2.19 },
  "deepseek-v4-flash": { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  "deepseek-chat": { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  "deepseek-reasoner": { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  deepseek: { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  grok: { inputPerMillion: 3, outputPerMillion: 15 },
  "grok-4.3": { inputPerMillion: 3, outputPerMillion: 15 },
  "grok-fast": { inputPerMillion: 2, outputPerMillion: 10 },
  "grok-4.20-0309-non-reasoning": { inputPerMillion: 2, outputPerMillion: 10 },
  "grok-reasoning": { inputPerMillion: 3, outputPerMillion: 15 },
  "grok-4.20-0309-reasoning": { inputPerMillion: 3, outputPerMillion: 15 },
  "grok-code": { inputPerMillion: 2, outputPerMillion: 10 },
  "grok-build-0.1": { inputPerMillion: 2, outputPerMillion: 10 },
  "grok-4.20-multi-agent-0309": { inputPerMillion: 3, outputPerMillion: 15 },
  "grok-multi": { inputPerMillion: 3, outputPerMillion: 15 },
};

export type ModelCostTier = 1 | 2 | 3;

const COST_TIER_LOW_MAX = 1.5;
const COST_TIER_MID_MAX = 8;

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
};

const CHARS_PER_TOKEN = 4;
const CHAT_SYSTEM_OVERHEAD = 120;
const WORKSPACE_SYSTEM_OVERHEAD = 900;

interface ApiUsageTotals {
  tokens: number;
  costUsd: number;
}

export interface ModelUsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ApiUsageSnapshot {
  totals: ApiUsageTotals;
  byModel: Record<string, ModelUsageTotals>;
}

export interface ModelUsageDelta {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

function emptyApiUsage(): ApiUsageTotals {
  return { tokens: 0, costUsd: 0 };
}

function emptyModelUsage(): ModelUsageTotals {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

export function emptyApiUsageSnapshot(): ApiUsageSnapshot {
  return { totals: emptyApiUsage(), byModel: {} };
}

function estimateTextTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / CHARS_PER_TOKEN));
}

function estimateTurnsTokens(turns: ChatTurn[]): number {
  return turns.reduce((sum, turn) => sum + estimateTextTokens(turn.content), 0);
}

function pricingForModel(modelId: string): ModelPricing {
  return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
}

function blendedPricePerMillion(pricing: ModelPricing): number {
  return (pricing.inputPerMillion + pricing.outputPerMillion) / 2;
}

/** Relative cost tier for Model Cart ($ / $$ / $$$). */
export function getModelCostTier(modelId: string): ModelCostTier {
  const blended = blendedPricePerMillion(pricingForModel(modelId));
  if (blended <= COST_TIER_LOW_MAX) return 1;
  if (blended <= COST_TIER_MID_MAX) return 2;
  return 3;
}

function costForTokens(
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

function usageDelta(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): ModelUsageDelta {
  return { modelId, inputTokens, outputTokens };
}

export function applyUsageDeltas(
  snapshot: ApiUsageSnapshot,
  deltas: ModelUsageDelta[],
): ApiUsageSnapshot {
  if (deltas.length === 0) return snapshot;

  const byModel = { ...snapshot.byModel };
  let totalTokens = snapshot.totals.tokens;
  let totalCost = snapshot.totals.costUsd;

  for (const delta of deltas) {
    const inputTokens = Math.max(0, delta.inputTokens);
    const outputTokens = Math.max(0, delta.outputTokens);
    if (inputTokens <= 0 && outputTokens <= 0) continue;

    const tokens = inputTokens + outputTokens;
    const costUsd = costForTokens(delta.modelId, inputTokens, outputTokens);
    const prev = byModel[delta.modelId] ?? emptyModelUsage();

    byModel[delta.modelId] = {
      inputTokens: prev.inputTokens + inputTokens,
      outputTokens: prev.outputTokens + outputTokens,
      costUsd: prev.costUsd + costUsd,
    };
    totalTokens += tokens;
    totalCost += costUsd;
  }

  return {
    totals: { tokens: totalTokens, costUsd: totalCost },
    byModel,
  };
}

export function formatTokenCount(value: number): string {
  const n = Math.max(0, Math.round(value));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export const FREE_PLAN_TOKEN_LIMIT = 100_000;

export function tokenLimitForPlan(plan: UserPlan): number | null {
  return plan === "free" ? FREE_PLAN_TOKEN_LIMIT : null;
}

export function isAtTokenLimit(plan: UserPlan, usedTokens: number): boolean {
  const limit = tokenLimitForPlan(plan);
  if (limit == null) return false;
  return Math.max(0, usedTokens) >= limit;
}

export function formatPlanTokenCount(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString();
}

export function freePlanUsageRatio(usedTokens: number, plan: UserPlan = "free"): number {
  const limit = tokenLimitForPlan(plan);
  if (limit == null || limit <= 0) return 0;
  return Math.min(Math.max(0, usedTokens) / limit, 1);
}

export function buildTokenLimitMessage(resetDateLabel: string): string {
  return `You've used all ${formatPlanTokenCount(FREE_PLAN_TOKEN_LIMIT)} free tokens this month. Wait until ${resetDateLabel} for your allowance to reset, or upgrade to Forge Premium for unlimited tokens.`;
}

export function formatCostUsd(value: number): string {
  const n = Math.max(0, value);
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  if (n <= 0) return "$0.00";
  return `$${n.toFixed(4)}`;
}

export function totalInputTokens(snapshot: ApiUsageSnapshot): number {
  return Object.values(snapshot.byModel).reduce(
    (sum, entry) => sum + entry.inputTokens,
    0,
  );
}

export function totalOutputTokens(snapshot: ApiUsageSnapshot): number {
  return Object.values(snapshot.byModel).reduce(
    (sum, entry) => sum + entry.outputTokens,
    0,
  );
}

/** Mirrors Tauri `synthesis_provider_for_models` (first participant, then fallback). */
function synthesisModelIdForParticipants(modelIds: string[]): string {
  const supported = modelIds.filter(isAiModelSupported);
  if (supported.length > 0) return supported[0];
  return "gpt4o";
}

function estimatePerModelInputTokens(
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

function estimateSynthesisInputTokens(
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
): ModelUsageDelta[] {
  const models = targetModelIds.filter(isAiModelSupported);
  if (models.length === 0) return [];

  const inputPerCall = estimatePerModelInputTokens(
    history,
    userContent,
    workspaceEnabled,
  );

  return models.map((modelId) => usageDelta(modelId, inputPerCall, 0));
}

export function recordResponseEstimates(
  targetModelIds: string[],
  userContent: string,
  outputs: { modelId: string; content: string }[],
  synthesizedContent: string | null,
): ModelUsageDelta[] {
  const models = targetModelIds.filter(isAiModelSupported);
  if (models.length === 0) return [];

  const deltas: ModelUsageDelta[] = [];

  if (models.length === 1) {
    const out = estimateTextTokens(synthesizedContent ?? outputs[0]?.content ?? "");
    deltas.push(usageDelta(models[0], 0, out));
    return deltas;
  }

  for (const entry of outputs) {
    if (!isAiModelSupported(entry.modelId)) continue;
    deltas.push(
      usageDelta(entry.modelId, 0, estimateTextTokens(entry.content)),
    );
  }

  const synthModelId = synthesisModelIdForParticipants(
    outputs.map((o) => o.modelId),
  );
  const synthIn = estimateSynthesisInputTokens(
    userContent,
    outputs.map((o) => o.content),
  );
  const synthOut = estimateTextTokens(synthesizedContent ?? "");
  deltas.push(usageDelta(synthModelId, synthIn, synthOut));

  return deltas;
}
