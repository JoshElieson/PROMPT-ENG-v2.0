export type MessageTextSegment = { type: "text"; content: string };

export type MessageCodeSegment = {
  type: "code";
  language: string;
  content: string;
};

export type MessageSegment = MessageTextSegment | MessageCodeSegment;

const FENCED_CODE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;

/** Split assistant/user markdown into plain text and fenced code blocks. */
export function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(FENCED_CODE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const text = content.slice(lastIndex, index);
      if (text.length > 0) segments.push({ type: "text", content: text });
    }
    segments.push({
      type: "code",
      language: match[1]?.trim() || "text",
      content: match[2]?.replace(/\n$/, "") ?? "",
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", content }];
  }

  return segments;
}
