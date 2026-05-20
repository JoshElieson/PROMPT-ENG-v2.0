import { getModelById, type AiModel } from "@/data/ai-models";

export const staticKeyboardShortcuts = [
  { keys: "/", label: "Commands" },
  { keys: "@", label: "Mention models" },
] as const;

export function buildModelKeyboardShortcuts(cartModelIds: string[]) {
  const cartModels = cartModelIds
    .map((id) => getModelById(id))
    .filter((m): m is AiModel => m != null);

  const modelShortcuts = [1, 2, 3].map((slot) => {
    const model = cartModels[slot - 1];
    return {
      keys: `Ctrl+${slot}`,
      label: model ? `@${model.id}` : "None",
    };
  });

  return [
    ...modelShortcuts,
    { keys: "Ctrl+4", label: "All models" },
    ...staticKeyboardShortcuts,
  ];
}
