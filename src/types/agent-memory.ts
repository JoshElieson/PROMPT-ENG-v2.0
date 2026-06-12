import type { ChatTurn } from "@/lib/ai-chat";

type MemoryRecordType =
  | "decision"
  | "file"
  | "summary"
  | "user-preference"
  | "code-change"
  | "tool-result";

interface MemoryEmbedding {
  values: number[];
  model?: string;
}

export interface MemoryRecord {
  id: string;
  sourceAgentId: string;
  timestamp: number;
  type: MemoryRecordType;
  title: string;
  content: string;
  tags: string[];
  relatedFiles: string[];
  embedding?: MemoryEmbedding;
  importanceScore: number;
  stale: boolean;
  supersedesRecordIds?: string[];
}

interface IndexedMemoryRecord {
  recordId: string;
  terms: string[];
  termFrequency: Record<string, number>;
  lastIndexedAt: number;
}

export interface AgentContext {
  agentId: string;
  role: string;
  messages: ChatTurn[];
  toolResults: string[];
  workingFiles: string[];
  decisions: string[];
  codeChanges: string[];
  userPreferences: string[];
  taskNotes: string[];
  taskSummary: string;
  memoryRecords: string[];
  updatedAt: number;
}

export interface ProjectMemory {
  projectId: string;
  agents: Record<string, AgentContext>;
  records: MemoryRecord[];
  sharedIndex: IndexedMemoryRecord[];
  lastUpdatedAt: number;
}

export interface MemorySearchFilters {
  types?: MemoryRecordType[];
  tags?: string[];
  relatedFiles?: string[];
  includeStale?: boolean;
  maxAgeMs?: number;
  minImportanceScore?: number;
  limit?: number;
}

export interface RankedMemoryMatch {
  record: MemoryRecord;
  relevanceScore: number;
  reasons: string[];
}

export interface AgentContextRequest {
  query: string;
  relatedFiles?: string[];
  maxSnippets?: number;
  searchFilters?: MemorySearchFilters;
}

export interface RetrievedContextSnippet {
  recordId: string;
  sourceAgentId: string;
  title: string;
  content: string;
  type: MemoryRecordType;
  relevanceScore: number;
  stale: boolean;
  conflict: boolean;
  relatedFiles: string[];
}

export interface RetrievedAgentContext {
  snippets: RetrievedContextSnippet[];
  localSummary: string;
  needsSharedLookup: boolean;
  conflicts: Array<{
    key: string;
    recordIds: string[];
    sourceAgentIds: string[];
  }>;
}
