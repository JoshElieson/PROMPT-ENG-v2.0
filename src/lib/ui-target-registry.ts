export interface AiTargetMeta {
  label: string;
  route?: string;
  settingKey?: string;
}

export const aiTargets: Record<string, AiTargetMeta> = {
  "settings.general.system-notifications": {
    label: "System Notifications",
    route: "/settings/general",
    settingKey: "systemNotifications",
  },
  "settings.general.automation-notifications": {
    label: "Automation Notifications",
    route: "/settings/general",
    settingKey: "automationNotifications",
  },
  "settings.general.warning-notifications": {
    label: "Warning Notifications",
    route: "/settings/general",
    settingKey: "warningNotifications",
  },
  "settings.general.system-tray": {
    label: "System Tray Icon",
    route: "/settings/general",
    settingKey: "systemTrayIcon",
  },
  "settings.general.completion-sound": {
    label: "Completion Sound",
    route: "/settings/general",
    settingKey: "completionSound",
  },
  "settings.general.data-sharing": {
    label: "Data Sharing",
    route: "/settings/general",
    settingKey: "dataSharingEnabled",
  },
  "settings.models.default-model": {
    label: "Default Model",
    route: "/settings/models",
    settingKey: "defaultModel",
  },
  "settings.appearance.theme": {
    label: "Theme",
    route: "/settings/appearance",
    settingKey: "theme",
  },
  "settings.appearance.layout": {
    label: "Layout",
    route: "/settings/appearance",
  },
  "settings.plan-usage.summary": {
    label: "Usage Summary",
    route: "/settings/plan-usage",
  },
  "settings.plan-usage.reset": {
    label: "Reset Usage",
    route: "/settings/plan-usage",
  },
  "settings.plan-usage.upgrade": {
    label: "See Pricing Plans",
    route: "/settings/plan-usage",
  },
  "settings.rules.new-button": {
    label: "New Rule",
    route: "/settings/rules",
  },
  "settings.rules.empty": {
    label: "Rules Empty State",
    route: "/settings/rules",
  },
  "chat.settings.button": { label: "Chat Settings" },
  "chat.model-selector": { label: "Model Selector" },
  "chat.settings.agent-name": { label: "Agent Name" },
  "chat.settings.agent-system-prompt": { label: "Agent System Prompt" },
  "chat.settings.project-name": { label: "Project Name" },
  "chat.settings.file-access": { label: "File Access Permission" },
  "chat.settings.file-context": { label: "File Context" },
  "workspace.bottom.terminal-toggle": { label: "Terminal Toggle" },
  "workspace.bottom.browser-toggle": { label: "Browser Toggle" },
  "sidebar.projects.selector": { label: "Projects" },
  "sidebar.projects.tree": { label: "Project Selector" },
  "sidebar.settings.button": { label: "Settings" },
};

export function getAiTarget(targetId: string): AiTargetMeta | null {
  return aiTargets[targetId] ?? null;
}

export function findAiTargetElement(targetId: string): HTMLElement | null {
  const escaped = typeof CSS !== "undefined" ? CSS.escape(targetId) : targetId;
  return document.querySelector<HTMLElement>(`[data-ai-target="${escaped}"]`);
}

