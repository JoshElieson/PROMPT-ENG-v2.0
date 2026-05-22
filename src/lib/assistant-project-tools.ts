import {
  parseToolsListAttribute,
  type ProjectToolsPatch,
} from "@/lib/project-tools";

export interface ExtractAssistantProjectToolsResult {
  visibleContent: string;
  patches: ProjectToolsPatch[];
}

const DIRECTIVE_RE = /\[\[FORGE_PROJECT_TOOLS([^\]]*)\]\]/gi;

function parsePatchAttributes(attrs: string): ProjectToolsPatch | null {
  const addMatch = /\badd="([^"]*)"/i.exec(attrs);
  const removeMatch = /\bremove="([^"]*)"/i.exec(attrs);
  const setMatch = /\bset="([^"]*)"/i.exec(attrs);

  const patch: ProjectToolsPatch = {};
  if (setMatch) {
    patch.set = parseToolsListAttribute(setMatch[1]);
  }
  if (addMatch) {
    patch.add = parseToolsListAttribute(addMatch[1]);
  }
  if (removeMatch) {
    patch.remove = parseToolsListAttribute(removeMatch[1]);
  }

  if (!patch.set && !patch.add?.length && !patch.remove?.length) {
    return null;
  }
  return patch;
}

/** Extract project-tools directives and remove them from user-visible content. */
export function extractAssistantProjectTools(
  content: string,
): ExtractAssistantProjectToolsResult {
  const patches: ProjectToolsPatch[] = [];

  const visibleContent = content
    .replace(DIRECTIVE_RE, (_full, attrs: string) => {
      const patch = parsePatchAttributes(attrs ?? "");
      if (patch) patches.push(patch);
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { visibleContent, patches };
}
