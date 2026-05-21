export type MenuActionId =
  | "view.explorer"
  | "view.agentCart"
  | "view.roundTablePanel"
  | "view.workflowPanel"
  | "view.workspaceTerminal"
  | "view.workspaceBrowser"
  | "view.toggleLeftSidebar"
  | "view.toggleRightSidebar";

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
  "view.explorer",
  "view.agentCart",
  "view.roundTablePanel",
  "view.workflowPanel",
  "view.workspaceTerminal",
  "view.workspaceBrowser",
  "view.toggleLeftSidebar",
  "view.toggleRightSidebar",
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
      { type: "item", label: "New Chat", shortcut: "Ctrl+N" },
      { type: "item", label: "New Project…" },
      { type: "separator" },
      { type: "item", label: "Open Project…", shortcut: "Ctrl+O" },
      {
        type: "submenu",
        label: "Open Recent",
        items: [
          { type: "item", label: "Optimize Rust Function" },
          { type: "item", label: "TypeScript Refactor" },
          { type: "item", label: "API Design Review" },
          { type: "separator" },
          { type: "item", label: "Clear Recently Opened" },
        ],
      },
      { type: "separator" },
      { type: "item", label: "Save Prompt Template", shortcut: "Ctrl+S" },
      { type: "item", label: "Save Chat As…", shortcut: "Ctrl+Shift+S" },
      { type: "separator" },
      { type: "item", label: "Export Chat…" },
      { type: "item", label: "Export Round Table Summary…" },
      { type: "item", label: "Export Token Usage Report…" },
      { type: "separator" },
      { type: "item", label: "Close Chat", shortcut: "Ctrl+W" },
      { type: "item", label: "Close Project" },
      { type: "separator" },
      { type: "item", label: "Preferences…", shortcut: "Ctrl+," },
      { type: "separator" },
      { type: "item", label: "Exit", shortcut: "Alt+F4" },
    ],
  },
  {
    label: "Edit",
    items: [
      { type: "item", label: "Undo", shortcut: "Ctrl+Z" },
      { type: "item", label: "Redo", shortcut: "Ctrl+Shift+Z" },
      { type: "separator" },
      { type: "item", label: "Cut", shortcut: "Ctrl+X" },
      { type: "item", label: "Copy", shortcut: "Ctrl+C" },
      { type: "item", label: "Paste", shortcut: "Ctrl+V" },
      { type: "separator" },
      { type: "item", label: "Find in Chat…", shortcut: "Ctrl+F" },
      { type: "item", label: "Replace in Chat…", shortcut: "Ctrl+Alt+F" },
      { type: "separator" },
      { type: "item", label: "Copy Last Response" },
      { type: "item", label: "Copy Code Block" },
      { type: "item", label: "Copy as Markdown" },
      { type: "separator" },
      { type: "item", label: "Select All", shortcut: "Ctrl+A" },
    ],
  },
  {
    label: "Selection",
    items: [
      { type: "item", label: "Select All", shortcut: "Ctrl+A" },
      { type: "item", label: "Expand Selection", shortcut: "Ctrl+Shift+→" },
      { type: "item", label: "Shrink Selection", shortcut: "Ctrl+Shift+←" },
      { type: "separator" },
      { type: "item", label: "Add Selection to Context", shortcut: "@" },
      { type: "item", label: "Add File to Context…" },
      { type: "item", label: "Add Folder to Context…" },
      { type: "separator" },
      { type: "item", label: "Select Line" },
      { type: "item", label: "Select Word" },
      { type: "item", label: "Select Model Output…" },
      { type: "separator" },
      { type: "item", label: "Select Next Occurrence", shortcut: "Ctrl+D" },
      { type: "item", label: "Select All Occurrences", shortcut: "Ctrl+Shift+L" },
    ],
  },
  {
    label: "View",
    items: [
      { type: "item", label: "Command Palette…", shortcut: "Ctrl+Shift+P" },
      { type: "item", label: "Open Quick Pick…", shortcut: "Ctrl+P" },
      { type: "separator" },
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
        label: "Workflows",
        action: "view.workflowPanel",
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
      },
      { type: "separator" },
      {
        type: "submenu",
        label: "Appearance",
        items: [
          { type: "item", label: "Dark (Default)" },
          { type: "item", label: "Light" },
          { type: "item", label: "High Contrast" },
          { type: "separator" },
          { type: "item", label: "Sidebar Left" },
          { type: "item", label: "Sidebar Right" },
        ],
      },
      {
        type: "submenu",
        label: "Editor Layout",
        items: [
          { type: "item", label: "Single Column" },
          { type: "item", label: "Split Chat / Response" },
          { type: "item", label: "Compare Model Outputs" },
        ],
      },
      { type: "separator" },
      {
        type: "item",
        label: "Toggle Left Sidebar",
        shortcut: "Ctrl+B",
        action: "view.toggleLeftSidebar",
      },
      {
        type: "item",
        label: "Toggle Right Sidebar",
        action: "view.toggleRightSidebar",
      },
      { type: "item", label: "Toggle Status Bar" },
      { type: "item", label: "Toggle Activity Bar" },
      { type: "separator" },
      { type: "item", label: "Zoom In", shortcut: "Ctrl++" },
      { type: "item", label: "Zoom Out", shortcut: "Ctrl+-" },
      { type: "item", label: "Reset Zoom", shortcut: "Ctrl+0" },
      { type: "separator" },
      { type: "item", label: "Full Screen", shortcut: "F11" },
    ],
  },
  {
    label: "Go",
    items: [
      { type: "item", label: "Back", shortcut: "Ctrl+[" },
      { type: "item", label: "Forward", shortcut: "Ctrl+]" },
      { type: "separator" },
      { type: "item", label: "Go to Chat…", shortcut: "Ctrl+Shift+O" },
      { type: "item", label: "Go to Project…" },
      { type: "item", label: "Go to File in Project…", shortcut: "Ctrl+P" },
      { type: "separator" },
      { type: "item", label: "Go to GPT-4o", shortcut: "Ctrl+1" },
      { type: "item", label: "Go to Claude 3.5", shortcut: "Ctrl+2" },
      { type: "item", label: "Go to Gemini 1.5", shortcut: "Ctrl+3" },
      { type: "item", label: "Go to Mix (Round Table)", shortcut: "Ctrl+4" },
      { type: "separator" },
      { type: "item", label: "Go to Line…", shortcut: "Ctrl+G" },
      { type: "item", label: "Go to Symbol in Project…", shortcut: "Ctrl+Shift+R" },
      { type: "separator" },
      { type: "item", label: "Previous Message", shortcut: "Ctrl+↑" },
      { type: "item", label: "Next Message", shortcut: "Ctrl+↓" },
      { type: "separator" },
      { type: "item", label: "Go to Definition" },
      { type: "item", label: "Go to References" },
    ],
  },
];
