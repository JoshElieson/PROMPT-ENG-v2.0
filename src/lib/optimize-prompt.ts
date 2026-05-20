import { aiChatComplete, type ChatTurn } from "@/lib/ai-chat";

/** ChatGPT (OpenAI) model used for composer prompt optimization. */
export const OPTIMIZE_PROMPT_MODEL_ID = "gpt4o";

const OPTIMIZE_PROMPT_SYSTEM = `You are a prompt engineering assistant. The user will send a draft message they plan to use in a multi-model AI chat workspace.

Your job:
1. Infer the most likely purpose of the draft (e.g. coding task, research question, writing request, debugging).
2. Rewrite the draft as a clear, effective prompt tailored to that purpose.
3. Shorten the text wherever possible without removing information, constraints, examples, or intent.

Rules:
- Return ONLY the optimized prompt text—no preamble, labels, markdown fences, or explanation.
- Preserve the user's language unless mixing languages is clearly wrong.
- Keep @mentions and /commands if present.
- Do not add capabilities the user did not ask for.`;

function normalizeOptimizedOutput(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines[0]?.match(/^```/)) lines.shift();
    const last = lines.at(-1);
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
