export interface AiModel {
  id: string;
  name: string;
  provider: string;
  role: string;
  color: string;
  initial: string;
}

export interface RoundTableModel extends AiModel {
  weight: number;
}

/** Models included in the Round Table on first launch. */
export const DEFAULT_ROUND_TABLE_IDS = ["gpt4o", "claude", "gemini"] as const;

export const popularAiModels: AiModel[] = [
  {
    id: "gpt4o",
    name: "GPT-4o",
    provider: "OpenAI",
    role: "Code Generation",
    color: "#10a37f",
    initial: "G",
  },
  {
    id: "claude",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    role: "Reasoning & Analysis",
    color: "#d97757",
    initial: "C",
  },
  {
    id: "gemini",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    role: "Research & Context",
    color: "#4285f4",
    initial: "G",
  },
  {
    id: "deepseek",
    name: "DeepSeek Coder",
    provider: "DeepSeek",
    role: "Specialized Tasks",
    color: "#6366f1",
    initial: "D",
  },
  {
    id: "gpt4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    role: "General Purpose",
    color: "#10a37f",
    initial: "4",
  },
  {
    id: "o1",
    name: "o1",
    provider: "OpenAI",
    role: "Deep Reasoning",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "claude-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    role: "Complex Analysis",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    role: "Fast Responses",
    color: "#4285f4",
    initial: "F",
  },
  {
    id: "llama",
    name: "Llama 3.1 70B",
    provider: "Meta",
    role: "Open Weights",
    color: "#0668E1",
    initial: "L",
  },
  {
    id: "mistral",
    name: "Mistral Large",
    provider: "Mistral",
    role: "Multilingual",
    color: "#f97316",
    initial: "M",
  },
  {
    id: "grok",
    name: "Grok-2",
    provider: "xAI",
    role: "Real-time Knowledge",
    color: "#fafafa",
    initial: "X",
  },
];

export function buildRoundTableModels(selectedIds: string[]): RoundTableModel[] {
  const selected = popularAiModels.filter((m) => selectedIds.includes(m.id));
  if (selected.length === 0) return [];

  const baseWeight = Math.floor(100 / selected.length);
  let remainder = 100 - baseWeight * selected.length;

  return selected.map((model) => {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    return { ...model, weight: baseWeight + extra };
  });
}
