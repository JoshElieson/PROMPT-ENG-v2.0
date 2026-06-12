import { getModelById, type AiModel } from "@/data/ai-models";

const staticKeyboardShortcuts = [
  { keys: "/", label: "Commands" },
  { keys: "@", label: "Mention models" },
] as const;

export function buildModelKeyboardShortcuts(cartModelIds: string[]) {
  const cartModels = cartModelIds
    .map((id) => getModelById(id))
    .filter((model): model is AiModel => model != null);

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
