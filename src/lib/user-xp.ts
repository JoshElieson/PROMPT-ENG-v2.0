export const XP_MAX_LEVEL = 10;
export const XP_MIN_LEVEL = 1;
/** Progress units from level 1 (0) through max level (9). */
export const XP_MAX_PROGRESS = XP_MAX_LEVEL - XP_MIN_LEVEL;
export const XP_GAIN_PER_AGENT = 0.5;

const STORAGE_KEY = "prompt:user-xp:v1";

type UserXpStore = Record<string, number>;

function readStore(): UserXpStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: UserXpStore = {};
    for (const [login, value] of Object.entries(parsed)) {
      if (typeof login === "string" && typeof value === "number" && Number.isFinite(value)) {
        out[login] = clampProgress(value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: UserXpStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage may be unavailable
  }
}

export function clampProgress(progress: number): number {
  return Math.min(XP_MAX_PROGRESS, Math.max(0, progress));
}

export function loadUserProgress(login: string): number {
  const store = readStore();
  return clampProgress(store[login] ?? 0);
}

export function saveUserProgress(login: string, progress: number): number {
  const next = clampProgress(progress);
  const store = readStore();
  store[login] = next;
  writeStore(store);
  return next;
}

export function addAgentXp(login: string): number {
  return saveUserProgress(login, loadUserProgress(login) + XP_GAIN_PER_AGENT);
}

export function getLevelFromProgress(progress: number): number {
  const clamped = clampProgress(progress);
  if (clamped >= XP_MAX_PROGRESS) return XP_MAX_LEVEL;
  return Math.floor(clamped) + XP_MIN_LEVEL;
}

/** Fill ratio within the current level (0–1). At max level, always 1. */
export function getLevelFillRatio(progress: number): number {
  const clamped = clampProgress(progress);
  if (clamped >= XP_MAX_PROGRESS) return 1;
  return clamped - Math.floor(clamped);
}

/** Bar color from blue (level 1) to red (level 10). */
export function getXpBarColor(level: number): string {
  const t = Math.min(1, Math.max(0, (level - XP_MIN_LEVEL) / (XP_MAX_LEVEL - XP_MIN_LEVEL)));
  const r = Math.round(59 + (239 - 59) * t);
  const g = Math.round(130 + (68 - 130) * t);
  const b = Math.round(246 + (68 - 246) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
