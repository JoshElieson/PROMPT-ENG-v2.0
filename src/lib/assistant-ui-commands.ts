import type { UICommand, UIHighlightScope, UISettingsTab } from "@/types/ui-command";

export interface ExtractAssistantUiCommandsResult {
  visibleContent: string;
  commands: UICommand[];
}

const UI_COMMAND_BLOCK_RE =
  /\[\[FORGE_UI_COMMANDS\]\]([\s\S]*?)\[\[\/FORGE_UI_COMMANDS\]\]/gi;

const VALID_SCOPE = new Set<UIHighlightScope>([
  "settings",
  "chat",
  "workspace",
  "sidebar",
]);
const VALID_SETTINGS_TAB = new Set<UISettingsTab>([
  "general",
  "models",
  "workspace",
  "files",
  "agent",
  "appearance",
]);

function asPositiveDuration(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(500, Math.min(15000, Math.round(value)));
}

function normalizeCommand(raw: unknown): UICommand | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const type = typeof input.type === "string" ? input.type : "";

  if (type === "OPEN_SETTINGS") {
    const tab = input.tab;
    if (tab === undefined) return { type: "OPEN_SETTINGS" };
    if (typeof tab === "string" && VALID_SETTINGS_TAB.has(tab as UISettingsTab)) {
      return { type: "OPEN_SETTINGS", tab: tab as UISettingsTab };
    }
    return null;
  }

  if (type === "HIGHLIGHT_ELEMENT") {
    if (typeof input.targetId !== "string" || input.targetId.trim().length === 0) {
      return null;
    }
    return {
      type: "HIGHLIGHT_ELEMENT",
      targetId: input.targetId.trim(),
      label: typeof input.label === "string" ? input.label.trim() : undefined,
      durationMs: asPositiveDuration(input.durationMs),
    };
  }

  if (type === "HIGHLIGHT_TEXT") {
    if (typeof input.text !== "string" || input.text.trim().length === 0) return null;
    const scope =
      typeof input.scope === "string" && VALID_SCOPE.has(input.scope as UIHighlightScope)
        ? (input.scope as UIHighlightScope)
        : undefined;
    return {
      type: "HIGHLIGHT_TEXT",
      text: input.text.trim(),
      scope,
      durationMs: asPositiveDuration(input.durationMs),
    };
  }

  if (type === "CHANGE_SETTING") {
    if (
      typeof input.settingKey !== "string" ||
      input.settingKey.trim().length === 0 ||
      input.requiresConfirmation !== true
    ) {
      return null;
    }
    return {
      type: "CHANGE_SETTING",
      settingKey: input.settingKey.trim(),
      value: input.value,
      requiresConfirmation: true,
    };
  }

  if (type === "CLEAR_HIGHLIGHTS") {
    return { type: "CLEAR_HIGHLIGHTS" };
  }

  return null;
}

function parseUiCommands(raw: string): UICommand[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const array = Array.isArray(parsed) ? parsed : [parsed];
  const commands: UICommand[] = [];
  for (const entry of array) {
    const normalized = normalizeCommand(entry);
    if (normalized) {
      commands.push(normalized);
      continue;
    }
    if (import.meta.env.DEV) {
      console.warn("[forge-ui] Ignored invalid UI command", entry);
    }
  }
  return commands;
}

export function extractAssistantUiCommands(
  content: string,
): ExtractAssistantUiCommandsResult {
  const commands: UICommand[] = [];
  const visibleContent = content
    .replace(UI_COMMAND_BLOCK_RE, (_full, blockContent: string) => {
      commands.push(...parseUiCommands(blockContent.trim()));
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { visibleContent, commands };
}

export const AI_UI_COMMAND_SYSTEM_GUIDANCE = [
  "In-app UI guidance (FORGE navigation):",
  "When the user asks where something is, how to open a pane, or how to use a FORGE feature, emit UI commands to show them—do not only describe steps in prose.",
  "Only emit commands inside blocks formatted exactly as:",
  "[[FORGE_UI_COMMANDS]",
  '[{"type":"OPEN_SETTINGS","tab":"models"}]',
  "[[/FORGE_UI_COMMANDS]]",
  "Available command types: OPEN_SETTINGS, HIGHLIGHT_ELEMENT, HIGHLIGHT_TEXT, CHANGE_SETTING, CLEAR_HIGHLIGHTS.",
  "For OPEN_SETTINGS, HIGHLIGHT_ELEMENT, and HIGHLIGHT_TEXT: emit when the user asks—no separate permission needed.",
  "For CHANGE_SETTING: requiresConfirmation must be true; ask once before emitting a persistent or destructive app setting change.",
  "Never claim a setting was changed unless the app confirms success.",
  "Do not emit UI commands for code, file, or git work—use file and git tools for that instead.",
].join("\n");

