export interface SlashCommand {
  id: string;
  /** Text inserted into the composer (includes leading /). */
  insert: string;
  /** Primary label in the autocomplete list. */
  label: string;
  description?: string;
}

/** Slash commands shown in composer autofill (handlers not wired yet). */
export const slashCommands: SlashCommand[] = [
  {
    id: "a1",
    insert: "/a1",
    label: "/a1",
    description: "Agent slot 1",
  },
  {
    id: "a2",
    insert: "/a2",
    label: "/a2",
    description: "Agent slot 2",
  },
  {
    id: "a3",
    insert: "/a3",
    label: "/a3",
    description: "Agent slot 3",
  },
  {
    id: "agent1",
    insert: "/agent1",
    label: "/agent1",
    description: "Agent 1",
  },
  {
    id: "agent2",
    insert: "/agent2",
    label: "/agent2",
    description: "Agent 2",
  },
  {
    id: "agent3",
    insert: "/agent3",
    label: "/agent3",
    description: "Agent 3",
  },
  {
    id: "gpt-4o",
    insert: "/GPT-4o",
    label: "/GPT-4o",
    description: "Use GPT-4o",
  },
  {
    id: "undo",
    insert: "/undo",
    label: "/undo",
    description: "Undo last change",
  },
  {
    id: "redo",
    insert: "/redo",
    label: "/redo",
    description: "Redo",
  },
];
