import { getModelById, type AiModel } from "@/data/ai-models";
import { selectAutoModels } from "@/lib/auto-model-select";
import { normalizeTargetModelIds } from "@/lib/ai-chat";

/** Composer @-tokens include display names while typing (e.g. @GPT-4o). */
const COMPOSER_MENTION_PATTERN = /@([^\s@]*)/g;

function normalizeMentionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cartModelsFromIds(cartIds: string[]): AiModel[] {
  return cartIds
    .map((id) => getModelById(id))
    .filter((m): m is AiModel => m != null);
}

/** Resolve a completed @-token to a cart model (id or display name). */
function resolveMentionQuery(
  query: string,
  cartIds?: string[],
): AiModel | null {
  if (!query) return null;

  const byId = getModelById(query);
  if (byId && (!cartIds || cartIds.includes(byId.id))) return byId;

  const lower = query.toLowerCase();
  const key = normalizeMentionKey(query);
  const models = cartIds ? cartModelsFromIds(cartIds) : [];

  for (const model of models) {
    if (model.id.toLowerCase() === lower) return model;
    if (model.name.toLowerCase() === lower) return model;
    if (normalizeMentionKey(model.name) === key) return model;
  }

  return null;
}

/** Resolve an in-progress @-token for composer highlighting (prefix match). */
function resolveMentionQueryPartial(
  query: string,
  cartIds: string[],
): AiModel | null {
  const exact = resolveMentionQuery(query, cartIds);
  if (exact) return exact;
  if (!query) return null;

  const lower = query.toLowerCase();
  const key = normalizeMentionKey(query);
  const matches = cartModelsFromIds(cartIds).filter(
    (model) =>
      model.id.toLowerCase().startsWith(lower) ||
      model.name.toLowerCase().startsWith(lower) ||
      normalizeMentionKey(model.name).startsWith(key),
  );

  if (matches.length === 0) return null;
  return (
    matches.find((model) => model.id.toLowerCase().startsWith(lower)) ??
    matches[0]
  );
}

export type ComposerMentionSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; raw: string; model: AiModel | null };

export function splitComposerMentionSegments(
  value: string,
  cartIds: string[],
): ComposerMentionSegment[] {
  if (!value) return [];

  const segments: ComposerMentionSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(COMPOSER_MENTION_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const query = match[1];

    if (start > lastIndex) {
      segments.push({ kind: "text", value: value.slice(lastIndex, start) });
    }

    segments.push({
      kind: "mention",
      raw,
      model: resolveMentionQueryPartial(query, cartIds),
    });
    lastIndex = start + raw.length;
  }

  if (lastIndex < value.length) {
    segments.push({ kind: "text", value: value.slice(lastIndex) });
  }

  return segments;
}

function mentionToken(modelId: string): string {
  return `@${modelId}`;
}

export function parseMentions(content: string, cartIds?: string[]): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(COMPOSER_MENTION_PATTERN)) {
    const model = resolveMentionQuery(match[1], cartIds);
    if (model) ids.add(model.id);
  }
  return [...ids];
}

export type ResolvedMentionSpan = {
  start: number;
  end: number;
  modelId: string;
};

/** Ranges for @-tokens that resolve to a cart model (atomic delete targets). */
function getResolvedMentionSpans(
  value: string,
  cartIds: string[],
): ResolvedMentionSpan[] {
  const spans: ResolvedMentionSpan[] = [];
  for (const match of value.matchAll(COMPOSER_MENTION_PATTERN)) {
    const start = match.index ?? 0;
    const query = match[1];
    const model = resolveMentionQuery(query, cartIds);
    if (!model) continue;
    spans.push({
      start,
      end: start + match[0].length,
      modelId: model.id,
    });
  }
  return spans;
}

/** Mention span to remove when Backspace/Delete is pressed at a collapsed cursor. */
export function findResolvedMentionSpanAtCursor(
  value: string,
  cursor: number,
  cartIds: string[],
  direction: "backspace" | "delete",
): ResolvedMentionSpan | null {
  for (const span of getResolvedMentionSpans(value, cartIds)) {
    if (direction === "backspace") {
      if (cursor > span.start && cursor <= span.end) return span;
    } else if (cursor >= span.start && cursor < span.end) {
      return span;
    }
  }
  return null;
}

export function removeMentionSpan(
  value: string,
  span: ResolvedMentionSpan,
): { value: string; cursor: number } {
  return {
    value: value.slice(0, span.start) + value.slice(span.end),
    cursor: span.start,
  };
}

function filterModelsNotMentioned(
  content: string,
  models: AiModel[],
  cartIds?: string[],
): AiModel[] {
  const mentioned = new Set(parseMentions(content, cartIds));
  return models.filter((model) => !mentioned.has(model.id));
}

export function isModelMentioned(
  content: string,
  modelId: string,
  cartIds?: string[],
): boolean {
  return parseMentions(content, cartIds).includes(modelId);
}

export type ResolveTargetOptions = {
  goal?: string | null;
  autoEnabled?: boolean;
  hasWorkspace?: boolean;
};

export function resolveTargetModelIds(
  content: string,
  cartSelectedIds: string[],
  roundTableActiveIds: string[],
  options?: ResolveTargetOptions,
): string[] {
  const cartIds = normalizeTargetModelIds(cartSelectedIds);
  const activeIds = normalizeTargetModelIds(roundTableActiveIds);
  const mentioned = normalizeTargetModelIds(parseMentions(content, cartSelectedIds));

  if (mentioned.length > 0) {
    if (options?.autoEnabled) {
      return mentioned.filter((id) => cartIds.includes(id));
    }
    const activeMentioned = mentioned.filter((id) => activeIds.includes(id));
    return activeMentioned.length > 0 ? activeMentioned : [];
  }

  if (options?.autoEnabled) {
    const rawCartCount = cartSelectedIds.filter((id) => id.trim()).length;
    if (cartIds.length === 0 && rawCartCount > 0) {
      return [];
    }
    return selectAutoModels({
      message: content,
      goal: options.goal,
      candidateIds: cartIds,
      hasWorkspace: options.hasWorkspace,
    });
  }

  return activeIds;
}

function buildMentionTextForModels(models: AiModel[]): string {
  if (models.length === 0) return "";
  return models.map((m) => mentionToken(m.id)).join(" ");
}

export function insertMentionsForModels(
  content: string,
  models: AiModel[],
  selectionStart: number,
  selectionEnd: number,
  cartIds?: string[],
): { value: string; cursor: number } | null {
  const toAdd = filterModelsNotMentioned(content, models, cartIds);
  if (toAdd.length === 0) return null;
  const mentionText = buildMentionTextForModels(toAdd);
  const insertion = mentionText.endsWith(" ") ? mentionText : `${mentionText} `;
  return insertTextAtCursor(
    content,
    insertion,
    selectionStart,
    selectionEnd,
  );
}

function insertTextAtCursor(
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
  cartIds?: string[],
): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  const between = before.slice(at + 1);
  if (/\s/.test(between)) return null;

  // Cursor is after a completed @mention token — not an active query
  const tokenMatch = value.slice(at + 1).match(/^([^\s@]*)/);
  if (tokenMatch && tokenMatch[1].length > 0) {
    const model = resolveMentionQuery(tokenMatch[1], cartIds);
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
