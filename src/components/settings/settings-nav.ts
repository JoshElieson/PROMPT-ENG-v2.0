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
      { id: "supabase", label: "Supabase Setup", icon: Database },
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
  rules: "Rules",
  docs: "Docs",
};
