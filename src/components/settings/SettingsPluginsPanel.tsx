import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { PluginIcon } from "@/components/settings/PluginIcon";
import {
  PLUGIN_GROUPS,
  RECOMMENDED_PLUGIN_IDS,
  getPluginById,
  isPluginInstallable,
  type PluginGroup,
  type PluginPlaceholder,
} from "@/data/plugins";
import {
  getDatabasePluginById,
  isDatabasePluginId,
} from "@/data/database-plugins";
import {
  installPlugin,
  uninstallPlugin,
  useInstalledPlugins,
} from "@/lib/installed-plugins";
import { cn } from "@/lib/utils";

type PluginFilter = "all" | "installed" | "recommended";

const PLUGIN_FILTERS: { id: PluginFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "installed", label: "Installed" },
  { id: "recommended", label: "Recommended" },
];

const PLUGIN_INSTALL_DURATION_MS = 3000;

function navigateToDatabasePluginSetup(pluginId: string): void {
  const plugin = getDatabasePluginById(pluginId);
  if (!plugin) return;
  window.dispatchEvent(
    new CustomEvent("forge:settings-navigate", {
      detail: { sectionId: plugin.sectionId },
    }),
  );
}

function pluginMatchesQuery(plugin: PluginPlaceholder, query: string): boolean {
  const haystack =
    `${plugin.name} ${plugin.id} ${plugin.description}`.toLowerCase();
  return haystack.includes(query);
}

function filterPluginsByTab(
  plugins: PluginPlaceholder[],
  filter: PluginFilter,
  installedIds: Set<string>,
): PluginPlaceholder[] {
  if (filter === "installed") {
    return plugins.filter((plugin) => installedIds.has(plugin.id));
  }
  if (filter === "recommended") {
    return plugins.filter((plugin) => RECOMMENDED_PLUGIN_IDS.has(plugin.id));
  }
  return plugins;
}

function PluginFilterTabs({
  filter,
  onFilterChange,
}: {
  filter: PluginFilter;
  onFilterChange: (filter: PluginFilter) => void;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="tablist"
      aria-label="Plugin filters"
      data-ai-target="settings.plugins.filters"
    >
      {PLUGIN_FILTERS.map((item) => {
        const active = filter === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onFilterChange(item.id)}
            data-ai-target={`settings.plugins.filter.${item.id}`}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              active
                ? "bg-panel-elevated text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function PluginsEmptyState() {
  return (
    <div className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">No Plugins</p>
      <p className="text-muted-foreground mt-2 max-w-md text-xs leading-relaxed">
        Browse the marketplace to extend Forge with skills, rules, agents, hooks,
        and MCPs.
      </p>
    </div>
  );
}

function PluginCard({
  plugin,
  installed,
  installing,
  onInstall,
  onUninstall,
}: {
  plugin: PluginPlaceholder;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  // Installed-but-unavailable plugins (from before status gating) keep Uninstall.
  const comingSoon = !isPluginInstallable(plugin) && !installed && !installing;

  return (
    <div
      className="border-border-subtle bg-panel/70 flex items-center gap-3 rounded-xl border p-3"
      data-ai-target={`settings.plugins.${plugin.id}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
        <PluginIcon
          pluginId={plugin.id}
          fallback={plugin.icon}
          className="h-5 w-5"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{plugin.name}</p>
        <p className="text-muted-foreground truncate text-xs leading-relaxed">
          {plugin.description}
        </p>
      </div>
      <button
        type="button"
        onClick={installed ? onUninstall : onInstall}
        disabled={installing || comingSoon}
        aria-label={
          installing
            ? `Installing ${plugin.name}`
            : installed
              ? `Uninstall ${plugin.name}`
              : comingSoon
                ? `${plugin.name} coming soon`
                : `Get ${plugin.name}`
        }
        aria-busy={installing}
        data-ai-target={`settings.plugins.${plugin.id}.${installing ? "installing" : installed ? "uninstall" : comingSoon ? "coming-soon" : "install"}`}
        className={cn(
          "inline-flex min-w-[4.25rem] shrink-0 items-center justify-center rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
          installing && "cursor-wait opacity-80",
          comingSoon
            ? "bg-panel-elevated/50 text-muted-foreground/70 cursor-default"
            : installed || installing
              ? "bg-panel-elevated text-muted-foreground hover:text-foreground"
              : "bg-panel-elevated/90 text-foreground hover:bg-panel-elevated",
          installing && "hover:text-muted-foreground",
        )}
      >
        {installing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : installed ? (
          "Uninstall"
        ) : comingSoon ? (
          "Soon"
        ) : (
          "Get"
        )}
      </button>
    </div>
  );
}

function PluginGroupSection({
  group,
  installedIds,
  installingIds,
  onInstall,
  onUninstall,
}: {
  group: PluginGroup;
  installedIds: Set<string>;
  installingIds: Set<string>;
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
}) {
  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide">
        {group.label}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {group.plugins.map((plugin) => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            installed={installedIds.has(plugin.id)}
            installing={installingIds.has(plugin.id)}
            onInstall={() => onInstall(plugin.id)}
            onUninstall={() => onUninstall(plugin.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function SettingsPluginsPanel() {
  const installTimeoutsRef = useRef<Map<string, number>>(new Map());
  const installingRef = useRef<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<PluginFilter>("all");
  const installedIds = useInstalledPlugins();
  const [installingIds, setInstallingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const timeouts = installTimeoutsRef.current;
    return () => {
      for (const timeoutId of timeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      timeouts.clear();
    };
  }, []);

  const handleInstallPlugin = (pluginId: string) => {
    if (installedIds.has(pluginId) || installingRef.current.has(pluginId)) return;
    const plugin = getPluginById(pluginId);
    if (!plugin || !isPluginInstallable(plugin)) return;

    installingRef.current.add(pluginId);
    setInstallingIds((current) => {
      const next = new Set(current);
      next.add(pluginId);
      return next;
    });

    const timeoutId = window.setTimeout(() => {
      installTimeoutsRef.current.delete(pluginId);
      installingRef.current.delete(pluginId);
      setInstallingIds((current) => {
        const next = new Set(current);
        next.delete(pluginId);
        return next;
      });
      installPlugin(pluginId);
      if (isDatabasePluginId(pluginId)) {
        navigateToDatabasePluginSetup(pluginId);
      }
    }, PLUGIN_INSTALL_DURATION_MS);

    installTimeoutsRef.current.set(pluginId, timeoutId);
  };

  const handleUninstallPlugin = (pluginId: string) => {
    const pendingTimeout = installTimeoutsRef.current.get(pluginId);
    if (pendingTimeout !== undefined) {
      window.clearTimeout(pendingTimeout);
      installTimeoutsRef.current.delete(pluginId);
      installingRef.current.delete(pluginId);
      setInstallingIds((current) => {
        const next = new Set(current);
        next.delete(pluginId);
        return next;
      });
      return;
    }

    uninstallPlugin(pluginId);
  };

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return PLUGIN_GROUPS.map((group) => {
      let plugins = filterPluginsByTab(group.plugins, filter, installedIds);

      if (query) {
        const groupMatches = group.label.toLowerCase().includes(query);
        plugins = groupMatches
          ? plugins
          : plugins.filter((plugin) => pluginMatchesQuery(plugin, query));
      }

      if (plugins.length === 0) return null;
      return { ...group, plugins };
    }).filter((group): group is PluginGroup => group != null);
  }, [filter, installedIds, searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const showInstalledEmptyState =
    filter === "installed" && installedIds.size === 0 && !trimmedSearch;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PluginFilterTabs filter={filter} onFilterChange={setFilter} />

        <div
          className="border-border-subtle bg-panel/80 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 sm:w-56 sm:flex-initial"
          data-ai-target="settings.plugins.search"
        >
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for tools"
            className="placeholder:text-muted-foreground/70 text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {trimmedSearch ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {showInstalledEmptyState ? (
        <PluginsEmptyState />
      ) : filteredGroups.length === 0 ? (
        <div className="border-border-subtle bg-panel/60 flex flex-col items-center justify-center rounded-xl border px-6 py-16 text-center">
          <Search className="text-muted-foreground mb-3 h-8 w-8 opacity-60" />
          <p className="text-sm font-medium text-foreground">No matching plugins</p>
          <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
            Try a different filter, plugin name, or category.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8" data-ai-target="settings.plugins.list">
          {filteredGroups.map((group) => (
            <PluginGroupSection
              key={group.label}
              group={group}
              installedIds={installedIds}
              installingIds={installingIds}
              onInstall={handleInstallPlugin}
              onUninstall={handleUninstallPlugin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

