export type MenuEntry =
  | { type: "separator" }
  | {
      type: "item";
      label: string;
      shortcut?: string;
      disabled?: boolean;
    }
  | {
      type: "submenu";
      label: string;
      items: MenuEntry[];
    };

export type MenuGroup = {
  label: string;
  items: MenuEntry[];
};

export const appMenuGroups: MenuGroup[] = [
  {
    label: "File",
    items: [
      { type: "item", label: "New Chat", shortcut: "⌘N" },
      { type: "item", label: "New Project…" },
      { type: "separator" },
      { type: "item", label: "Open Project…", shortcut: "⌘O" },
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
      { type: "item", label: "Save Prompt Template", shortcut: "⌘S" },
      { type: "item", label: "Save Chat As…", shortcut: "⌘⇧S" },
      { type: "separator" },
      { type: "item", label: "Export Chat…" },
      { type: "item", label: "Export Round Table Summary…" },
      { type: "item", label: "Export Token Usage Report…" },
      { type: "separator" },
      { type: "item", label: "Close Chat", shortcut: "⌘W" },
      { type: "item", label: "Close Project" },
      { type: "separator" },
      { type: "item", label: "Preferences…", shortcut: "⌘," },
      { type: "separator" },
      { type: "item", label: "Exit", shortcut: "Alt+F4" },
    ],
  },
  {
    label: "Edit",
    items: [
      { type: "item", label: "Undo", shortcut: "⌘Z" },
      { type: "item", label: "Redo", shortcut: "⌘⇧Z" },
      { type: "separator" },
      { type: "item", label: "Cut", shortcut: "⌘X" },
      { type: "item", label: "Copy", shortcut: "⌘C" },
      { type: "item", label: "Paste", shortcut: "⌘V" },
      { type: "separator" },
      { type: "item", label: "Find in Chat…", shortcut: "⌘F" },
      { type: "item", label: "Replace in Chat…", shortcut: "⌘⌥F" },
      { type: "separator" },
      { type: "item", label: "Copy Last Response" },
      { type: "item", label: "Copy Code Block" },
      { type: "item", label: "Copy as Markdown" },
      { type: "separator" },
      { type: "item", label: "Select All", shortcut: "⌘A" },
    ],
  },
  {
    label: "Selection",
    items: [
      { type: "item", label: "Select All", shortcut: "⌘A" },
      { type: "item", label: "Expand Selection", shortcut: "⌘⇧→" },
      { type: "item", label: "Shrink Selection", shortcut: "⌘⇧←" },
      { type: "separator" },
      { type: "item", label: "Add Selection to Context", shortcut: "@" },
      { type: "item", label: "Add File to Context…" },
      { type: "item", label: "Add Folder to Context…" },
      { type: "separator" },
      { type: "item", label: "Select Line" },
      { type: "item", label: "Select Word" },
      { type: "item", label: "Select Model Output…" },
      { type: "separator" },
      { type: "item", label: "Select Next Occurrence", shortcut: "⌘D" },
      { type: "item", label: "Select All Occurrences", shortcut: "⌘⇧L" },
    ],
  },
  {
    label: "View",
    items: [
      { type: "item", label: "Command Palette…", shortcut: "⌘⇧P" },
      { type: "item", label: "Open Quick Pick…", shortcut: "⌘P" },
      { type: "separator" },
      { type: "item", label: "Explorer", shortcut: "⌘⇧E" },
      { type: "item", label: "Agent Cart", shortcut: "⌘⇧A" },
      { type: "item", label: "Round Table Panel" },
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
      { type: "item", label: "Toggle Left Sidebar", shortcut: "⌘B" },
      { type: "item", label: "Toggle Right Sidebar" },
      { type: "item", label: "Toggle Status Bar" },
      { type: "item", label: "Toggle Activity Bar" },
      { type: "separator" },
      { type: "item", label: "Zoom In", shortcut: "⌘+" },
      { type: "item", label: "Zoom Out", shortcut: "⌘-" },
      { type: "item", label: "Reset Zoom", shortcut: "⌘0" },
      { type: "separator" },
      { type: "item", label: "Full Screen", shortcut: "F11" },
    ],
  },
  {
    label: "Go",
    items: [
      { type: "item", label: "Back", shortcut: "⌘[" },
      { type: "item", label: "Forward", shortcut: "⌘]" },
      { type: "separator" },
      { type: "item", label: "Go to Chat…", shortcut: "⌘⇧O" },
      { type: "item", label: "Go to Project…" },
      { type: "item", label: "Go to File in Project…", shortcut: "⌘P" },
      { type: "separator" },
      { type: "item", label: "Go to GPT-4o", shortcut: "⌘1" },
      { type: "item", label: "Go to Claude 3.5", shortcut: "⌘2" },
      { type: "item", label: "Go to Gemini 1.5", shortcut: "⌘3" },
      { type: "item", label: "Go to Mix (Round Table)", shortcut: "⌘4" },
      { type: "separator" },
      { type: "item", label: "Go to Line…", shortcut: "⌘G" },
      { type: "item", label: "Go to Symbol in Project…", shortcut: "⌘⇧R" },
      { type: "separator" },
      { type: "item", label: "Previous Message", shortcut: "⌘↑" },
      { type: "item", label: "Next Message", shortcut: "⌘↓" },
      { type: "separator" },
      { type: "item", label: "Go to Definition" },
      { type: "item", label: "Go to References" },
    ],
  },
];
