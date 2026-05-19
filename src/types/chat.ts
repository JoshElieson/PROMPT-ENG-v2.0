export type MessageRole = "user" | "assistant";

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
}
