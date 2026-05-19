export function loadLayoutSizes(key: string, defaults: number[]): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as number[];
    if (
      !Array.isArray(parsed) ||
      parsed.length !== defaults.length ||
      parsed.some((n) => typeof n !== "number" || n <= 0)
    ) {
      return defaults;
    }
    const sum = parsed.reduce((a, b) => a + b, 0);
    if (sum <= 0) return defaults;
    return parsed.map((n) => n / sum);
  } catch {
    return defaults;
  }
}

export function saveLayoutSizes(key: string, sizes: number[]): void {
  localStorage.setItem(key, JSON.stringify(sizes));
}

export function loadLayoutPx(key: string, defaultPx: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultPx;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? n : defaultPx;
  } catch {
    return defaultPx;
  }
}

export function saveLayoutPx(key: string, px: number): void {
  localStorage.setItem(key, JSON.stringify(px));
}
