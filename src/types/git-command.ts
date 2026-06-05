export type GitAssistantAction =
  | "status"
  | "pull"
  | "push"
  | "fetch"
  | "init"
  | "commit"
  | "clone"
  | "restore";

export interface GitAssistantCommand {
  action: GitAssistantAction;
  message?: string;
  stageAll?: boolean;
  url?: string;
  parentPath?: string;
  paths?: string[];
}

export interface GitAssistantCommandResult {
  action: GitAssistantAction;
  success: boolean;
  output: string;
}
