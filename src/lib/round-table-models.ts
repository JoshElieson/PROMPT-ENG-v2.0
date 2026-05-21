import { getModelById, type RoundTableModel } from "@/data/ai-models";
import { weightForModel } from "@/lib/round-table-weights";

export function buildRoundTableModels(
  activeIds: string[],
  weights: Record<string, number>,
): RoundTableModel[] {
  return activeIds
    .map((id) => {
      const model = getModelById(id);
      if (!model) return null;
      return { ...model, weight: weightForModel(weights, id) };
    })
    .filter((model): model is RoundTableModel => model != null);
}
