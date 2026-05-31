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

/** Models in the Model Cart / dock on first launch (new users & new panes). */
export const DEFAULT_ROUND_TABLE_IDS = [
  "gpt4o",
  "claude",
  "gemini-2.5-flash",
] as const;

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
    name: "Gemini 2.5 Pro",
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
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    orgId: "google",
    provider: "Google",
    role: "Fast Responses",
    color: "#4285f4",
    initial: "F",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Direct)",
    orgId: "google",
    provider: "Google",
    role: "Deep Reasoning",
    color: "#4285f4",
    initial: "P",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    orgId: "google",
    provider: "Google",
    role: "Cutting Edge",
    color: "#4285f4",
    initial: "3",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    orgId: "google",
    provider: "Google",
    role: "Ultra-Fast Responses",
    color: "#4285f4",
    initial: "L",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3.0 Flash (Preview)",
    orgId: "google",
    provider: "Google",
    role: "Next-gen Fast",
    color: "#4285f4",
    initial: "P",
  },
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3.0 Pro (Preview)",
    orgId: "google",
    provider: "Google",
    role: "Next-gen Pro",
    color: "#4285f4",
    initial: "P",
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro (Preview)",
    orgId: "google",
    provider: "Google",
    role: "Cutting Edge Pro",
    color: "#4285f4",
    initial: "P",
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
    name: "Grok 4.3",
    orgId: "xai",
    provider: "xAI",
    role: "General",
    color: "#fafafa",
    initial: "X",
  },
  {
    id: "grok-fast",
    name: "Grok 4.20 Fast",
    orgId: "xai",
    provider: "xAI",
    role: "Low Latency",
    color: "#fafafa",
    initial: "X",
  },
  {
    id: "grok-reasoning",
    name: "Grok 4.20 Reasoning",
    orgId: "xai",
    provider: "xAI",
    role: "Deep Reasoning",
    color: "#fafafa",
    initial: "X",
  },
  {
    id: "grok-multi",
    name: "Grok 4.20 Multi-Agent",
    orgId: "xai",
    provider: "xAI",
    role: "Multi-Agent",
    color: "#fafafa",
    initial: "X",
  },
  {
    id: "grok-code",
    name: "Grok Code",
    orgId: "xai",
    provider: "xAI",
    role: "Coding",
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
