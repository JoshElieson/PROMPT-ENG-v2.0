export type MenuActionId =
  | "file.newAgent"
  | "file.newProject"
  | "file.newTerminal"
  | "file.newBrowser"
  | "file.agentSettings"
  | "file.exit"
  | "edit.undo"
  | "edit.redo"
  | "edit.cut"
  | "edit.copy"
  | "edit.paste"
  | "edit.findInChat"
  | "view.explorer"
  | "view.agentCart"
  | "view.workspaceTerminal"
  | "view.workspaceBrowser"
  | "view.toggleLeftSidebar"
  | "view.appearance"
  | "view.fullScreen"
  | "go.agent"
  | "go.project"
  | "go.previousMessage"
  | "go.nextMessage";

export type MenuEntry =
  | { type: "separator" }
  | {
      type: "item";
      label: string;
      shortcut?: string;
      disabled?: boolean;
      action?: MenuActionId;
      /** Click toggles visibility (e.g. a panel); no checkmark in the menu. */
      checkable?: boolean;
    }
  | {
      type: "submenu";
      label: string;
      items: MenuEntry[];
    };

/** Menu actions wired to real behavior in the app. */
export const implementedMenuActions = new Set<MenuActionId>([
  "file.newAgent",
  "file.newProject",
  "file.newTerminal",
  "file.newBrowser",
  "file.agentSettings",
  "file.exit",
  "edit.undo",
  "edit.redo",
  "edit.cut",
  "edit.copy",
  "edit.paste",
  "edit.findInChat",
  "view.explorer",
  "view.agentCart",
  "view.workspaceTerminal",
  "view.workspaceBrowser",
  "view.toggleLeftSidebar",
  "view.appearance",
  "view.fullScreen",
  "go.agent",
  "go.project",
  "go.previousMessage",
  "go.nextMessage",
]);

export function isMenuEntryImplemented(entry: MenuEntry): boolean {
  if (entry.type === "separator") return true;
  if (entry.type === "submenu") {
    return entry.items.some(
      (child) => child.type !== "separator" && isMenuEntryImplemented(child),
    );
  }
  return (
    entry.action !== undefined && implementedMenuActions.has(entry.action)
  );
}

export function getMenuDisplayLabel(
  entry: Extract<MenuEntry, { type: "item" } | { type: "submenu" }>,
): string {
  return isMenuEntryImplemented(entry) ? entry.label : `TODO: ${entry.label}`;
}

export type MenuGroup = {
  label: string;
  items: MenuEntry[];
};

export const appMenuGroups: MenuGroup[] = [
  {
    label: "File",
    items: [
      {
        type: "item",
        label: "New Agent",
        shortcut: "Ctrl+N",
        action: "file.newAgent",
      },
      { type: "item", label: "New Project…", action: "file.newProject" },
      { type: "separator" },
      { type: "item", label: "New Terminal", action: "file.newTerminal" },
      { type: "item", label: "New Browser", action: "file.newBrowser" },
      { type: "separator" },
      { type: "item", label: "Agent Settings", action: "file.agentSettings" },
      { type: "item", label: "Exit", action: "file.exit" },
    ],
  },
  {
    label: "Edit",
    items: [
      { type: "item", label: "Undo", action: "edit.undo" },
      {
        type: "item",
        label: "Redo",
        action: "edit.redo",
      },
      { type: "separator" },
      { type: "item", label: "Cut", shortcut: "Ctrl+X", action: "edit.cut" },
      { type: "item", label: "Copy", shortcut: "Ctrl+C", action: "edit.copy" },
      { type: "item", label: "Paste", shortcut: "Ctrl+V", action: "edit.paste" },
      { type: "separator" },
      {
        type: "item",
        label: "Find in Chat…",
        shortcut: "Ctrl+F",
        action: "edit.findInChat",
      },
    ],
  },
  {
    label: "View",
    items: [
      {
        type: "item",
        label: "Projects",
        shortcut: "Ctrl+Shift+E",
        action: "view.explorer",
        checkable: true,
      },
      {
        type: "item",
        label: "Agent Cart",
        shortcut: "Ctrl+Shift+A",
        action: "view.agentCart",
        checkable: true,
      },
      {
        type: "item",
        label: "Terminal",
        shortcut: "Ctrl+`",
        action: "view.workspaceTerminal",
        checkable: true,
      },
      {
        type: "item",
        label: "Browser",
        action: "view.workspaceBrowser",
        checkable: true,
      },
      { type: "separator" },
      {
        type: "item",
        label: "Appearance…",
        action: "view.appearance",
      },
      { type: "separator" },
      {
        type: "item",
        label: "Toggle Left Sidebar",
        shortcut: "Ctrl+B",
        action: "view.toggleLeftSidebar",
      },
      { type: "separator" },
      { type: "item", label: "Full Screen", shortcut: "F11", action: "view.fullScreen" },
    ],
  },
  {
    label: "Go",
    items: [
      {
        type: "item",
        label: "Go to Agent…",
        shortcut: "Ctrl+Shift+O",
        action: "go.agent",
      },
      { type: "item", label: "Go to Project…", action: "go.project" },
      { type: "separator" },
      {
        type: "item",
        label: "Find in Chat...",
        shortcut: "Ctrl+F",
        action: "edit.findInChat",
      },
      { type: "separator" },
      {
        type: "item",
        label: "Previous Message",
        shortcut: "Ctrl+↑",
        action: "go.previousMessage",
      },
      {
        type: "item",
        label: "Next Message",
        shortcut: "Ctrl+↓",
        action: "go.nextMessage",
      },
    ],
  },
];
