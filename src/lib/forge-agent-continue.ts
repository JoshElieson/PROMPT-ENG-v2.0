export interface ForgeAgentContinuationState {
  provider: string;
  apiModel: string;
  round: number;
  messages: unknown[];
}

const FORGE_AGENT_CONTINUE_RE =
  /\[\[FORGE_AGENT_CONTINUE\s+(\{[\s\S]*?\})\]\]\s*$/;

export function extractForgeAgentContinue(content: string): {
  body: string;
  continuation: ForgeAgentContinuationState | null;
} {
  const match = content.match(FORGE_AGENT_CONTINUE_RE);
  if (!match) {
    return { body: content.trim(), continuation: null };
  }
  const body = content.slice(0, match.index).trim();
  try {
    const parsed = JSON.parse(match[1]) as Partial<ForgeAgentContinuationState>;
    if (
      typeof parsed.provider === "string" &&
      typeof parsed.apiModel === "string" &&
      typeof parsed.round === "number" &&
      Array.isArray(parsed.messages)
    ) {
      return {
        body,
        continuation: {
          provider: parsed.provider,
          apiModel: parsed.apiModel,
          round: parsed.round,
          messages: parsed.messages,
        },
      };
    }
  } catch {
    // Malformed continuation payload — show body only.
  }
  return { body, continuation: null };
}

export function hasForgeAgentContinue(content: string): boolean {
  return FORGE_AGENT_CONTINUE_RE.test(content);
}

/** Remove embedded continuation state from stored messages before the next send. */
export function stripAgentContinuationFromHistory(content: string): string {
  return extractForgeAgentContinue(content).body;
}
