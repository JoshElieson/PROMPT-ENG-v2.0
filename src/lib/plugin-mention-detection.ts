import { PLUGIN_CATALOG, type PluginPlaceholder } from "@/data/plugins";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWordBoundaryMatch(text: string, term: string): boolean {
  if (!term) return false;
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(text);
}

function matchesPluginMention(text: string, plugin: PluginPlaceholder): boolean {
  const normalized = text.toLowerCase();
  const name = plugin.name.toLowerCase();
  const id = plugin.id.toLowerCase();

  if (name.includes(" ") || name.includes("(")) {
    if (normalized.includes(name)) return true;
    const simplified = name.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    if (simplified !== name && normalized.includes(simplified)) return true;
  }

  if (hasWordBoundaryMatch(normalized, name)) return true;

  const idSpaced = id.replace(/-/g, " ");
  if (idSpaced !== id && hasWordBoundaryMatch(normalized, idSpaced)) return true;
  if (hasWordBoundaryMatch(normalized, id)) return true;

  return false;
}

export function findUninstalledPluginMention(
  text: string,
  installedIds: Set<string>,
): PluginPlaceholder | null {
  if (!text.trim()) return null;

  const candidates = PLUGIN_CATALOG
    .filter((plugin) => !installedIds.has(plugin.id))
    .sort((a, b) => b.name.length - a.name.length);

  for (const plugin of candidates) {
    if (matchesPluginMention(text, plugin)) {
      return plugin;
    }
  }

  return null;
}
