import { slashCommands, type SlashCommand } from "@/data/slash-commands";

function normalizeCommandQuery(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function commandMatchesQuery(command: SlashCommand, query: string): boolean {
  if (!query) return true;

  const lower = query.toLowerCase();
  const body = command.insert.slice(1);
  const bodyLower = body.toLowerCase();

  if (bodyLower.startsWith(lower)) return true;
  if (command.id.startsWith(lower)) return true;
  if (normalizeCommandQuery(body).startsWith(normalizeCommandQuery(query))) {
    return true;
  }

  return false;
}

export function getSlashCommandQuery(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const slash = before.lastIndexOf("/");
  if (slash === -1) return null;

  if (slash > 0) {
    const prev = before[slash - 1];
    if (prev !== " " && prev !== "\n") return null;
  }

  const query = before.slice(slash + 1);
  if (/\s/.test(query)) return null;

  const afterSlash = value.slice(slash + 1);
  for (const cmd of slashCommands) {
    const body = cmd.insert.slice(1);
    if (
      afterSlash.toLowerCase().startsWith(body.toLowerCase()) &&
      cursor >= slash + 1 + body.length
    ) {
      return null;
    }
  }

  return { start: slash, query };
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return slashCommands.filter((cmd) => commandMatchesQuery(cmd, q));
}

export function applySlashCommandSelection(
  value: string,
  commandStart: number,
  cursor: number,
  command: SlashCommand,
): { value: string; cursor: number } {
  const before = value.slice(0, commandStart);
  const after = value.slice(cursor);
  const insertion = command.insert.endsWith(" ")
    ? command.insert
    : `${command.insert} `;
  const next = `${before}${insertion}${after}`;
  return { value: next, cursor: before.length + insertion.length };
}
