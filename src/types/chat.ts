import type { NodePermissions } from "@/types/project";
import type { WorkspacePaneLayout } from "@/types/workspace-pane";

export type MessageRole = "user" | "assistant";

/** Share of an assistant response attributed to each model (sums to 100). */
export interface ModelContribution {
  modelId: string;
  percentage: number;
}

export interface ChatAttachment {
  id: string;
  name: string;
  path: string;
  size?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  /** When set, only these model ids receive the message (from @mentions) */
  targetModelIds?: string[];
  /** Round-table blend breakdown for assistant replies */
  modelContributions?: ModelContribution[];
}

/** One conversation stream inside a sidebar chat (up to 4 per chat for split workspace). */
export interface ChatThread {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Chat {
  id: string;
  title: string;
  /** One or more parallel threads (split panes) under this sidebar chat. */
  threads: ChatThread[];
  createdAt: number;
  updatedAt: number;
  /** Per-chat file/folder access toggles from the projects tree */
  permissions?: Record<string, NodePermissions>;
  /** Split-pane layout for the center workspace (threads referenced by leaf `threadId`). */
  workspace?: WorkspacePaneLayout;
}

export interface AiWorkspacePayload {
  /** Absolute paths enabled for AI file tools (from project tree). */
  enabledPaths: string[];
}

export interface SendMessagePayload {
  content: string;
  attachments?: ChatAttachment[];
  targetModelIds: string[];
  modelContributions?: ModelContribution[];
  /** When set and non-empty, models may use read_file / write_file / list_directory tools. */
  workspace?: AiWorkspacePayload;
  /** Sidebar chat id (workspace container). */
  chatId?: string;
  /** Thread within that chat (pane). */
  threadId?: string;
}

export type ResponseLoadingPhase = "roundtable" | "synthesizing";

export interface ResponseLoadingState {
  chatId: string;
  threadId: string;
  targetModelIds: string[];
  phase: ResponseLoadingPhase;
  /** Active speaker during roundtable phase; -1 when synthesizing */
  speakingModelIndex: number;
}

export const RESPONSE_TURN_MS = 2000;
