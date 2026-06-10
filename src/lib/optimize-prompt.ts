import { aiChatComplete, type ChatTurn } from "@/lib/ai-chat";

/** ChatGPT (OpenAI) model used for composer prompt optimization. */
export const OPTIMIZE_PROMPT_MODEL_ID = "gpt4o";

const OPTIMIZE_PROMPT_SYSTEM = `You are a prompt optimization assistant for FORGE, an AI-native engineering workspace. The user will send a draft prompt they plan to use with an agent.

Goal:
- Improve clarity, structure, and wording so another agent can understand and execute the user's goal more reliably.
- Bias toward action-oriented phrasing when the user wants work done (e.g. "fix", "add", "refactor", "improve")—agents should execute, not ask permission.
- Keep the meaning exactly the same.

Hard constraints:
1. Do not change the user's intent, requested outcome, scope, constraints, or priority.
2. Do not add new requirements, assumptions, capabilities, tools, deadlines, or context.
3. Do not remove requirements, caveats, examples, or constraints that affect meaning.
4. Keep @mentions, /commands, file paths, quoted text, and explicit names/IDs intact.
5. Preserve the user's language unless fixing mixed-language text is necessary for clarity.
6. If the draft is already clear, return a minimally changed version rather than rewriting heavily.

Output rules:
- Return ONLY the optimized prompt text.
- No preamble, labels, markdown fences, or explanation.`;

function normalizeOptimizedOutput(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines[0]?.match(/^```/)) lines.shift();
    const last = lines[lines.length - 1];
    if (last?.match(/^```/)) lines.pop();
    text = lines.join("\n").trim();
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

export async function optimizePromptWithAi(draft: string): Promise<string> {
  const trimmed = draft.trim();
  if (!trimmed) {
    throw new Error("Enter a prompt to optimize first.");
  }

  const messages: ChatTurn[] = [{ role: "user", content: trimmed }];
  const raw = await aiChatComplete(
    OPTIMIZE_PROMPT_MODEL_ID,
    messages,
    null,
    OPTIMIZE_PROMPT_SYSTEM,
  );

  const optimized = normalizeOptimizedOutput(raw);
  if (!optimized) {
    throw new Error("The model returned an empty optimized prompt.");
  }
  return optimized;
}
