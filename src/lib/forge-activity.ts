export type ForgeActivityAction = "read" | "write";

export interface ForgeActivity {
  action: ForgeActivityAction;
  path: string;
  added?: number;
  removed?: number;
}

const FORGE_ACTIVITY_RE = /^\s*\[\[FORGE_ACTIVITY\s+(\{.+\})\]\]\s*$/;

export function extractForgeActivities(content: string): {
  body: string;
  activities: ForgeActivity[];
} {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const activities: ForgeActivity[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(FORGE_ACTIVITY_RE);
    if (!match) {
      bodyLines.push(line);
      continue;
    }
    try {
      const parsed = JSON.parse(match[1]) as Partial<ForgeActivity>;
      if (
        (parsed.action === "read" || parsed.action === "write") &&
        typeof parsed.path === "string" &&
        parsed.path.trim().length > 0
      ) {
        activities.push({
          action: parsed.action,
          path: parsed.path,
          added:
            typeof parsed.added === "number" && Number.isFinite(parsed.added)
              ? Math.max(0, Math.round(parsed.added))
              : undefined,
          removed:
            typeof parsed.removed === "number" && Number.isFinite(parsed.removed)
              ? Math.max(0, Math.round(parsed.removed))
              : undefined,
        });
        continue;
      }
    } catch {
      // Ignore malformed activity lines and show raw text.
    }
    bodyLines.push(line);
  }

  return {
    body: bodyLines.join("\n").trim(),
    activities,
  };
}
