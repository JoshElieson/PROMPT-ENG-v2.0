export interface ModelOrg {
  id: string;
  name: string;
  color: string;
  initial: string;
}

export interface AiModel {
  id: string;
  name: string;
  orgId: string;
  provider: string;
  role: string;
  color: string;
  initial: string;
}

export const modelOrgs: ModelOrg[] = [
  { id: "openai", name: "ChatGPT", color: "#10a37f", initial: "G" },
  { id: "anthropic", name: "Claude", color: "#d97757", initial: "C" },
  { id: "google", name: "Gemini", color: "#3186FF", initial: "G" },
  { id: "deepseek", name: "DeepSeek", color: "#6366f1", initial: "D" },
  { id: "meta", name: "Llama", color: "#0668E1", initial: "L" },
  { id: "mistral", name: "Mistral", color: "#f97316", initial: "M" },
  { id: "xai", name: "Grok", color: "#fafafa", initial: "X" },
];

export interface RoundTableModel extends AiModel {
  weight: number;
}

/** Models included in the Round Table on first launch. */
export const DEFAULT_ROUND_TABLE_IDS = ["gpt4o", "claude", "gemini"] as const;

export const popularAiModels: AiModel[] = [
  {
    id: "gpt4o",
    name: "GPT-4o",
    orgId: "openai",
    provider: "OpenAI",
    role: "Code Generation",
    color: "#10a37f",
    initial: "G",
  },
  {
    id: "claude",
    name: "Claude 3.5 Sonnet",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Reasoning & Analysis",
    color: "#d97757",
    initial: "C",
  },
  {
    id: "gemini",
    name: "Gemini 1.5 Pro",
    orgId: "google",
    provider: "Google",
    role: "Research & Context",
    color: "#4285f4",
    initial: "G",
  },
  {
    id: "deepseek",
    name: "DeepSeek Coder",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "Specialized Tasks",
    color: "#6366f1",
    initial: "D",
  },
  {
    id: "gpt4-turbo",
    name: "GPT-4 Turbo",
    orgId: "openai",
    provider: "OpenAI",
    role: "General Purpose",
    color: "#10a37f",
    initial: "4",
  },
  {
    id: "o1",
    name: "o1",
    orgId: "openai",
    provider: "OpenAI",
    role: "Deep Reasoning",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "claude-opus",
    name: "Claude 3 Opus",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Complex Analysis",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.0 Flash",
    orgId: "google",
    provider: "Google",
    role: "Fast Responses",
    color: "#4285f4",
    initial: "F",
  },
  {
    id: "llama",
    name: "Llama 3.1 70B",
    orgId: "meta",
    provider: "Meta",
    role: "Open Weights",
    color: "#0668E1",
    initial: "L",
  },
  {
    id: "mistral",
    name: "Mistral Large",
    orgId: "mistral",
    provider: "Mistral",
    role: "Multilingual",
    color: "#f97316",
    initial: "M",
  },
  {
    id: "grok",
    name: "Grok-2",
    orgId: "xai",
    provider: "xAI",
    role: "Real-time Knowledge",
    color: "#fafafa",
    initial: "X",
  },
];

export type ModelOrgGroup = { org: ModelOrg; models: AiModel[] };

export function getModelsGroupedByOrg(): ModelOrgGroup[] {
  return modelOrgs
    .map((org) => ({
      org,
      models: popularAiModels.filter((m) => m.orgId === org.id),
    }))
    .filter((group) => group.models.length > 0);
}

function modelMatchesQuery(model: AiModel, query: string): boolean {
  return (
    model.name.toLowerCase().includes(query) ||
    model.provider.toLowerCase().includes(query) ||
    model.role.toLowerCase().includes(query) ||
    model.id.toLowerCase().includes(query)
  );
}

function orgMatchesQuery(org: ModelOrg, query: string): boolean {
  return (
    org.name.toLowerCase().includes(query) ||
    org.id.toLowerCase().includes(query)
  );
}

export function filterModelsGroupedByOrg(
  groups: ModelOrgGroup[],
  query: string,
): ModelOrgGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  const result: ModelOrgGroup[] = [];

  for (const group of groups) {
    if (orgMatchesQuery(group.org, q)) {
      result.push(group);
      continue;
    }

    const models = group.models.filter((m) => modelMatchesQuery(m, q));
    if (models.length > 0) {
      result.push({ org: group.org, models });
    }
  }

  return result;
}

export function getModelById(id: string): AiModel | undefined {
  const normalized = id.toLowerCase();
  return popularAiModels.find((m) => m.id.toLowerCase() === normalized);
}

/** First listed model for a provider (e.g. GPT-4o for ChatGPT). */
export function getTopModelForOrg(orgId: string): AiModel | undefined {
  return popularAiModels.find((m) => m.orgId === orgId);
}

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
