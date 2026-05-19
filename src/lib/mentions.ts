import { getModelById, type AiModel } from "@/data/ai-models";

/** Mention token format: @modelId (e.g. @gpt4o) */
const MENTION_PATTERN = /@([a-z0-9][a-z0-9_-]*)/gi;

export function mentionToken(modelId: string): string {
  return `@${modelId}`;
}

export function parseMentions(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const model = getModelById(match[1]);
    if (model) ids.add(model.id);
  }
  return [...ids];
}

export function hasModelMentions(content: string): boolean {
  return parseMentions(content).length > 0;
}

export function resolveTargetModelIds(
  content: string,
  cartSelectedIds: string[],
  roundTableActiveIds: string[],
): string[] {
  const mentioned = parseMentions(content);
  if (mentioned.length > 0) {
    return mentioned.filter((id) => cartSelectedIds.includes(id));
  }
  return [...roundTableActiveIds];
}

export function buildMentionTextForModels(models: AiModel[]): string {
  if (models.length === 0) return "";
  return models.map((m) => mentionToken(m.id)).join(" ");
}

export function insertTextAtCursor(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; cursor: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const needsSpaceBefore =
    before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
  const prefix = needsSpaceBefore ? " " : "";
  const next = `${before}${prefix}${insertion}${after}`;
  const cursor = before.length + prefix.length + insertion.length;
  return { value: next, cursor };
}

export function getMentionQuery(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  const between = before.slice(at + 1);
  if (/\s/.test(between)) return null;

  // Cursor is after a completed @mention token — not an active query
  const tokenMatch = value.slice(at + 1).match(/^([a-z0-9][a-z0-9_-]*)/i);
  if (tokenMatch) {
    const model = getModelById(tokenMatch[1]);
    const tokenEnd = at + 1 + tokenMatch[1].length;
    if (model && cursor >= tokenEnd) return null;
  }

  return { start: at, query: between.toLowerCase() };
}

export function filterCartModels(query: string, cartIds: string[]): AiModel[] {
  const models = cartIds
    .map((id) => getModelById(id))
    .filter((m): m is AiModel => m != null);

  if (!query) return models;

  return models.filter(
    (m) =>
      m.id.includes(query) ||
      m.name.toLowerCase().includes(query) ||
      m.provider.toLowerCase().includes(query),
  );
}

export function applyMentionSelection(
  value: string,
  mentionStart: number,
  cursor: number,
  modelId: string,
): { value: string; cursor: number } {
  const before = value.slice(0, mentionStart);
  const after = value.slice(cursor);
  const token = mentionToken(modelId);
  const next = `${before}${token} ${after}`;
  return { value: next, cursor: before.length + token.length + 1 };
}
