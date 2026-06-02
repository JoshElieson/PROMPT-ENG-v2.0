export type AgentActivityType =
  | "analyzing"
  | "searching"
  | "reading"
  | "planning"
  | "editing"
  | "creating"
  | "deleting"
  | "checking"
  | "error"
  | "done";

export type AgentActivityEvent = {
  id: string;
  type: AgentActivityType;
  message: string;
  timestamp: number;
  filePath?: string;
};
