import { getModelById } from "@/data/ai-models";
import type { ModelContribution } from "@/types/chat";
import { RESPONSE_TURN_MS } from "@/types/chat";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function evenContributions(modelIds: string[]): ModelContribution[] {
  if (modelIds.length === 0) return [];
  const base = Math.floor(100 / modelIds.length);
  let remainder = 100 - base * modelIds.length;
  return modelIds.map((modelId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    return { modelId, percentage: base + extra };
  });
}

export function buildMockAssistantReply(
  userContent: string,
  targetModelIds: string[],
  contributions: ModelContribution[],
): string {
  const names = targetModelIds
    .map((id) => getModelById(id)?.name ?? id)
    .join(", ");

  if (targetModelIds.length > 1) {
    const blend = contributions
      .map((c) => {
        const name = getModelById(c.modelId)?.name ?? c.modelId;
        return `${name} (${c.percentage}%)`;
      })
      .join(" · ");
    return `Round Table synthesis for “${userContent.slice(0, 80)}${userContent.length > 80 ? "…" : ""}” — blended from ${names}.\n\n[${blend}]\n\nThis is a placeholder response while model APIs are wired up.`;
  }

  const single = getModelById(targetModelIds[0])?.name ?? "the model";
  return `${single} — placeholder reply to “${userContent.slice(0, 120)}${userContent.length > 120 ? "…" : ""}”.`;
}

export { RESPONSE_TURN_MS };
