export type GoToRecentKind = "agent" | "model" | "project";

export interface GoToRecents {
  agent: string[];
  model: string[];
  project: string[];
}

const STORAGE_KEY = "prompt:go-to-recents:v1";
const MAX_RECENTS = 8;

export const EMPTY_GO_TO_RECENTS: GoToRecents = {
  agent: [],
  model: [],
  project: [],
};

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= MAX_RECENTS) break;
  }
  return result;
}

export function loadGoToRecents(): GoToRecents {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_GO_TO_RECENTS };
    const parsed = JSON.parse(raw) as Partial<GoToRecents> | null;
    if (!parsed || typeof parsed !== "object") {
      return { ...EMPTY_GO_TO_RECENTS };
    }
    return {
      agent: sanitizeList(parsed.agent),
      model: sanitizeList(parsed.model),
      project: sanitizeList(parsed.project),
    };
  } catch {
    return { ...EMPTY_GO_TO_RECENTS };
  }
}

export function saveGoToRecents(recents: GoToRecents): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
  } catch {
    // Persistence is best-effort; ignore quota/availability failures.
  }
}

/** Returns a new recents object with `id` moved to the front of `kind`. */
export function pushGoToRecent(
  recents: GoToRecents,
  kind: GoToRecentKind,
  id: string,
): GoToRecents {
  if (!id) return recents;
  const next = [id, ...recents[kind].filter((existing) => existing !== id)].slice(
    0,
    MAX_RECENTS,
  );
  return { ...recents, [kind]: next };
}

/** Loads, updates, and persists a recent id in one call. */
export function recordGoToRecent(kind: GoToRecentKind, id: string): void {
  if (!id) return;
  const current = loadGoToRecents();
  const next = pushGoToRecent(current, kind, id);
  saveGoToRecents(next);
}
