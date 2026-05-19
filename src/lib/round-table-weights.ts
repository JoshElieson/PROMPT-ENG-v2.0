import type { ModelContribution } from "@/types/chat";

/** Default per-model allocation (independent; need not sum to 100). */
export const DEFAULT_ROUND_TABLE_WEIGHTS: Record<string, number> = {
  gpt4o: 45,
  claude: 30,
  gemini: 25,
  deepseek: 10,
};

export function clampWeight(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function weightForModel(
  weights: Record<string, number>,
  modelId: string,
): number {
  if (weights[modelId] != null) return clampWeight(weights[modelId]);
  if (DEFAULT_ROUND_TABLE_WEIGHTS[modelId] != null) {
    return clampWeight(DEFAULT_ROUND_TABLE_WEIGHTS[modelId]);
  }
  return 100;
}

/** Normalize round-table weights for the given models into integer percentages (sum = 100). */
export function buildModelContributions(
  modelIds: string[],
  weights: Record<string, number>,
): ModelContribution[] {
  if (modelIds.length === 0) return [];

  const weighted = modelIds.map((modelId) => ({
    modelId,
    weight: weightForModel(weights, modelId),
  }));

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  if (total <= 0) {
    const base = Math.floor(100 / weighted.length);
    const remainder = 100 - base * weighted.length;
    return weighted.map((entry, index) => ({
      modelId: entry.modelId,
      percentage: base + (index < remainder ? 1 : 0),
    }));
  }

  const scaled = weighted.map((entry) => ({
    modelId: entry.modelId,
    exact: (entry.weight / total) * 100,
  }));

  const withFloors = scaled.map((entry) => ({
    modelId: entry.modelId,
    percentage: Math.floor(entry.exact),
    remainder: entry.exact - Math.floor(entry.exact),
  }));

  let deficit = 100 - withFloors.reduce((sum, entry) => sum + entry.percentage, 0);
  const byRemainder = [...withFloors].sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; deficit > 0; i += 1) {
    byRemainder[i % byRemainder.length].percentage += 1;
    deficit -= 1;
  }

  return withFloors
    .map(({ modelId, percentage }) => ({ modelId, percentage }))
    .sort((a, b) => b.percentage - a.percentage);
}
