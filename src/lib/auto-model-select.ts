import { isAiModelSupported } from "@/lib/ai-chat";

export type TaskProfile =
  | "code"
  | "reasoning"
  | "research"
  | "creative"
  | "edgy"
  | "fast"
  | "general";

export type ModelMode = "auto" | "deeper" | "manual";

type ModelProfile = {
  /** Base score in auto (balanced) mode. */
  auto: number;
  /** Base score when deeper mode is on. */
  deeper: number;
  strengths: TaskProfile[];
  orgId: string;
};

/** Capability hints for supported app model ids. */
const MODEL_PROFILES: Record<string, ModelProfile> = {
  gpt4o: {
    auto: 92,
    deeper: 78,
    strengths: ["general", "code"],
    orgId: "openai",
  },
  "gpt4-turbo": {
    auto: 80,
    deeper: 72,
    strengths: ["general"],
    orgId: "openai",
  },
  o1: {
    auto: 35,
    deeper: 98,
    strengths: ["reasoning"],
    orgId: "openai",
  },
  claude: {
    auto: 90,
    deeper: 82,
    strengths: ["reasoning", "general"],
    orgId: "anthropic",
  },
  "claude-opus": {
    auto: 28,
    deeper: 97,
    strengths: ["reasoning"],
    orgId: "anthropic",
  },
  gemini: {
    auto: 86,
    deeper: 80,
    strengths: ["research", "general"],
    orgId: "google",
  },
  "gemini-flash": {
    auto: 94,
    deeper: 55,
    strengths: ["fast", "general"],
    orgId: "google",
  },
  deepseek: {
    auto: 82,
    deeper: 70,
    strengths: ["code"],
    orgId: "deepseek",
  },
  grok: {
    auto: 90,
    deeper: 78,
    strengths: ["general", "edgy"],
    orgId: "xai",
  },
  "grok-fast": {
    auto: 94,
    deeper: 52,
    strengths: ["fast", "general", "edgy"],
    orgId: "xai",
  },
  "grok-reasoning": {
    auto: 42,
    deeper: 96,
    strengths: ["reasoning", "edgy"],
    orgId: "xai",
  },
  "grok-multi": {
    auto: 48,
    deeper: 88,
    strengths: ["reasoning", "research", "edgy"],
    orgId: "xai",
  },
  "grok-code": {
    auto: 72,
    deeper: 85,
    strengths: ["code"],
    orgId: "xai",
  },
};

const CODE_RE =
  /\b(code|coding|compile|debug|refactor|implement|function|class|typescript|javascript|python|rust|react|api|bug|fix|error|stack trace|git|npm|cargo|test suite|unit test)\b/i;
const REASONING_RE =
  /\b(analyz|analysis|compare|trade-?off|architect|design|why|how should|evaluate|pros and cons|proof|reason|think through|deepthink)\b/i;
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

const DEEPER_SLASH = /\/deepthink\b/i;
const SHALLOW_SLASH = /\/shallow\b/i;

function profileFor(modelId: string): ModelProfile {
  return (
    MODEL_PROFILES[modelId] ?? {
      auto: 50,
      deeper: 50,
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

  if (SHALLOW_SLASH.test(content)) return "fast";
  if (DEEPER_SLASH.test(content)) return "reasoning";

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
  mode: "auto" | "deeper",
  hasWorkspace: boolean,
): number {
  const profile = profileFor(modelId);
  let score = mode === "deeper" ? profile.deeper : profile.auto;
  score += taskBoost(profile, task);

  if (hasWorkspace && profile.strengths.includes("code")) {
    score += 8;
  }

  if (mode === "auto" && task === "fast" && profile.strengths.includes("fast")) {
    score += 12;
  }

  if (mode === "deeper" && profile.strengths.includes("reasoning")) {
    score += 10;
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
  deeperEnabled?: boolean;
  /** Workspace tools enabled — bias toward code-capable models. */
  hasWorkspace?: boolean;
};

/**
 * Pick the top 1–2 models for a message. Returns only supported, configured models.
 */
export function selectAutoModels(options: AutoSelectOptions): string[] {
  const {
    message,
    goal,
    candidateIds,
    deeperEnabled = false,
    hasWorkspace = false,
  } = options;

  const pool = [...new Set(candidateIds)].filter((id) => isAiModelSupported(id));
  if (pool.length === 0) return [];
  if (pool.length === 1) return pool;

  const task = detectTaskProfile(message, goal);
  const mode: "auto" | "deeper" = deeperEnabled ? "deeper" : "auto";

  const grokInPool = pool.filter(isGrokModel);
  const scoringPool =
    task === "edgy" && grokInPool.length > 0 ? grokInPool : pool;

  const ranked = scoringPool
    .map((id) => ({
      id,
      score: scoreModel(id, task, mode, hasWorkspace),
      orgId: profileFor(id).orgId,
    }))
    .sort((a, b) => b.score - a.score);

  if (task === "edgy") {
    return [ranked[0]!.id];
  }

  const wantPair =
    mode === "deeper" ||
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
