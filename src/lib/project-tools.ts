export interface ProjectToolsPatch {
  add?: string[];
  remove?: string[];
  set?: string[];
}

export function normalizeToolName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseToolsListAttribute(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;]+/)
    .map(normalizeToolName)
    .filter(Boolean);
}

export function dedupeProjectTools(tools: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tool of tools) {
    const name = normalizeToolName(tool);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function normalizeProjectTools(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const deduped = dedupeProjectTools(
    value.filter((item): item is string => typeof item === "string"),
  );
  return deduped.length > 0 ? deduped : undefined;
}

export function applyProjectToolsPatches(
  current: string[],
  patches: ProjectToolsPatch[],
): string[] {
  let next = dedupeProjectTools(current);
  for (const patch of patches) {
    if (patch.set) {
      next = dedupeProjectTools(patch.set);
      continue;
    }
    if (patch.remove?.length) {
      const removeKeys = new Set(
        patch.remove.map((name) => normalizeToolName(name).toLowerCase()),
      );
      next = next.filter((tool) => !removeKeys.has(tool.toLowerCase()));
    }
    if (patch.add?.length) {
      next = dedupeProjectTools([...next, ...patch.add]);
    }
  }
  return next;
}

export function formatProjectToolsPrompt(tools: string[]): string | null {
  if (tools.length === 0) return null;
  return `Project stack (prefer these technologies when building or recommending solutions): ${tools.join(", ")}`;
}

export const PROJECT_TOOLS_UPDATE_GUIDANCE =
  'When you adopt or remove a technology from the stack during implementation, emit a directive on its own line: [[FORGE_PROJECT_TOOLS add="Tool1,Tool2" remove="OldTool"]]. Use add/remove with comma-separated names; use set="A,B" only to replace the full list. Do this as part of completing the work—not as a separate proposal step.';
