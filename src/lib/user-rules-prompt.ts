import { readRules } from "@/lib/rule-storage";
import type { Chat } from "@/types/chat";
import type { RuleApplicationContext, UserRule } from "@/types/rule";

function isActiveRule(rule: UserRule): boolean {
  return rule.enabled && rule.content.trim().length > 0;
}

function ruleAppliesToContext(
  rule: UserRule,
  context?: RuleApplicationContext,
): boolean {
  if (!isActiveRule(rule)) return false;

  if (rule.scope === "all") return true;

  if (rule.scope === "projects") {
    if (!context?.chatId) return false;
    return rule.selectedProjectIds.includes(context.chatId);
  }

  if (rule.scope === "agents") {
    if (!context?.threadId) return false;
    return rule.selectedAgentIds.includes(context.threadId);
  }

  return false;
}

function getApplicableRules(context?: RuleApplicationContext): UserRule[] {
  return readRules().filter((rule) => ruleAppliesToContext(rule, context));
}

function ruleAppliesToChat(rule: UserRule, chat: Chat): boolean {
  if (!isActiveRule(rule)) return false;

  if (rule.scope === "all") return true;

  if (rule.scope === "projects") {
    return rule.selectedProjectIds.includes(chat.id);
  }

  if (rule.scope === "agents") {
    const threadIds = new Set(chat.threads.map((thread) => thread.id));
    return rule.selectedAgentIds.some((threadId) => threadIds.has(threadId));
  }

  return false;
}

export function getApplicableRulesForChat(
  chat: Chat,
  rules: UserRule[] = readRules(),
): UserRule[] {
  return rules.filter((rule) => ruleAppliesToChat(rule, chat));
}

export function formatActiveRulesCount(rules: UserRule[]): string | null {
  if (rules.length === 0) return null;
  return rules.length === 1
    ? "1 active rule"
    : `${rules.length} active rules`;
}

function buildActiveRulesPrompt(
  context?: RuleApplicationContext,
): string | null {
  const active = getApplicableRules(context);
  if (active.length === 0) return null;

  const blocks = active.map((rule) => {
    const title = rule.title.trim() || "Untitled rule";
    return `### ${title}\n${rule.content.trim()}`;
  });

  return [
    "The user has defined the following rules. Follow them in every response:",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

export function prependActiveRulesPrompt(
  system: string | null | undefined,
  context?: RuleApplicationContext,
): string {
  const rulesPrompt = buildActiveRulesPrompt(context);
  const baseSystemPrompt = system?.trim() ?? "";
  return [rulesPrompt, baseSystemPrompt]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join("\n\n")
    .trim();
}

export function summarizeRuleScope(rule: UserRule): string {
  if (rule.scope === "all") return "All projects & agents";
  if (rule.scope === "projects") {
    const count = rule.selectedProjectIds.length;
    if (count === 0) return "No projects selected";
    return count === 1 ? "1 project" : `${count} projects`;
  }
  const count = rule.selectedAgentIds.length;
  if (count === 0) return "No agents selected";
  return count === 1 ? "1 agent" : `${count} agents`;
}

export function isRuleDraftValid(rule: UserRule): boolean {
  if (rule.title.trim().length === 0 || rule.content.trim().length === 0) {
    return false;
  }
  if (rule.scope === "projects") return rule.selectedProjectIds.length > 0;
  if (rule.scope === "agents") return rule.selectedAgentIds.length > 0;
  return true;
}
