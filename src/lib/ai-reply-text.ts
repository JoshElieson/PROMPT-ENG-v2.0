/** First content line of a short AI reply: strips code fences, wrapping quotes, and trailing periods. */
export function firstLineOfAiReply(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines[0]?.match(/^```/)) lines.shift();
    const last = lines[lines.length - 1];
    if (last?.match(/^```/)) lines.pop();
    text = lines.join("\n").trim();
  }

  text = text.split(/\r?\n/)[0]?.trim() ?? "";
  text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
  text = text.replace(/\.+$/, "").trim();
  return text;
}
