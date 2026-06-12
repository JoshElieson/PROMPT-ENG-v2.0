import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Brain,
  Database,
  Palette,
  Puzzle,
  Repeat2,
  ScrollText,
  Settings2,
  Workflow,
  Zap,
} from "lucide-react";
import { DATABASE_PLUGINS } from "@/data/database-plugins";

export type SettingsSectionId =
  | "general"
  | "appearance"
  | "plan-usage"
  | "automation"
  | "agents"
  | "workflows"
  | "models"
  | "plugins"
  | "supabase"
  | "neon"
  | "planetscale"
  | "mongodb-atlas"
  | "rules"
  | "docs";

export interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

export interface SettingsNavGroup {
  label?: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    items: [
      { id: "general", label: "General", icon: Settings2 },
      { id: "appearance", label: "Appearance", icon: Palette },
    ],
  },
  {
    items: [
      { id: "plan-usage", label: "Plan & Usage", icon: Zap },
      { id: "agents", label: "Agents", icon: Bot },
      { id: "workflows", label: "Workflows", icon: Workflow },
      { id: "models", label: "Models", icon: Brain },
    ],
  },
  {
    items: [
      { id: "plugins", label: "Plugins", icon: Puzzle },
      { id: "automation", label: "Automation", icon: Repeat2 },
      { id: "rules", label: "Rules", icon: ScrollText },
    ],
  },
  {
    items: [
      { id: "docs", label: "Docs", icon: BookOpen, external: true },
    ],
  },
];

export function buildSettingsNavGroups(
  installedPluginIds: Set<string>,
): SettingsNavGroup[] {
  return SETTINGS_NAV_GROUPS.map((group) => {
    const pluginsIndex = group.items.findIndex((item) => item.id === "plugins");
    if (pluginsIndex === -1) return group;

    const databaseNavItems: SettingsNavItem[] = DATABASE_PLUGINS.filter((plugin) =>
      installedPluginIds.has(plugin.id),
    ).map((plugin) => ({
      id: plugin.sectionId,
      label: plugin.label,
      icon: Database,
    }));

    if (databaseNavItems.length === 0) return group;

    const items = [...group.items];
    items.splice(pluginsIndex + 1, 0, ...databaseNavItems);
    return { ...group, items };
  });
}

export const SETTINGS_SECTION_LABELS: Record<SettingsSectionId, string> = {
  general: "General",
  appearance: "Appearance",
  "plan-usage": "Plan & Usage",
  automation: "Automation",
  agents: "Agents",
  workflows: "Workflows",
  models: "Models",
  plugins: "Plugins",
  supabase: "Supabase Setup",
  neon: "Neon Setup",
  planetscale: "PlanetScale Setup",
  "mongodb-atlas": "MongoDB Atlas Setup",
  rules: "Rules",
  docs: "Docs",
};
