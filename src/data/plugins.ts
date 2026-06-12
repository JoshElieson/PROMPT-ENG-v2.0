import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bug,
  ChartPie,
  Cloud,
  Container,
  CreditCard,
  Database,
  Globe,
  KeyRound,
  LayoutDashboard,
  LineChart,
  ListTodo,
  MessageCircle,
  MessageSquare,
  PenTool,
  Plane,
  Shield,
  StickyNote,
  TrainFront,
  Triangle,
  Users,
  Video,
  Wallet,
} from "lucide-react";

/**
 * "available" plugins have a real integration (setup panel and/or MCP path)
 * and can be installed. Everything else is catalog-only and shows "Soon".
 */
type PluginStatus = "available" | "coming-soon";

export interface PluginPlaceholder {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Defaults to "coming-soon"; set "available" once the plugin actually works. */
  status?: PluginStatus;
}

function getPluginStatus(plugin: PluginPlaceholder): PluginStatus {
  return plugin.status ?? "coming-soon";
}

export function isPluginInstallable(plugin: PluginPlaceholder): boolean {
  return getPluginStatus(plugin) === "available";
}

export interface PluginGroup {
  label: string;
  plugins: PluginPlaceholder[];
}

export const RECOMMENDED_PLUGIN_IDS = new Set([
  "docker",
  "figma",
  "excalidraw",
  "slack",
  "linear",
  "vercel",
  "supabase",
  "sentry",
]);

export const PLUGIN_GROUPS: PluginGroup[] = [
  {
    label: "Development",
    plugins: [
      {
        id: "docker",
        name: "Docker",
        description: "Manage containers, images, and compose stacks from the workspace.",
        icon: Container,
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
        status: "available",
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

export const PLUGIN_CATALOG: PluginPlaceholder[] = PLUGIN_GROUPS.flatMap(
  (group) => group.plugins,
);

export function getPluginById(pluginId: string): PluginPlaceholder | undefined {
  return PLUGIN_CATALOG.find((plugin) => plugin.id === pluginId);
}

export const PLUGIN_SEARCH_TERMS = PLUGIN_GROUPS.flatMap((group) =>
  group.plugins.map((plugin) => ({
    label: plugin.name,
    keywords:
      `plugin ${plugin.id} ${plugin.name} ${plugin.description} ${group.label}`.toLowerCase(),
  })),
);
