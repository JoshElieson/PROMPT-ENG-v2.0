import type {
  AgentContext,
  AgentContextRequest,
  MemoryRecord,
  MemorySearchFilters,
  ProjectMemory,
  RankedMemoryMatch,
  RetrievedAgentContext,
  RetrievedContextSnippet,
} from "@/types/agent-memory";

const DEFAULT_IMPORTANCE_SCORE = 0.5;
const DEFAULT_RESULT_LIMIT = 8;

function tokenize(input: string): string[] {
  const normalized = input.toLowerCase().replace(/[^a-z0-9_\-/.\s]/g, " ");
  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return Array.from(new Set(terms));
}

function buildTermFrequency(terms: string[]): Record<string, number> {
  const frequency: Record<string, number> = {};
  for (const term of terms) {
    frequency[term] = (frequency[term] ?? 0) + 1;
  }
  return frequency;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function recencyBoost(timestamp: number): number {
  const ageMs = Math.max(0, Date.now() - timestamp);
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.exp(-ageMs / oneWeekMs);
}

function stalePenalty(stale: boolean): number {
  return stale ? 0.35 : 1;
}

function normalizeRole(role: string | undefined): string {
  const trimmed = role?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "agent";
}

function defaultAgentContext(agentId: string, role?: string): AgentContext {
  return {
    agentId,
    role: normalizeRole(role),
    messages: [],
    toolResults: [],
    workingFiles: [],
    decisions: [],
    codeChanges: [],
    userPreferences: [],
    taskNotes: [],
    taskSummary: "",
    memoryRecords: [],
    updatedAt: Date.now(),
  };
}

function addUnique<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items : [...items, value];
}

function shouldUseSharedLookup(query: string): boolean {
  const normalized = query.toLowerCase();
  const triggers = [
    "project",
    "previous",
    "earlier",
    "history",
    "decision",
    "agent",
    "why",
    "changed",
    "file",
    "refactor",
    "remember",
    "context",
  ];
  return triggers.some((token) => normalized.includes(token));
}

function compileFilters(filters: MemorySearchFilters | undefined) {
  const types = filters?.types ? new Set(filters.types) : null;
  const tags = filters?.tags?.length ? new Set(filters.tags.map((t) => t.toLowerCase())) : null;
  const relatedFiles = filters?.relatedFiles?.length
    ? new Set(filters.relatedFiles.map((f) => f.toLowerCase()))
    : null;
  return {
    types,
    tags,
    relatedFiles,
    includeStale: filters?.includeStale ?? false,
    maxAgeMs: filters?.maxAgeMs,
    minImportanceScore: filters?.minImportanceScore,
    limit: filters?.limit ?? DEFAULT_RESULT_LIMIT,
  };
}

export function createProjectMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    agents: {},
    records: [],
    sharedIndex: [],
    lastUpdatedAt: Date.now(),
  };
}

export function ensureAgentContext(
  projectMemory: ProjectMemory,
  agentId: string,
  role?: string,
): AgentContext {
  const existing = projectMemory.agents[agentId];
  if (existing) {
    if (role && role.trim() && existing.role !== role.trim()) {
      existing.role = role.trim();
    }
    return existing;
  }
  const created = defaultAgentContext(agentId, role);
  projectMemory.agents[agentId] = created;
  return created;
}

export function addAgentMemory(
  projectMemory: ProjectMemory,
  agentId: string,
  record: Omit<MemoryRecord, "id" | "sourceAgentId" | "timestamp"> &
    Partial<Pick<MemoryRecord, "id" | "timestamp">> & { role?: string },
): MemoryRecord {
  const agent = ensureAgentContext(projectMemory, agentId, record.role);
  const id = record.id ?? crypto.randomUUID();
  const timestamp = record.timestamp ?? Date.now();
  const next: MemoryRecord = {
    id,
    sourceAgentId: agentId,
    timestamp,
    type: record.type,
    title: record.title.trim() || "Untitled memory",
    content: record.content.trim(),
    tags: Array.from(new Set(record.tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean))),
    relatedFiles: Array.from(new Set(record.relatedFiles.map((file) => file.trim()).filter(Boolean))),
    embedding: record.embedding,
    importanceScore: boundedScore(record.importanceScore ?? DEFAULT_IMPORTANCE_SCORE),
    stale: record.stale ?? false,
    supersedesRecordIds: record.supersedesRecordIds,
  };
  projectMemory.records.push(next);
  agent.memoryRecords = addUnique(agent.memoryRecords, next.id);
  agent.updatedAt = Date.now();
  for (const file of next.relatedFiles) {
    agent.workingFiles = addUnique(agent.workingFiles, file);
  }
  if (next.type === "tool-result") {
    agent.toolResults = addUnique(agent.toolResults, next.id);
  } else if (next.type === "decision") {
    agent.decisions = addUnique(agent.decisions, next.title);
  } else if (next.type === "code-change") {
    agent.codeChanges = addUnique(agent.codeChanges, next.title);
  } else if (next.type === "user-preference") {
    agent.userPreferences = addUnique(agent.userPreferences, next.content);
  } else {
    agent.taskNotes = addUnique(agent.taskNotes, next.title);
  }

  const terms = tokenize(
    [next.title, next.content, next.tags.join(" "), next.relatedFiles.join(" ")].join(" "),
  );
  projectMemory.sharedIndex.push({
    recordId: next.id,
    terms,
    termFrequency: buildTermFrequency(terms),
    lastIndexedAt: Date.now(),
  });
  projectMemory.lastUpdatedAt = Date.now();
  return next;
}

export function updateAgentSummary(
  projectMemory: ProjectMemory,
  agentId: string,
  role?: string,
): string {
  const agent = ensureAgentContext(projectMemory, agentId, role);
  const recentDecisions = agent.decisions.slice(-3);
  const recentFiles = agent.workingFiles.slice(-3);
  const recentNotes = agent.taskNotes.slice(-2);
  const summaryParts = [
    recentDecisions.length ? `Decisions: ${recentDecisions.join("; ")}` : "",
    recentFiles.length ? `Files: ${recentFiles.join(", ")}` : "",
    recentNotes.length ? `Notes: ${recentNotes.join("; ")}` : "",
  ].filter(Boolean);
  agent.taskSummary = summaryParts.join(" | ");
  agent.updatedAt = Date.now();
  projectMemory.lastUpdatedAt = Date.now();
  return agent.taskSummary;
}

function passesFilters(
  record: MemoryRecord,
  parsedFilters: ReturnType<typeof compileFilters>,
): boolean {
  if (!parsedFilters.includeStale && record.stale) return false;
  if (parsedFilters.types && !parsedFilters.types.has(record.type)) return false;
  if (
    typeof parsedFilters.minImportanceScore === "number" &&
    record.importanceScore < parsedFilters.minImportanceScore
  ) {
    return false;
  }
  if (typeof parsedFilters.maxAgeMs === "number") {
    const age = Date.now() - record.timestamp;
    if (age > parsedFilters.maxAgeMs) return false;
  }
  if (parsedFilters.tags) {
    const tags = new Set(record.tags.map((tag) => tag.toLowerCase()));
    const matched = Array.from(parsedFilters.tags).some((tag) => tags.has(tag));
    if (!matched) return false;
  }
  if (parsedFilters.relatedFiles) {
    const files = new Set(record.relatedFiles.map((file) => file.toLowerCase()));
    const matched = Array.from(parsedFilters.relatedFiles).some((file) => files.has(file));
    if (!matched) return false;
  }
  return true;
}

function scoreRecord(
  record: MemoryRecord,
  indexedTerms: string[],
  queryTerms: string[],
  requestingAgentId: string,
  queryEmbedding?: number[],
): RankedMemoryMatch {
  const indexSet = new Set(indexedTerms);
  const overlapping = queryTerms.filter((term) => indexSet.has(term));
  const lexicalScore = queryTerms.length
    ? overlapping.length / queryTerms.length
    : 0;
  const sameAgentBoost = record.sourceAgentId === requestingAgentId ? 0.18 : 0;
  const importanceScore = boundedScore(record.importanceScore);
  const freshness = recencyBoost(record.timestamp);
  const embeddingScore =
    queryEmbedding && record.embedding?.values
      ? boundedScore(cosineSimilarity(queryEmbedding, record.embedding.values))
      : 0;
  const relevance =
    (lexicalScore * 0.45 +
      embeddingScore * 0.3 +
      importanceScore * 0.15 +
      freshness * 0.1 +
      sameAgentBoost) *
    stalePenalty(record.stale);
  const reasons: string[] = [];
  if (overlapping.length > 0) reasons.push(`matched terms: ${overlapping.slice(0, 4).join(", ")}`);
  if (record.sourceAgentId !== requestingAgentId) reasons.push("from another agent");
  if (record.stale) reasons.push("stale");
  if (importanceScore >= 0.8) reasons.push("high-importance");
  return { record, relevanceScore: relevance, reasons };
}

export function searchProjectMemory(
  projectMemory: ProjectMemory,
  query: string,
  requestingAgentId: string,
  filters?: MemorySearchFilters & { queryEmbedding?: number[] },
): RankedMemoryMatch[] {
  const parsedFilters = compileFilters(filters);
  const queryTerms = tokenize(query);
  const queryEmbedding = filters?.queryEmbedding;
  const scored: RankedMemoryMatch[] = [];

  for (const indexed of projectMemory.sharedIndex) {
    const record = projectMemory.records.find((item) => item.id === indexed.recordId);
    if (!record) continue;
    if (!passesFilters(record, parsedFilters)) continue;
    const ranked = scoreRecord(
      record,
      indexed.terms,
      queryTerms,
      requestingAgentId,
      queryEmbedding,
    );
    if (ranked.relevanceScore > 0) {
      scored.push(ranked);
    }
  }

  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.record.timestamp - a.record.timestamp)
    .slice(0, parsedFilters.limit);
}

function conflictKey(record: MemoryRecord): string {
  const files = [...record.relatedFiles].sort().join("|");
  return `${record.type}:${record.title.trim().toLowerCase()}:${files}`;
}

export function resolveConflictingMemory(records: MemoryRecord[]): Array<{
  key: string;
  records: MemoryRecord[];
}> {
  const grouped = new Map<string, MemoryRecord[]>();
  for (const record of records) {
    const key = conflictKey(record);
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  }
  const conflicts: Array<{ key: string; records: MemoryRecord[] }> = [];
  for (const [key, group] of grouped.entries()) {
    if (group.length <= 1) continue;
    const distinctContent = new Set(group.map((record) => record.content.trim().toLowerCase()));
    const distinctAgents = new Set(group.map((record) => record.sourceAgentId));
    if (distinctContent.size > 1 && distinctAgents.size > 1) {
      conflicts.push({
        key,
        records: group.sort((a, b) => b.timestamp - a.timestamp),
      });
    }
  }
  return conflicts;
}

function toSnippet(
  match: RankedMemoryMatch,
  conflictRecordIds: Set<string>,
): RetrievedContextSnippet {
  return {
    recordId: match.record.id,
    sourceAgentId: match.record.sourceAgentId,
    title: match.record.title,
    content: match.record.content,
    type: match.record.type,
    relevanceScore: match.relevanceScore,
    stale: match.record.stale,
    conflict: conflictRecordIds.has(match.record.id),
    relatedFiles: match.record.relatedFiles,
  };
}

export function getRelevantContextForAgent(
  projectMemory: ProjectMemory,
  agentId: string,
  userRequest: AgentContextRequest,
): RetrievedAgentContext {
  const agent = ensureAgentContext(projectMemory, agentId);
  const needsSharedLookup = shouldUseSharedLookup(userRequest.query);
  const localSummary =
    agent.taskSummary ||
    updateAgentSummary(projectMemory, agentId) ||
    "No local summary yet.";
  const localRecords = projectMemory.records.filter(
    (record) => record.sourceAgentId === agentId && !record.stale,
  );
  const localMatches = searchProjectMemory(projectMemory, userRequest.query, agentId, {
    ...userRequest.searchFilters,
    relatedFiles: userRequest.relatedFiles,
    limit: Math.max(3, Math.floor((userRequest.maxSnippets ?? DEFAULT_RESULT_LIMIT) / 2)),
  });

  const totalSnippetBudget = userRequest.maxSnippets ?? DEFAULT_RESULT_LIMIT;
  const sharedBudget = needsSharedLookup
    ? totalSnippetBudget
    : Math.max(3, Math.floor(totalSnippetBudget / 2));
  const sharedMatches = searchProjectMemory(projectMemory, userRequest.query, agentId, {
    ...userRequest.searchFilters,
    relatedFiles: userRequest.relatedFiles,
    limit: sharedBudget,
  }).filter((entry) => entry.record.sourceAgentId !== agentId);

  const combined = [...localMatches, ...sharedMatches]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .filter(
      (entry, index, list) =>
        list.findIndex((candidate) => candidate.record.id === entry.record.id) ===
        index,
    )
    .slice(0, totalSnippetBudget);

  const conflicts = resolveConflictingMemory(
    combined.map((entry) => entry.record).concat(localRecords.slice(-6)),
  );
  const conflictRecordIds = new Set(
    conflicts.flatMap((conflict) => conflict.records.map((record) => record.id)),
  );
  return {
    localSummary,
    needsSharedLookup,
    snippets: combined.map((entry) => toSnippet(entry, conflictRecordIds)),
    conflicts: conflicts.map((conflict) => ({
      key: conflict.key,
      recordIds: conflict.records.map((record) => record.id),
      sourceAgentIds: Array.from(new Set(conflict.records.map((record) => record.sourceAgentId))),
    })),
  };
}

export function markMemoryStale(
  projectMemory: ProjectMemory,
  recordId: string,
  stale = true,
): boolean {
  const record = projectMemory.records.find((item) => item.id === recordId);
  if (!record) return false;
  record.stale = stale;
  projectMemory.lastUpdatedAt = Date.now();
  return true;
}

export function formatRetrievedContextForPrompt(
  retrieved: RetrievedAgentContext,
): string | null {
  if (!retrieved.snippets.length && !retrieved.localSummary) return null;
  const lines: string[] = [];
  lines.push("Agent memory context (filtered, ranked):");
  lines.push(`- Local summary: ${retrieved.localSummary}`);
  if (retrieved.snippets.length) {
    lines.push("- Retrieved records:");
    for (const snippet of retrieved.snippets) {
      const staleText = snippet.stale ? " [STALE]" : "";
      const conflictText = snippet.conflict ? " [CONFLICT]" : "";
      lines.push(
        `  - (${snippet.type}) ${snippet.title}${staleText}${conflictText}: ${snippet.content}`,
      );
    }
  }
  if (retrieved.conflicts.length) {
    lines.push("- Conflicts detected:");
    for (const conflict of retrieved.conflicts.slice(0, 3)) {
      lines.push(
        `  - ${conflict.key} across agents: ${conflict.sourceAgentIds.join(", ")}`,
      );
    }
  }
  return lines.join("\n");
}
