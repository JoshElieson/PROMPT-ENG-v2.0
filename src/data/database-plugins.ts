import type { SettingsSectionId } from "@/components/settings/settings-nav";

export const DATABASE_PLUGINS = [
  { id: "supabase", sectionId: "supabase", label: "Supabase Setup" },
  { id: "neon", sectionId: "neon", label: "Neon Setup" },
  { id: "planetscale", sectionId: "planetscale", label: "PlanetScale Setup" },
  { id: "mongodb-atlas", sectionId: "mongodb-atlas", label: "MongoDB Atlas Setup" },
] as const satisfies ReadonlyArray<{
  id: string;
  sectionId: SettingsSectionId;
  label: string;
}>;

export type DatabasePluginId = (typeof DATABASE_PLUGINS)[number]["id"];
export type DatabasePluginSectionId = (typeof DATABASE_PLUGINS)[number]["sectionId"];

/** Pre-installed on first launch. Other database plugins require explicit install. */
export const DEFAULT_INSTALLED_DATABASE_PLUGIN_IDS = [
  "supabase",
] as const satisfies readonly DatabasePluginId[];

export const SUPABASE_PLUGIN_ID: DatabasePluginId = "supabase";

export const DATABASE_PLUGIN_IDS = new Set<string>(
  DATABASE_PLUGINS.map((plugin) => plugin.id),
);

const SECTION_TO_PLUGIN = new Map<DatabasePluginSectionId, (typeof DATABASE_PLUGINS)[number]>(
  DATABASE_PLUGINS.map((plugin) => [plugin.sectionId, plugin]),
);

export function isDatabasePluginId(pluginId: string): pluginId is DatabasePluginId {
  return DATABASE_PLUGIN_IDS.has(pluginId);
}

export function isDatabasePluginSectionId(
  sectionId: SettingsSectionId,
): sectionId is DatabasePluginSectionId {
  return SECTION_TO_PLUGIN.has(sectionId as DatabasePluginSectionId);
}

export function getDatabasePluginById(pluginId: string) {
  return DATABASE_PLUGINS.find((plugin) => plugin.id === pluginId);
}

export function getDatabasePluginBySectionId(sectionId: SettingsSectionId) {
  if (!isDatabasePluginSectionId(sectionId)) return undefined;
  return SECTION_TO_PLUGIN.get(sectionId);
}

export function isDatabasePluginSectionInstalled(
  sectionId: SettingsSectionId,
  installedPluginIds: Set<string>,
): boolean {
  const plugin = getDatabasePluginBySectionId(sectionId);
  return plugin ? installedPluginIds.has(plugin.id) : false;
}
