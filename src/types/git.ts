export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflicted";

export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  changes: GitFileChange[];
  clean: boolean;
}

export interface GitCommandResult {
  success: boolean;
  output: string;
}
