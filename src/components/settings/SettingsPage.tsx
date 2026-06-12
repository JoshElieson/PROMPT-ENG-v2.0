import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  ExternalLink,
  LayoutGrid,
  Palette,
  Search,
  Settings,
  X,
} from "lucide-react";
import { LayoutPicker } from "@/components/layout/LayoutPicker";
import { SettingsAgentsPanel } from "@/components/settings/SettingsAgentsPanel";
import { SettingsAutomationPanel } from "@/components/settings/SettingsAutomationPanel";
import { SettingsDocsPanel } from "@/components/settings/SettingsDocsPanel";
import { SettingsGeneralPanel } from "@/components/settings/SettingsGeneralPanel";
import {
  PLUGIN_SEARCH_TERMS,
  SettingsPluginsPanel,
} from "@/components/settings/SettingsPluginsPanel";
import { SettingsRulesPanel } from "@/components/settings/SettingsRulesPanel";
import { SettingsPlanUsagePanel } from "@/components/settings/SettingsPlanUsagePanel";
import { SupabaseSetupAssistant } from "@/components/settings/SupabaseSetupAssistant";
import {
  SETTINGS_NAV_GROUPS,
  SETTINGS_SECTION_LABELS,
  type SettingsNavItem,
  type SettingsSectionId,
} from "@/components/settings/settings-nav";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { popularAiModels } from "@/data/ai-models";
import { useLayout } from "@/contexts/LayoutContext";
import { cn } from "@/lib/utils";

interface SettingsSearchResult {
  id: string;
  sectionId: SettingsSectionId;
  label: string;
  keywords: string;
  sectionLabel: string;
}

const RULES_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "New rule",
    keywords: "rules create tone style language response instructions",
  },
  {
    label: "User rules",
    keywords: "rules preferences instructions persistent agent behavior",
  },
];

const AUTOMATION_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "New automation",
    keywords: "automation create schedule trigger agent task",
  },
  {
    label: "Time based trigger",
    keywords: "automation schedule daily weekly hourly time cron",
  },
  {
    label: "Agent completion trigger",
    keywords: "automation agent complete finish project watch",
  },
  {
    label: "Event based trigger",
    keywords: "automation event git commit file change branch pull request",
  },
  {
    label: "Agent task",
    keywords: "automation task instructions prompt agent run",
  },
];

const PLAN_USAGE_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "Tokens sent",
    keywords: "usage tokens sent input models api cost",
  },
  {
    label: "Usage by model",
    keywords: "usage model tokens per model breakdown",
  },
  {
    label: "Reset usage",
    keywords: "reset usage tokens clear statistics",
  },
  {
    label: "See Pricing Plans",
    keywords: "premium pricing plans upgrade billing subscription",
  },
];

const APPEARANCE_SETTING_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "Theme",
    keywords: "theme dark dark blue light appearance color",
  },
  {
    label: "Vertical Default",
    keywords: "layout vertical default workspace panels appearance",
  },
  {
    label: "Horizontal Default",
    keywords: "layout horizontal default workspace panels appearance",
  },
];

const DOCS_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "View Full Documentation",
    keywords: "docs documentation guides help reference forge",
  },
];

const GENERAL_SETTING_SEARCH_TERMS: Array<{
  label: string;
  keywords: string;
}> = [
  {
    label: "Forge Account",
    keywords: "account billing manage open external link",
  },
  {
    label: "System Notifications",
    keywords: "notifications system agent complete attention",
  },
  {
    label: "Automation Notifications",
    keywords: "notifications automation complete finished background task",
  },
  {
    label: "Warning Notifications",
    keywords: "notifications warning toasts in-app",
  },
  {
    label: "System Tray Icon",
    keywords: "tray icon background app",
  },
  {
    label: "Completion Sound",
    keywords: "sound completion finish done",
  },
  {
    label: "Data Sharing",
    keywords: "privacy share data telemetry models",
  },
  {
    label: "Log Out",
    keywords: "logout sign out account session",
  },
];

const NAV_SEARCH_INDEX: SettingsSearchResult[] = SETTINGS_NAV_GROUPS.flatMap((group) =>
  group.items.map((item: SettingsNavItem) => ({
    id: `section-${item.id}`,
    sectionId: item.id,
    label: item.label,
    keywords: item.label.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS[item.id],
  })),
);

const SETTINGS_SEARCH_INDEX: SettingsSearchResult[] = [
  ...NAV_SEARCH_INDEX,
  ...GENERAL_SETTING_SEARCH_TERMS.map((item, index) => ({
    id: `general-setting-${index}`,
    sectionId: "general" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS.general,
  })),
  ...PLAN_USAGE_SEARCH_TERMS.map((item, index) => ({
    id: `plan-usage-setting-${index}`,
    sectionId: "plan-usage" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS["plan-usage"],
  })),
  ...AUTOMATION_SEARCH_TERMS.map((item, index) => ({
    id: `automation-setting-${index}`,
    sectionId: "automation" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS.automation,
  })),
  ...RULES_SEARCH_TERMS.map((item, index) => ({
    id: `rules-setting-${index}`,
    sectionId: "rules" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS.rules,
  })),
  ...APPEARANCE_SETTING_SEARCH_TERMS.map((item, index) => ({
    id: `appearance-setting-${index}`,
    sectionId: "appearance" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS.appearance,
  })),
  ...DOCS_SEARCH_TERMS.map((item, index) => ({
    id: `docs-setting-${index}`,
    sectionId: "docs" as const,
    label: item.label,
    keywords: item.keywords.toLowerCase(),
    sectionLabel: SETTINGS_SECTION_LABELS.docs,
  })),
  ...PLUGIN_SEARCH_TERMS.map((item, index) => ({
    id: `plugins-setting-${index}`,
    sectionId: "plugins" as const,
    label: item.label,
    keywords: item.keywords,
    sectionLabel: SETTINGS_SECTION_LABELS.plugins,
  })),
];

function SettingsPlaceholderPanel({ sectionId }: { sectionId: SettingsSectionId }) {
  const label = SETTINGS_SECTION_LABELS[sectionId];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center py-24 text-center">
      <div className="border-border-subtle bg-panel/50 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border">
        <Settings className="text-muted-foreground h-5 w-5" />
      </div>
      <h2 className="text-lg font-medium text-foreground">{label}</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        Settings for {label.toLowerCase()} will appear here.
      </p>
    </div>
  );
}

function SettingsModelsPanel() {
  const { settings, setSetting } = useAppSettings();
  const modelOptions = popularAiModels.map((model) => ({
    id: model.id,
    label: `${model.name} (${model.provider})`,
  }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.models.default-model"
      >
        <div className="mb-2 flex items-center gap-2">
          <Brain className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium text-foreground">Default Model</p>
        </div>
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          Choose the model Forge should prefer when AI picks a single model for you.
        </p>
        <select
          value={settings.defaultModel}
          onChange={(event) => setSetting("defaultModel", event.target.value)}
          className="border-border-subtle bg-panel-elevated/80 text-foreground focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none"
        >
          {modelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}

function SettingsAppearancePanel() {
  const { settings, setSetting } = useAppSettings();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.appearance.theme"
      >
        <div className="mb-2 flex items-center gap-2">
          <Palette className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium text-foreground">Theme</p>
        </div>
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          Choose how Forge renders app surfaces and highlights.
        </p>
        <select
          value={settings.theme}
          onChange={(event) =>
            setSetting("theme", event.target.value as "light" | "dark" | "dark-blue")
          }
          className="border-border-subtle bg-panel-elevated/80 text-foreground focus:border-[#6366f1]/60 h-9 w-full rounded-md border px-2 text-xs outline-none"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="dark-blue">Dark Blue</option>
        </select>
      </section>

      <section
        className="border-border-subtle bg-panel/60 rounded-xl border p-4"
        data-ai-target="settings.appearance.layout"
      >
        <div className="mb-2 flex items-center gap-2">
          <LayoutGrid className="text-muted-foreground h-4 w-4" />
          <p className="text-sm font-medium text-foreground">Layout</p>
        </div>
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          Choose how workspace panels are arranged, or save up to two custom layouts.
        </p>
        <LayoutPicker variant="settings" />
      </section>
    </div>
  );
}

function SettingsContent({ sectionId }: { sectionId: SettingsSectionId }) {
  const title = SETTINGS_SECTION_LABELS[sectionId];

  return (
    <div className={cn(
      "min-h-0 flex-1 px-10 py-8",
      sectionId === "supabase" ? "overflow-hidden flex flex-col h-full" : "overflow-y-auto"
    )}>
      <h1 className={cn(
        "text-2xl font-semibold tracking-tight text-foreground",
        sectionId === "supabase" ? "mb-4 shrink-0" : "mb-8"
      )}>
        {title}
      </h1>
      {sectionId === "general" && <SettingsGeneralPanel />}
      {sectionId === "models" && <SettingsModelsPanel />}
      {sectionId === "appearance" && <SettingsAppearancePanel />}
      {sectionId === "plan-usage" && <SettingsPlanUsagePanel />}
      {sectionId === "automation" && <SettingsAutomationPanel />}
      {sectionId === "agents" && <SettingsAgentsPanel />}
      {sectionId === "docs" && <SettingsDocsPanel />}
      {sectionId === "plugins" && <SettingsPluginsPanel />}
      {sectionId === "supabase" && <SupabaseSetupAssistant />}
      {sectionId === "rules" && <SettingsRulesPanel />}
      {sectionId !== "general" &&
        sectionId !== "models" &&
        sectionId !== "appearance" &&
        sectionId !== "plan-usage" &&
        sectionId !== "automation" &&
        sectionId !== "agents" &&
        sectionId !== "docs" &&
        sectionId !== "plugins" &&
        sectionId !== "supabase" &&
        sectionId !== "rules" && (
          <SettingsPlaceholderPanel sectionId={sectionId} />
        )}
    </div>
  );
}

function SettingsNav({
  activeSection,
  onSectionChange,
  onBack,
}: {
  activeSection: SettingsSectionId;
  onSectionChange: (id: SettingsSectionId) => void;
  onBack: () => void;
}) {
  const { session } = useAuth();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const displayName =
    session?.user.name ?? session?.user.login ?? "Guest";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmedSearch) return [];
    return SETTINGS_SEARCH_INDEX.filter((entry) => {
      const label = entry.label.toLowerCase();
      return (
        label.includes(trimmedSearch) || entry.keywords.includes(trimmedSearch)
      );
    }).slice(0, 8);
  }, [trimmedSearch]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  const openAndFocusSearch = () => {
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const selectSearchResult = (sectionId: SettingsSectionId) => {
    onSectionChange(sectionId);
    closeSearch();
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "Enter" && searchResults[0]) {
      event.preventDefault();
      selectSearchResult(searchResults[0].sectionId);
    }
  };

  return (
    <nav className="border-border-subtle bg-surface/95 flex w-56 shrink-0 flex-col border-r">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            data-ai-target="settings.nav.back"
            className={cn(
              "text-muted-foreground hover:bg-panel-elevated/70 hover:text-foreground flex cursor-pointer items-center justify-start gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors",
              !searchOpen && "min-w-0 flex-1",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div
            className={cn(
              "relative min-w-0",
              searchOpen ? "flex-1" : "w-7 shrink-0",
            )}
          >
            <button
              type="button"
              onClick={openAndFocusSearch}
              className={cn(
                "text-muted-foreground hover:bg-panel-elevated/70 hover:text-foreground absolute top-0 right-0 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                searchOpen && "opacity-0 pointer-events-none",
              )}
              title="Search settings"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <div
              className={cn(
                "border-border-subtle bg-panel/80 flex h-7 items-center gap-1.5 rounded-lg border pr-1 pl-2 transition-all",
                searchOpen ? "w-full opacity-100" : "w-0 opacity-0",
              )}
            >
              <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search settings"
                className="placeholder:text-muted-foreground/70 text-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded transition-colors"
                title="Close search"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        {searchOpen && trimmedSearch ? (
          <div className="mb-3 flex flex-col gap-1">
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => selectSearchResult(result.sectionId)}
                  className="text-muted-foreground hover:bg-panel-elevated/70 hover:text-foreground flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors"
                >
                  <span className="truncate">{result.label}</span>
                  <span className="text-muted-foreground/70 ml-2 shrink-0">
                    {result.sectionLabel}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-muted-foreground px-2 py-1 text-xs">
                No matching settings
              </p>
            )}
          </div>
        ) : null}
        {SETTINGS_NAV_GROUPS.map((group, groupIndex) => (
          <div
            key={`group-${groupIndex}`}
            className={cn(groupIndex > 0 && "mt-6")}
          >
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSectionChange(item.id)}
                      data-ai-target={`settings.nav.${item.id}`}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        active
                          ? "bg-panel-elevated/90 text-foreground"
                          : "text-muted-foreground hover:bg-panel-elevated/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.external ? (
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border-subtle mt-auto flex items-center gap-2 border-t px-3 py-3">
        <div className="bg-panel-elevated flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {displayName}
          </p>
          <p className="text-muted-foreground truncate text-[10px]">
            {session ? "Signed in" : "Not signed in"}
          </p>
        </div>
        <button
          type="button"
          title="Account"
          className="text-muted-foreground hover:bg-panel-elevated/70 hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}

export function SettingsPage() {
  const { closeSettings } = useLayout();
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general");

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const custom = event as CustomEvent<{ sectionId?: SettingsSectionId }>;
      const sectionId = custom.detail?.sectionId;
      if (!sectionId) return;
      if (SETTINGS_SECTION_LABELS[sectionId]) {
        setActiveSection(sectionId);
      }
    };
    window.addEventListener("forge:settings-navigate", onNavigate as EventListener);
    return () =>
      window.removeEventListener(
        "forge:settings-navigate",
        onNavigate as EventListener,
      );
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("forge:settings-section-changed", {
        detail: { sectionId: activeSection },
      }),
    );
  }, [activeSection]);

  return (
    <div
      className="bg-background flex min-h-0 min-w-0 flex-1 overflow-hidden"
      data-ai-scope="settings"
    >
      <SettingsNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={closeSettings}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SettingsContent sectionId={activeSection} />
      </div>
    </div>
  );
}
