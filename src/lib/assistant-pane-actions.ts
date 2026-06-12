type PaneActionVerb = "open" | "close";

export type PaneActionTarget =
  | "terminal"
  | "websites"
  | "models"
  | "explorer"
  | "agent-cart";

interface AssistantPaneAction {
  verb: PaneActionVerb;
  target: PaneActionTarget;
}

export interface ExtractAssistantPaneActionsResult {
  visibleContent: string;
  actions: AssistantPaneAction[];
}

const ACTION_RE = /\[\[FORGE_PANE\s+action="(open|close)"\s+target="([a-z-]+)"\s*\]\]/gi;

function normalizeTarget(raw: string): PaneActionTarget | null {
  const value = raw.trim().toLowerCase();
  if (value === "terminal") return "terminal";
  if (value === "websites" || value === "website" || value === "browser") {
    return "websites";
  }
  if (value === "models" || value === "round-table" || value === "roundtable") {
    return "models";
  }
  if (value === "explorer" || value === "projects") return "explorer";
  if (value === "agent-cart" || value === "agents") return "agent-cart";
  return null;
}

/** Extract pane action directives and remove them from user-visible content. */
export function extractAssistantPaneActions(
  content: string,
): ExtractAssistantPaneActionsResult {
  const actions: AssistantPaneAction[] = [];

  const visibleContent = content
    .replace(ACTION_RE, (_full, actionRaw: string, targetRaw: string) => {
      const verb =
        actionRaw?.toLowerCase() === "open" || actionRaw?.toLowerCase() === "close"
          ? (actionRaw.toLowerCase() as PaneActionVerb)
          : null;
      const target = normalizeTarget(targetRaw ?? "");
      if (verb && target) {
        actions.push({ verb, target });
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { visibleContent, actions };
}
