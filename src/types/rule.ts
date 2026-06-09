export type RuleScope = "all" | "projects" | "agents";

export interface RuleApplicationContext {
  chatId?: string;
  threadId?: string;
}

export interface UserRule {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  scope: RuleScope;
  selectedProjectIds: string[];
  selectedAgentIds: string[];
  createdAt: number;
}

export function createEmptyUserRule(): UserRule {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    enabled: true,
    scope: "all",
    selectedProjectIds: [],
    selectedAgentIds: [],
    createdAt: Date.now(),
  };
}
