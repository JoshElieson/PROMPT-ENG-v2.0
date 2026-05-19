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

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface SendMessagePayload {
  content: string;
  attachments?: ChatAttachment[];
  targetModelIds: string[];
  modelContributions?: ModelContribution[];
}

export type ResponseLoadingPhase = "roundtable" | "synthesizing";

export interface ResponseLoadingState {
  chatId: string;
  targetModelIds: string[];
  phase: ResponseLoadingPhase;
  /** Active speaker during roundtable phase; -1 when synthesizing */
  speakingModelIndex: number;
}

export const RESPONSE_TURN_MS = 2000;
