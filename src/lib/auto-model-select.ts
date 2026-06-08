import { normalizeTargetModelIds } from "@/lib/ai-chat";

export type TaskProfile =
  | "code"
  | "reasoning"
  | "research"
  | "creative"
  | "edgy"
  | "fast"
  | "general";

export type ModelMode = "auto" | "manual";

type ModelProfile = {
  /** Base score in auto (balanced) mode. */
  auto: number;
  strengths: TaskProfile[];
  orgId: string;
};

/** Capability hints for supported app model ids. */
const MODEL_PROFILES: Record<string, ModelProfile> = {
  gpt4o: {
    auto: 92,
    strengths: ["general", "code"],
    orgId: "openai",
  },
  "gpt4-turbo": {
    auto: 80,
    strengths: ["general"],
    orgId: "openai",
  },
  o1: {
    auto: 35,
    strengths: ["reasoning"],
    orgId: "openai",
  },
  claude: {
    auto: 90,
    strengths: ["reasoning", "general"],
    orgId: "anthropic",
  },
  "claude-opus": {
    auto: 28,
    strengths: ["reasoning"],
    orgId: "anthropic",
  },
  gemini: {
    auto: 86,
    strengths: ["research", "general"],
    orgId: "google",
  },
  "gemini-flash": {
    auto: 94,
    strengths: ["fast", "general"],
    orgId: "google",
  },
  deepseek: {
    auto: 82,
    strengths: ["code"],
    orgId: "deepseek",
  },
  grok: {
    auto: 90,
    strengths: ["general", "edgy"],
    orgId: "xai",
  },
  "grok-fast": {
    auto: 94,
    strengths: ["fast", "general", "edgy"],
    orgId: "xai",
  },
  "grok-reasoning": {
    auto: 42,
    strengths: ["reasoning", "edgy"],
    orgId: "xai",
  },
  "grok-multi": {
    auto: 48,
    strengths: ["reasoning", "research", "edgy"],
    orgId: "xai",
  },
  "grok-code": {
    auto: 72,
    strengths: ["code"],
    orgId: "xai",
  },
};

const CODE_RE =
  /\b(code|coding|compile|debug|refactor|implement|function|class|typescript|javascript|python|rust|react|api|bug|fix|error|stack trace|git|npm|cargo|test suite|unit test)\b/i;
const REASONING_RE =
  /\b(analyz|analysis|compare|trade-?off|architect|design|why|how should|evaluate|pros and cons|proof|reason|think through)\b/i;
const RESEARCH_RE =
  /\b(research|summarize|summary|explain|document|read|sources|literature|overview|survey)\b/i;
const CREATIVE_RE =
  /\b(write|story|poem|brainstorm|creative|draft|copy|blog|essay)\b/i;
const EDGY_COMEDIC_RE =
  /\b(edgy|unfiltered|unhinged|spicy|roast|roasting|sarcastic|sarcasm|comedic|comedy|funny|humou?r|humorous|hilarious|joke|jokes|meme|memes|shitpost|chaotic|irreverent|dark humor|no filter|don't hold back|dont hold back|make (it|this) funny|be funny|crack me up|troll|trolling|based take|unserious|playful|witty|snarky|snark)\b/i;
const OFFENSIVE_RE =
  /\b(offensive|offensively|insult|insulting|vulgar|profane|profanity|obscene|lewd|crude|rude|nsfw|explicit|controversial|provocative|shock(ing)? humor|politically incorrect|curse words?|swearing|cuss(ing)?|taboo|inappropriate|not safe for work|cross the line|push boundaries|write something offensive|be offensive|make it offensive|something offensive)\b/i;

function wantsGrokTone(text: string): boolean {
  return EDGY_COMEDIC_RE.test(text) || OFFENSIVE_RE.test(text);
}
const FAST_RE =
  /\b(quick|fast|brief|short|simple|one-?liner|translate|list|bullet)\b/i;

const GROK_MODEL_IDS = new Set([
  "grok",
  "grok-fast",
  "grok-reasoning",
  "grok-multi",
  "grok-code",
]);

function isGrokModel(modelId: string): boolean {
  return GROK_MODEL_IDS.has(modelId) || modelId.startsWith("grok");
}

function profileFor(modelId: string): ModelProfile {
  return (
    MODEL_PROFILES[modelId] ?? {
      auto: 50,
      strengths: ["general"],
      orgId: "unknown",
    }
  );
}

export function detectTaskProfile(
  content: string,
  goal?: string | null,
): TaskProfile {
  const text = `${goal ?? ""}\n${content}`.trim();
  if (!text) return "general";

  if (CODE_RE.test(text)) return "code";
  if (REASONING_RE.test(text)) return "reasoning";
  if (RESEARCH_RE.test(text)) return "research";
  if (wantsGrokTone(text)) return "edgy";
  if (CREATIVE_RE.test(text)) return "creative";
  if (FAST_RE.test(text) || content.trim().length < 48) return "fast";

  return "general";
}

function taskBoost(profile: ModelProfile, task: TaskProfile): number {
  if (profile.strengths.includes(task)) return 18;
  if (task === "general" && profile.strengths.includes("general")) return 10;
  if (task === "fast" && profile.strengths.includes("fast")) return 16;
  if (task === "code" && profile.strengths.includes("code")) return 14;
  if (task === "edgy" && profile.strengths.includes("edgy")) return 22;
  return 0;
}

function scoreModel(
  modelId: string,
  task: TaskProfile,
  hasWorkspace: boolean,
): number {
  const profile = profileFor(modelId);
  let score = profile.auto;
  score += taskBoost(profile, task);

  if (hasWorkspace && profile.strengths.includes("code")) {
    score += 8;
  }

  if (task === "fast" && profile.strengths.includes("fast")) {
    score += 12;
  }

  if (task === "edgy" && profile.orgId === "xai") {
    score += 28;
    if (modelId === "grok" || modelId === "grok-fast") {
      score += 8;
    }
    if (modelId === "grok-code") {
      score -= 20;
    }
  }

  return score;
}

export type AutoSelectOptions = {
  message: string;
  /** Chat title or other stated goal for the thread. */
  goal?: string | null;
  /** Models the user has in the cart / round table pool. */
  candidateIds: string[];
  /** Workspace tools enabled — bias toward code-capable models. */
  hasWorkspace?: boolean;
};

/**
 * Pick the top 1–2 models for a message. Returns only supported, configured models.
 */
export function selectAutoModels(options: AutoSelectOptions): string[] {
  const { message, goal, candidateIds, hasWorkspace = false } = options;

  const pool = normalizeTargetModelIds(candidateIds);
  if (pool.length === 0) return [];
  if (pool.length === 1) return pool;

  const task = detectTaskProfile(message, goal);

  const grokInPool = pool.filter(isGrokModel);
  const scoringPool =
    task === "edgy" && grokInPool.length > 0 ? grokInPool : pool;

  const ranked = scoringPool
    .map((id) => ({
      id,
      score: scoreModel(id, task, hasWorkspace),
      orgId: profileFor(id).orgId,
    }))
    .sort((a, b) => b.score - a.score);

  if (task === "edgy") {
    return [ranked[0]!.id];
  }

  const wantPair =
    task === "reasoning" ||
    task === "code" ||
    task === "research" ||
    (task === "general" && message.trim().length > 120);

  if (!wantPair) {
    return [ranked[0]!.id];
  }

  const primary = ranked[0]!;
  const secondary =
    ranked.find((r) => r.id !== primary.id && r.orgId !== primary.orgId) ??
    ranked.find((r) => r.id !== primary.id);

  if (!secondary || secondary.score < primary.score * 0.72) {
    return [primary.id];
  }

  return [primary.id, secondary.id];
}
