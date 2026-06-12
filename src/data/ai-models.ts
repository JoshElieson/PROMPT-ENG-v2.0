import { readImportedModels } from "@/lib/imported-models-storage";

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
  // —— ChatGPT / OpenAI ——
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    orgId: "openai",
    provider: "OpenAI",
    role: "Flagship",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Fast & Capable",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    orgId: "openai",
    provider: "OpenAI",
    role: "Lowest Latency",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    orgId: "openai",
    provider: "OpenAI",
    role: "General Purpose",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    orgId: "openai",
    provider: "OpenAI",
    role: "High Accuracy",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    orgId: "openai",
    provider: "OpenAI",
    role: "Balanced",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5.1-codex",
    name: "GPT-5.1 Codex",
    orgId: "openai",
    provider: "OpenAI",
    role: "Coding",
    color: "#10a37f",
    initial: "C",
  },
  {
    id: "gpt-5.1-mini",
    name: "GPT-5.1 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Efficient",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    orgId: "openai",
    provider: "OpenAI",
    role: "Reasoning",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Fast",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    orgId: "openai",
    provider: "OpenAI",
    role: "Ultra-Fast",
    color: "#10a37f",
    initial: "5",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    orgId: "openai",
    provider: "OpenAI",
    role: "Long Context",
    color: "#10a37f",
    initial: "4",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Efficient",
    color: "#10a37f",
    initial: "4",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    orgId: "openai",
    provider: "OpenAI",
    role: "Low Cost",
    color: "#10a37f",
    initial: "4",
  },
  {
    id: "o3",
    name: "o3",
    orgId: "openai",
    provider: "OpenAI",
    role: "Deep Reasoning",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "o3-mini",
    name: "o3 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Reasoning (Fast)",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Reasoning (Latest)",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    orgId: "openai",
    provider: "OpenAI",
    role: "Multimodal",
    color: "#10a37f",
    initial: "G",
  },
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
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Fast Multimodal",
    color: "#10a37f",
    initial: "G",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    orgId: "openai",
    provider: "OpenAI",
    role: "General Purpose",
    color: "#10a37f",
    initial: "4",
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
    id: "o1-mini",
    name: "o1 Mini",
    orgId: "openai",
    provider: "OpenAI",
    role: "Reasoning (Legacy)",
    color: "#10a37f",
    initial: "o",
  },
  {
    id: "chatgpt-4o-latest",
    name: "ChatGPT 4o Latest",
    orgId: "openai",
    provider: "OpenAI",
    role: "ChatGPT Parity",
    color: "#10a37f",
    initial: "G",
  },
  // —— Claude / Anthropic ——
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Flagship",
    color: "#d97757",
    initial: "F",
  },
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Agentic & Coding",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Deep Reasoning",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Enterprise Work",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Legacy Opus",
    color: "#d97757",
    initial: "O",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Balanced Default",
    color: "#d97757",
    initial: "S",
  },
  {
    id: "claude",
    name: "Claude Sonnet 4.6",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Reasoning & Analysis",
    color: "#d97757",
    initial: "C",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Speed & Intelligence",
    color: "#d97757",
    initial: "S",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Fastest",
    color: "#d97757",
    initial: "H",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 4.8",
    orgId: "anthropic",
    provider: "Anthropic",
    role: "Complex Analysis",
    color: "#d97757",
    initial: "O",
  },
  // —— Gemini / Google ——
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    orgId: "google",
    provider: "Google",
    role: "Latest Fast",
    color: "#4285f4",
    initial: "3",
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
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    orgId: "google",
    provider: "Google",
    role: "Ultra-Efficient",
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
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    orgId: "google",
    provider: "Google",
    role: "Deep Reasoning",
    color: "#4285f4",
    initial: "P",
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
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    orgId: "google",
    provider: "Google",
    role: "Fast & Capable",
    color: "#4285f4",
    initial: "F",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    orgId: "google",
    provider: "Google",
    role: "High Volume",
    color: "#4285f4",
    initial: "L",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    orgId: "google",
    provider: "Google",
    role: "Fast Responses",
    color: "#4285f4",
    initial: "F",
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
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    orgId: "google",
    provider: "Google",
    role: "Legacy Fast",
    color: "#4285f4",
    initial: "L",
  },
  // —— DeepSeek ——
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "Flagship",
    color: "#6366f1",
    initial: "P",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "Fast Default",
    color: "#6366f1",
    initial: "F",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "Thinking Mode",
    color: "#6366f1",
    initial: "R",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "General Chat",
    color: "#6366f1",
    initial: "D",
  },
  {
    id: "deepseek",
    name: "DeepSeek Chat",
    orgId: "deepseek",
    provider: "DeepSeek",
    role: "Specialized Tasks",
    color: "#6366f1",
    initial: "D",
  },
  // —— Grok / xAI ——
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    orgId: "xai",
    provider: "xAI",
    role: "General",
    color: "#fafafa",
    initial: "X",
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
    id: "grok-4.20-0309-non-reasoning",
    name: "Grok 4.20 Fast",
    orgId: "xai",
    provider: "xAI",
    role: "Low Latency",
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
    id: "grok-4.20-0309-reasoning",
    name: "Grok 4.20 Reasoning",
    orgId: "xai",
    provider: "xAI",
    role: "Deep Reasoning",
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
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 Multi-Agent",
    orgId: "xai",
    provider: "xAI",
    role: "Multi-Agent",
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
    id: "grok-build-0.1",
    name: "Grok Code",
    orgId: "xai",
    provider: "xAI",
    role: "Coding",
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
  // —— Not in Model Cart (other features) ——
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
];

export type ModelOrgGroup = { org: ModelOrg; models: AiModel[] };

const MODEL_CART_EXCLUDED_ORG_IDS = new Set(["meta", "mistral"]);

function getModelsGroupedByOrg(): ModelOrgGroup[] {
  return modelOrgs
    .map((org) => ({
      org,
      models: popularAiModels.filter((m) => m.orgId === org.id),
    }))
    .filter((group) => group.models.length > 0);
}

/** Model Cart providers (excludes orgs not yet available in the cart UI). */
export function getCartModelsGroupedByOrg(): ModelOrgGroup[] {
  return getModelsGroupedByOrg().filter(
    (group) => !MODEL_CART_EXCLUDED_ORG_IDS.has(group.org.id),
  );
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
  const builtin = popularAiModels.find((m) => m.id.toLowerCase() === normalized);
  if (builtin) return builtin;
  return readImportedModels().find((m) => m.id.toLowerCase() === normalized);
}

/** First listed model for a provider (e.g. GPT-4o for ChatGPT). */
export function getTopModelForOrg(orgId: string): AiModel | undefined {
  return popularAiModels.find((m) => m.orgId === orgId);
}
