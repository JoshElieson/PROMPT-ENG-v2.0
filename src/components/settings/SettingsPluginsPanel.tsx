import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  Bug,
  ChartPie,
  Cloud,
  Container,
  CreditCard,
  Database,
  FlaskConical,
  Globe,
  KeyRound,
  LayoutDashboard,
  LineChart,
  ListTodo,
  Loader2,
  MessageCircle,
  MessageSquare,
  PenTool,
  Plane,
  PlugZap,
  Route,
  Search,
  Shield,
  Sparkles,
  StickyNote,
  TrainFront,
  Triangle,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { PluginIcon } from "@/components/settings/PluginIcon";
import { cn } from "@/lib/utils";

type PluginFilter = "all" | "installed" | "recommended";

const PLUGIN_FILTERS: { id: PluginFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "installed", label: "Installed" },
  { id: "recommended", label: "Recommended" },
];

const RECOMMENDED_PLUGIN_IDS = new Set([
  "mcp-manager",
  "docker",
  "figma",
  "excalidraw",
  "slack",
  "linear",
  "vercel",
  "supabase",
  "openai",
  "sentry",
]);

interface PluginPlaceholder {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

interface PluginGroup {
  label: string;
  plugins: PluginPlaceholder[];
}

const PLUGIN_GROUPS: PluginGroup[] = [
  {
    label: "Built-in tools",
    plugins: [
      {
        id: "mcp-manager",
        name: "MCP Manager",
        description: "Install and configure Model Context Protocol servers for agents.",
        icon: PlugZap,
      },
      {
        id: "api-tester",
        name: "API Tester",
        description: "Send HTTP requests and inspect responses without leaving Forge.",
        icon: FlaskConical,
      },
      {
        id: "docker",
        name: "Docker",
        description: "Manage containers, images, and compose stacks from the workspace.",
        icon: Container,
      },
      {
        id: "import-ai-models",
        name: "Import AI Model(s)",
        description: "Add custom or third-party models to use alongside built-in options.",
        icon: Brain,
      },
    ],
  },
  {
    label: "Design & collaboration",
    plugins: [
      {
        id: "figma",
        name: "Figma",
        description: "Import designs and sync components from Figma into your workspace.",
        icon: PenTool,
      },
      {
        id: "excalidraw",
        name: "Excalidraw",
        description: "Create and edit hand-drawn diagrams and whiteboards in Forge.",
        icon: StickyNote,
      },
      {
        id: "miro",
        name: "Miro",
        description: "Import boards and collaborate on visual planning from Miro.",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Databases",
    plugins: [
      {
        id: "supabase",
        name: "Supabase",
        description: "Connect projects to Supabase for database, auth, and storage.",
        icon: Database,
      },
      {
        id: "neon",
        name: "Neon",
        description: "Manage serverless Postgres branches and databases from Neon.",
        icon: Database,
      },
      {
        id: "planetscale",
        name: "PlanetScale",
        description: "Connect to PlanetScale for scalable MySQL workflows.",
        icon: Database,
      },
      {
        id: "mongodb-atlas",
        name: "MongoDB Atlas",
        description: "Browse collections and manage MongoDB Atlas clusters.",
        icon: Database,
      },
    ],
  },
  {
    label: "Hosting & deploy",
    plugins: [
      {
        id: "vercel",
        name: "Vercel",
        description: "Deploy previews and production builds to Vercel.",
        icon: Triangle,
      },
      {
        id: "netlify",
        name: "Netlify",
        description: "Deploy sites and manage Netlify projects from Forge.",
        icon: Globe,
      },
      {
        id: "railway",
        name: "Railway",
        description: "Provision services and deploy apps on Railway.",
        icon: TrainFront,
      },
      {
        id: "render",
        name: "Render",
        description: "Manage Render services, deploys, and environment variables.",
        icon: Cloud,
      },
      {
        id: "fly-io",
        name: "Fly.io",
        description: "Deploy and scale apps globally on Fly.io machines.",
        icon: Plane,
      },
    ],
  },
  {
    label: "Cloud providers",
    plugins: [
      {
        id: "aws",
        name: "AWS",
        description: "Interact with Amazon Web Services resources and deployments.",
        icon: Cloud,
      },
      {
        id: "google-cloud",
        name: "Google Cloud",
        description: "Manage Google Cloud projects, services, and credentials.",
        icon: Cloud,
      },
      {
        id: "microsoft-azure",
        name: "Microsoft Azure",
        description: "Connect Azure subscriptions and cloud resources to Forge.",
        icon: Cloud,
      },
      {
        id: "cloudflare",
        name: "Cloudflare",
        description: "Manage DNS, Workers, and edge services on Cloudflare.",
        icon: Cloud,
      },
    ],
  },
  {
    label: "Project management",
    plugins: [
      {
        id: "linear",
        name: "Linear",
        description: "Sync issues, cycles, and project updates from Linear.",
        icon: ListTodo,
      },
      {
        id: "jira",
        name: "Jira",
        description: "Track Jira issues, sprints, and boards alongside your code.",
        icon: ListTodo,
      },
      {
        id: "trello",
        name: "Trello",
        description: "Import Trello boards and cards into your workflow.",
        icon: LayoutDashboard,
      },
      {
        id: "asana",
        name: "Asana",
        description: "Connect Asana tasks and projects to agent workflows.",
        icon: ListTodo,
      },
    ],
  },
  {
    label: "Communication",
    plugins: [
      {
        id: "slack",
        name: "Slack",
        description: "Send updates and receive notifications in Slack channels.",
        icon: MessageSquare,
      },
      {
        id: "discord",
        name: "Discord",
        description: "Post agent results and alerts to Discord servers.",
        icon: MessageCircle,
      },
      {
        id: "microsoft-teams",
        name: "Microsoft Teams",
        description: "Share automation output and alerts in Microsoft Teams.",
        icon: Users,
      },
    ],
  },
  {
    label: "AI providers",
    plugins: [
      {
        id: "openai",
        name: "OpenAI",
        description: "Connect OpenAI API keys and models for agent tasks.",
        icon: Sparkles,
      },
      {
        id: "anthropic",
        name: "Anthropic",
        description: "Use Anthropic Claude models with your Forge agents.",
        icon: Bot,
      },
      {
        id: "google-ai-studio",
        name: "Google AI Studio",
        description: "Access Gemini and other Google AI Studio models.",
        icon: Sparkles,
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        description: "Route requests across many models through OpenRouter.",
        icon: Route,
      },
      {
        id: "hugging-face",
        name: "Hugging Face",
        description: "Browse and run models from the Hugging Face Hub.",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Authentication",
    plugins: [
      {
        id: "clerk",
        name: "Clerk",
        description: "Integrate Clerk user management and authentication flows.",
        icon: KeyRound,
      },
      {
        id: "auth0",
        name: "Auth0",
        description: "Connect Auth0 tenants, apps, and identity settings.",
        icon: Shield,
      },
      {
        id: "firebase-authentication",
        name: "Firebase Authentication",
        description: "Manage Firebase Auth users and sign-in providers.",
        icon: Shield,
      },
    ],
  },
  {
    label: "Payments",
    plugins: [
      {
        id: "stripe",
        name: "Stripe",
        description: "Inspect payments, subscriptions, and Stripe webhooks.",
        icon: CreditCard,
      },
      {
        id: "paypal",
        name: "PayPal",
        description: "Connect PayPal commerce and payout workflows.",
        icon: Wallet,
      },
      {
        id: "lemon-squeezy",
        name: "Lemon Squeezy",
        description: "Manage Lemon Squeezy products, orders, and subscriptions.",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Analytics & monitoring",
    plugins: [
      {
        id: "posthog",
        name: "PostHog",
        description: "View product analytics and feature flags from PostHog.",
        icon: BarChart3,
      },
      {
        id: "mixpanel",
        name: "Mixpanel",
        description: "Explore event analytics and funnels from Mixpanel.",
        icon: LineChart,
      },
      {
        id: "google-analytics",
        name: "Google Analytics",
        description: "Pull traffic and conversion metrics from Google Analytics.",
        icon: ChartPie,
      },
      {
        id: "sentry",
        name: "Sentry",
        description: "Monitor errors, releases, and performance in Sentry.",
        icon: Bug,
      },
      {
        id: "datadog",
        name: "Datadog",
        description: "Inspect logs, metrics, and alerts from Datadog.",
        icon: Activity,
      },
      {
        id: "logrocket",
        name: "LogRocket",
        description: "Review session replays and frontend diagnostics in LogRocket.",
        icon: Video,
      },
    ],
  },
];

const INSTALLED_PLUGINS_STORAGE_KEY = "prompt:installed-plugins:v1";

function readInstalledPluginIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INSTALLED_PLUGINS_STORAGE_KEY);
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeInstalledPluginIds(ids: Set<string>) {
  localStorage.setItem(
    INSTALLED_PLUGINS_STORAGE_KEY,
    JSON.stringify([...ids]),
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

const PLUGIN_INSTALL_DURATION_MS = 3000;

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
        disabled={installing}
        aria-label={
          installing
            ? `Installing ${plugin.name}`
            : installed
              ? `Uninstall ${plugin.name}`
              : `Get ${plugin.name}`
        }
        aria-busy={installing}
        data-ai-target={`settings.plugins.${plugin.id}.${installing ? "installing" : installed ? "uninstall" : "install"}`}
        className={cn(
          "inline-flex min-w-[4.25rem] shrink-0 items-center justify-center rounded-full px-3.5 py-1 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-80",
          installed || installing
            ? "bg-panel-elevated text-muted-foreground hover:text-foreground"
            : "bg-panel-elevated/90 text-foreground hover:bg-panel-elevated",
          installing && "hover:text-muted-foreground",
        )}
      >
        {installing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : installed ? (
          "Uninstall"
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
  const [installedIds, setInstalledIds] = useState(readInstalledPluginIds);
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

  const installPlugin = (pluginId: string) => {
    if (installedIds.has(pluginId) || installingRef.current.has(pluginId)) return;

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
      setInstalledIds((current) => {
        const next = new Set(current);
        next.add(pluginId);
        writeInstalledPluginIds(next);
        return next;
      });
    }, PLUGIN_INSTALL_DURATION_MS);

    installTimeoutsRef.current.set(pluginId, timeoutId);
  };

  const uninstallPlugin = (pluginId: string) => {
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

    setInstalledIds((current) => {
      const next = new Set(current);
      next.delete(pluginId);
      writeInstalledPluginIds(next);
      return next;
    });
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
              onInstall={installPlugin}
              onUninstall={uninstallPlugin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const PLUGIN_SEARCH_TERMS = PLUGIN_GROUPS.flatMap((group) =>
  group.plugins.map((plugin) => ({
    label: plugin.name,
    keywords:
      `plugin ${plugin.id} ${plugin.name} ${plugin.description} ${group.label}`.toLowerCase(),
  })),
);
