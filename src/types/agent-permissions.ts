/** Per-agent capability toggles (stored as partial overrides on ChatThread). */
export interface AgentPermissions {
  browser: boolean;
  fileRead: boolean;
  fileWrite: boolean;
  terminal: boolean;
  git: boolean;
  inAppSettings: boolean;
}

export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  browser: true,
  fileRead: true,
  fileWrite: true,
  terminal: true,
  git: true,
  inAppSettings: true,
};

export const AGENT_PERMISSION_KEYS = [
  "browser",
  "fileRead",
  "fileWrite",
  "terminal",
  "git",
  "inAppSettings",
] as const satisfies readonly (keyof AgentPermissions)[];

export type AgentPermissionKey = (typeof AGENT_PERMISSION_KEYS)[number];

export const AGENT_PERMISSION_OPTIONS: {
  key: AgentPermissionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "terminal",
    label: "Terminal",
    description: "Open the terminal pane and run shell commands",
  },
  {
    key: "fileWrite",
    label: "File write",
    description: "Create, edit, and delete files in enabled paths",
  },
  {
    key: "browser",
    label: "Browser",
    description: "Open and control the embedded browser pane",
  },
  {
    key: "fileRead",
    label: "File read",
    description: "Read files and list directories in enabled project paths",
  },
  {
    key: "inAppSettings",
    label: "In-app settings",
    description:
      "Edit project description and tools, and open models or agent panes",
  },
  {
    key: "git",
    label: "Git commands",
    description: "Use source control: status, commit, pull, push, and related git operations",
  },
];
