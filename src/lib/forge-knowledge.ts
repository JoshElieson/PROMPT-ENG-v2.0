import { appMenuGroups, type MenuEntry } from "@/data/menu-items";
import { slashCommands } from "@/data/slash-commands";
import {
  DEFAULT_LEFT_PANEL_SIZES,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
} from "@/lib/layout-defaults";
import type {
  FeatureReference,
  ForgeKnowledgeBase,
  ForgeKnowledgeCategory,
  ForgeKnowledgeHit,
  KnowledgeDocument,
} from "@/types/forge-knowledge";

const KNOWLEDGE_VERSION = "1.0.0";
const EMBEDDING_DIMENSIONS = 64;
const EMBEDDING_MODEL = "forge-hash-v1";
const MAX_RETRIEVAL_RESULTS = 4;
const MAX_SNIPPET_LENGTH = 520;
const QUERY_MIN_SCORE = 0.12;
const APP_SURFACES = [
  {
    id: "surface.activity-bar",
    name: "Activity Bar",
    location: "Far left rail",
    purpose: "Switch between Projects, Agent Cart, and Source Control sections.",
  },
  {
    id: "surface.left-sidebar",
    name: "Left Sidebar",
    location: "Left panel",
    purpose: "Shows chat history, projects tree, git panel, or agent cart based on selected activity view.",
  },
  {
    id: "surface.main-workspace",
    name: "Main Workspace",
    location: "Center",
    purpose: "Holds split chat panes, active agent threads, composer, and workspace bottom panel.",
  },
  {
    id: "surface.status-bar",
    name: "Status Bar",
    location: "Bottom app edge",
    purpose: "Displays app-wide status indicators and environment state.",
  },
] as const;

const AGENT_TOOL_REGISTRY = [
  {
    id: "read_file",
    description:
      "Read a UTF-8 text file inside AI-enabled paths. Use for source/config/docs/log inspection.",
  },
  {
    id: "write_file",
    description:
      "Overwrite/create UTF-8 files inside AI-enabled paths. Requires the full file body; truncated overwrites of large files are refused.",
  },
  {
    id: "search_replace",
    description:
      "Replace an exact substring in an existing UTF-8 file. Prefer for partial edits to large files instead of write_file.",
  },
  {
    id: "list_directory",
    description:
      "List files/folders in AI-enabled directories. Use to discover project layout before reading files.",
  },
  {
    id: "remove_path",
    description:
      "Delete a file or folder recursively. Use for user-approved delete operations.",
  },
  {
    id: "clear_directory",
    description:
      "Empty a folder while keeping it in place. Use to reset directory contents.",
  },
  {
    id: "open_pane",
    description:
      "Open the terminal or browser pane in the FORGE workspace when the user asks to show it.",
  },
  {
    id: "close_pane",
    description:
      "Close the terminal or browser pane in the FORGE workspace when the user asks to hide it.",
  },
] as const;

const APP_TERMS = [
  "forge",
  "app",
  "ui",
  "panel",
  "sidebar",
  "chat",
  "workspace",
  "terminal",
  "browser",
  "workflow",
  "round table",
  "agent",
  "model",
  "projects",
  "settings",
  "shortcut",
  "navigation",
  "layout",
] as const;

const UI_QUERY_TRIGGERS = [
  "how do i",
  "where is",
  "where are",
  "open",
  "close",
  "show",
  "hide",
  "find",
  "navigate",
  "shortcut",
  "hotkey",
  "keyboard",
  "panel",
  "sidebar",
  "terminal",
  "browser",
  "workspace",
  "agent",
  "model cart",
  "workflow",
  "split view",
  "project settings",
  "prompt history",
  "what features",
  "capabilities",
] as const;

const TOKEN_SYNONYMS: Record<string, string[]> = {
  split: ["split-view", "split", "workspace", "panes", "pane"],
  sidebar: ["left-sidebar", "sidebar", "panels"],
  model: ["models", "round-table", "agent", "cart"],
  workspace: ["center", "screen", "split", "chat"],
  settings: ["preferences", "config", "configuration"],
  terminal: ["bottom-panel", "shell", "console"],
  browser: ["web", "website", "bottom-panel"],
  project: ["projects", "explorer", "tree"],
  shortcut: ["hotkey", "keyboard", "keybind"],
};

type DerivedDocument = Omit<KnowledgeDocument, "searchableEmbedding">;

function tokenize(input: string): string[] {
  const normalized = input.toLowerCase().replace(/[^a-z0-9+/`._\-\s]/g, " ");
  const base = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const expanded = new Set(base);
  for (const token of base) {
    for (const synonym of TOKEN_SYNONYMS[token] ?? []) {
      expanded.add(synonym);
    }
  }
  return Array.from(expanded);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function buildEmbedding(text: string): number[] {
  const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const terms = tokenize(text);
  if (terms.length === 0) return values;
  for (const term of terms) {
    const idx = hashToken(term) % EMBEDDING_DIMENSIONS;
    values[idx] += 1;
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (norm > 0) {
    for (let i = 0; i < values.length; i += 1) {
      values[i] = values[i]! / norm;
    }
  }
  return values;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function flattenMenuItems(items: MenuEntry[]): Array<{ label: string; shortcut?: string }> {
  const out: Array<{ label: string; shortcut?: string }> = [];
  for (const item of items) {
    if (item.type === "separator") continue;
    if (item.type === "submenu") {
      out.push(...flattenMenuItems(item.items));
      continue;
    }
    out.push({ label: item.label, shortcut: item.shortcut });
  }
  return out;
}

function buildStaticFeatures(): FeatureReference[] {
  return [
    {
      featureId: "layout.main",
      featureName: "Main Workspace Layout",
      description:
        "FORGE has an activity rail, left sidebar, center workspace, and status bar.",
      uiLocation: "Main app shell",
      actions: ["Switch activity sections", "Resize left sidebar", "Use split workspace panes"],
      shortcuts: ["Ctrl+B", "Ctrl+`"],
      relatedFeatures: ["sidebar.left", "workspace.bottom-panel"],
    },
    {
      featureId: "workspace.bottom-panel",
      featureName: "Bottom Panel (Terminal / Browser)",
      description:
        "The bottom panel hosts multiple terminal and browser tabs with add, close, and drag-reorder controls.",
      uiLocation: "Center workspace bottom panel",
      actions: [
        "Open terminal tab",
        "Open browser tab",
        "Close bottom panel",
        "Reorder tabs",
      ],
      shortcuts: ["Ctrl+`"],
      relatedFeatures: ["layout.main", "navigation.focus"],
    },
    {
      featureId: "sidebar.left",
      featureName: "Left Sidebar",
      description:
        "Shows Projects/Chats stack in explorer mode, Git panel in git mode, and Agent Cart in agents mode.",
      uiLocation: "Left edge",
      actions: ["Switch between Projects, Agent Cart, and Git", "Resize/collapse sidebar"],
      shortcuts: ["Ctrl+Shift+E", "Ctrl+Shift+A", "Ctrl+B"],
      relatedFeatures: ["activity-bar", "models.round-table"],
    },
    {
      featureId: "models.round-table",
      featureName: "Round Table Model Selection",
      description:
        "Users choose active models, model weights, and auto mode for multi-model responses.",
      uiLocation: "Agent Cart (left sidebar)",
      actions: ["Toggle model active state", "Adjust per-model weight", "Enable Auto"],
      shortcuts: ["Ctrl+1", "Ctrl+2", "Ctrl+3", "Ctrl+4"],
      relatedFeatures: ["agent-cart"],
    },
    {
      featureId: "navigation.focus",
      featureName: "Keyboard Focus Navigation",
      description:
        "Arrow keys move focus between project tree, chat list, workspace screen, agent tabs, composer, and bottom panel.",
      uiLocation: "Global app focus system",
      actions: ["Move focus with Arrow keys", "Jump to workspace or list regions"],
      shortcuts: ["Arrow keys", "Escape", "Ctrl+`"],
      relatedFeatures: ["workspace.bottom-panel", "sidebar.left"],
    },
    {
      featureId: "agent-tools.workspace-files",
      featureName: "Agent File Tools",
      description:
        "When workspace permissions are enabled, models can use file tools: read_file, write_file, search_replace, list_directory, remove_path, clear_directory.",
      uiLocation: "Chat agent runtime",
      actions: ["Read source files", "Write changes", "List folders", "Delete paths", "Clear folder"],
      shortcuts: [],
      relatedFeatures: ["projects.permissions", "agents.memory"],
    },
    {
      featureId: "agents.memory",
      featureName: "Cross-Agent Memory",
      description:
        "Each thread stores memory records and can retrieve ranked snippets, summaries, and cross-agent context for future responses.",
      uiLocation: "Chat context pipeline",
      actions: ["Persist records", "Retrieve relevant snippets", "Highlight conflicts"],
      shortcuts: [],
      relatedFeatures: ["agent-tools.workspace-files"],
    },
    {
      featureId: "projects.permissions",
      featureName: "Project Permissions for AI",
      description:
        "Files/folders enabled from Projects are attached as AI-enabled roots for workspace tool access in chat.",
      uiLocation: "Projects panel and composer drops",
      actions: ["Enable file/folder", "Drop project items into composer", "Grant directory access"],
      shortcuts: [],
      relatedFeatures: ["agent-tools.workspace-files", "sidebar.left"],
    },
  ].map((feature) => ({
    ...feature,
    shortcuts: feature.shortcuts,
    relatedFeatures: feature.relatedFeatures,
  }));
}

function buildFeatureDocuments(features: FeatureReference[], now: number): DerivedDocument[] {
  return features.map((feature) => ({
    id: `feature:${feature.featureId}`,
    title: feature.featureName,
    category: "feature",
    content: [
      `Description: ${feature.description}`,
      `UI location: ${feature.uiLocation}`,
      `Actions: ${feature.actions.join("; ")}`,
      feature.shortcuts.length > 0
        ? `Shortcuts: ${feature.shortcuts.join(", ")}`
        : "Shortcuts: none listed",
    ].join("\n"),
    tags: [feature.featureName.toLowerCase(), ...feature.actions.map((a) => a.toLowerCase())],
    relatedFeatures: feature.relatedFeatures,
    lastUpdated: now,
  }));
}

function buildMenuDocuments(now: number): DerivedDocument[] {
  return appMenuGroups.map((group) => {
    const entries = flattenMenuItems(group.items).slice(0, 22);
    const shortcutLines = entries
      .filter((entry) => entry.shortcut)
      .map((entry) => `${entry.label}: ${entry.shortcut}`);
    return {
      id: `menu:${group.label.toLowerCase()}`,
      title: `${group.label} Menu`,
      category: "shortcuts" as ForgeKnowledgeCategory,
      content: [
        `Menu group: ${group.label}`,
        `Available actions: ${entries.map((entry) => entry.label).join(", ")}`,
        shortcutLines.length
          ? `Shortcuts: ${shortcutLines.join(" | ")}`
          : "Shortcuts: none in this group",
      ].join("\n"),
      tags: [
        "menu",
        group.label.toLowerCase(),
        ...entries.map((entry) => entry.label.toLowerCase()),
      ],
      relatedFeatures: ["navigation.focus", "layout.main"],
      lastUpdated: now,
    };
  });
}

function buildSlashCommandDocument(now: number): DerivedDocument {
  return {
    id: "slash:commands",
    title: "Composer Slash Commands",
    category: "tools",
    content: [
      "Slash commands available in the composer autocomplete:",
      ...slashCommands.map((command) => `${command.label} -> ${command.description ?? "No description"}`),
    ].join("\n"),
    tags: [
      "slash",
      "commands",
      "composer",
      ...slashCommands.map((command) => command.label.toLowerCase()),
    ],
    relatedFeatures: ["models.round-table"],
    lastUpdated: now,
  };
}

function buildLayoutDocument(now: number): DerivedDocument {
  return {
    id: "layout:defaults",
    title: "Layout Defaults and Panels",
    category: "layout",
    content: [
      "Default app layout includes activity bar, left sidebar, center workspace, and status bar.",
      `Default left sidebar width: ${DEFAULT_LEFT_SIDEBAR_WIDTH}px`,
      `Default explorer split ratio: ${DEFAULT_LEFT_PANEL_SIZES[0]} / ${DEFAULT_LEFT_PANEL_SIZES[1]}`,
      "Bottom panel hosts terminal and browser tabs and can be toggled from menu or Ctrl+`.",
    ].join("\n"),
    tags: ["layout", "sidebar", "panel", "workspace", "terminal", "browser", "split"],
    relatedFeatures: ["layout.main", "workspace.bottom-panel", "sidebar.left"],
    lastUpdated: now,
  };
}

function buildSurfaceDocument(now: number): DerivedDocument {
  return {
    id: "layout:surfaces",
    title: "App Surfaces and Component Map",
    category: "navigation",
    content: [
      "Top-level app surfaces and where to find them:",
      ...APP_SURFACES.map(
        (surface) => `${surface.name} (${surface.location}): ${surface.purpose}`,
      ),
      "These surfaces are the primary route-like structure of FORGE's single-window workspace.",
    ].join("\n"),
    tags: ["layout", "surfaces", "components", "app shell", "navigation"],
    relatedFeatures: ["layout.main", "sidebar.left"],
    lastUpdated: now,
  };
}

function buildToolRegistryDocument(now: number): DerivedDocument {
  return {
    id: "tools:registry",
    title: "Registered Agent Tooling",
    category: "tools",
    content: [
      "Agent tool registry exposed to model providers when workspace permissions are enabled:",
      ...AGENT_TOOL_REGISTRY.map((tool) => `${tool.id}: ${tool.description}`),
      "These tools execute against real disk paths allowed by project permissions.",
    ].join("\n"),
    tags: [
      "tools",
      "agent",
      "workspace",
      "file access",
      ...AGENT_TOOL_REGISTRY.map((tool) => tool.id),
    ],
    relatedFeatures: ["agent-tools.workspace-files", "projects.permissions"],
    lastUpdated: now,
  };
}

function withEmbedding(doc: DerivedDocument): KnowledgeDocument {
  const searchableText = [doc.title, doc.content, doc.tags.join(" "), doc.relatedFeatures.join(" ")].join("\n");
  return {
    ...doc,
    searchableEmbedding: {
      values: buildEmbedding(searchableText),
      model: EMBEDDING_MODEL,
    },
  };
}

function buildKnowledgeBase(): ForgeKnowledgeBase {
  const now = Date.now();
  const features = buildStaticFeatures();
  const docs = [
    ...buildFeatureDocuments(features, now),
    ...buildMenuDocuments(now),
    buildSlashCommandDocument(now),
    buildLayoutDocument(now),
    buildSurfaceDocument(now),
    buildToolRegistryDocument(now),
  ].map(withEmbedding);
  return {
    version: KNOWLEDGE_VERSION,
    generatedAt: now,
    sections: [
      "layout",
      "feature references",
      "navigation",
      "keyboard shortcuts",
      "workflow",
      "tools",
      "agent capabilities",
    ],
    documents: docs,
    features,
  };
}

const FORGE_KNOWLEDGE_BASE = buildKnowledgeBase();

function isForgeKnowledgeQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  if (!normalized.trim()) return false;
  if (APP_TERMS.some((token) => normalized.includes(token))) return true;
  return UI_QUERY_TRIGGERS.some((trigger) => normalized.includes(trigger));
}

function searchForgeKnowledge(
  query: string,
  limit = MAX_RETRIEVAL_RESULTS,
): ForgeKnowledgeHit[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const queryTerms = tokenize(normalized);
  const queryEmbedding = buildEmbedding(normalized);

  return FORGE_KNOWLEDGE_BASE.documents
    .map((document) => {
      const docTerms = new Set(tokenize([document.title, document.content, document.tags.join(" ")].join(" ")));
      const matchedTerms = queryTerms.filter((term) => docTerms.has(term));
      const lexicalScore = queryTerms.length === 0 ? 0 : matchedTerms.length / queryTerms.length;
      const embeddingScore = cosineSimilarity(queryEmbedding, document.searchableEmbedding.values);
      const score = lexicalScore * 0.65 + embeddingScore * 0.35;
      return { document, score, matchedTerms };
    })
    .filter((entry) => entry.score >= QUERY_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

function compactSnippet(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_SNIPPET_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_SNIPPET_LENGTH - 3)}...`;
}

export function buildForgeKnowledgePrompt(query: string): string | null {
  if (!isForgeKnowledgeQuery(query)) return null;
  const hits = searchForgeKnowledge(query);
  if (hits.length === 0) return null;
  const lines: string[] = [];
  lines.push("FORGE App Knowledge (canonical UI reference):");
  lines.push(
    "- Use this retrieved FORGE documentation as source-of-truth for UI, layout, navigation, and agent capability questions.",
  );
  lines.push(
    "- When the user asks how to do something in FORGE, answer concretely and prefer in-app UI commands to show them—not long manual walkthroughs alone.",
  );
  lines.push("- If details are missing, say so instead of guessing.");
  lines.push("- Retrieved snippets:");
  for (const hit of hits) {
    lines.push(
      `  - [${hit.document.category}] ${hit.document.title}: ${compactSnippet(hit.document.content)}`,
    );
  }
  return lines.join("\n");
}
