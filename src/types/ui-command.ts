export type UISettingsTab =
  | "general"
  | "models"
  | "workspace"
  | "files"
  | "agent"
  | "appearance";

export type UIHighlightScope = "settings" | "chat" | "workspace" | "sidebar";

export type UICommand =
  | {
      type: "OPEN_SETTINGS";
      tab?: UISettingsTab;
    }
  | {
      type: "HIGHLIGHT_ELEMENT";
      targetId: string;
      label?: string;
      durationMs?: number;
    }
  | {
      type: "HIGHLIGHT_TEXT";
      text: string;
      scope?: UIHighlightScope;
      durationMs?: number;
    }
  | {
      type: "CHANGE_SETTING";
      settingKey: string;
      value: unknown;
      requiresConfirmation: true;
    }
  | {
      type: "CLEAR_HIGHLIGHTS";
    };

