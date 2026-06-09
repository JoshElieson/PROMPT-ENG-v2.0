import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getModelById } from "@/data/ai-models";
import {
  aiChatComplete,
  aiChatSynthesize,
  listenAiToolActivity,
  normalizeTargetModelIds,
  type AiToolActivityEvent,
  type ChatTurn,
} from "@/lib/ai-chat";
import { resolveQueuedMessageBehavior } from "@/lib/chat-behavior";
import {
  chatHasMessages,
  chatShouldPersist,
  DEFAULT_AGENT_SYSTEM_PROMPT,
  defaultThreadTitle,
  threadDisplayTitle,
} from "@/lib/chat-utils";
import { recordGoToRecent } from "@/lib/go-to-recents";
import type { QueuedMessageBehavior } from "@/types/chat-behavior";
import {
  buildAgentPermissionsSystemNote,
  isPaneActionAllowed,
  resolveAgentPermissions,
  serializeAgentPermissions,
} from "@/lib/agent-permissions";
import {
  canAutoTitleWorkspace,
  fallbackWorkspaceTitle,
  generateWorkspaceTitleWithAi,
  workspaceUserMessageCount,
} from "@/lib/workspace-title";
import { useApiUsage } from "@/contexts/ApiUsageContext";
import { isTauri } from "@/lib/tauri";
import { evenContributions } from "@/lib/round-table-weights";
import {
  recordResponseEstimates,
  recordSendEstimates,
} from "@/lib/token-usage";
import {
  loadActiveChatId,
  loadChats,
  loadProjectMemories,
  loadProjects,
  saveActiveChatId,
  saveChats,
  saveProjectMemories,
} from "@/lib/storage";
import {
  collapseWorkspaceByLeaf,
  collectLeaves,
  ensureFocusedLeafExists,
  expandWorkspaceLayout,
  reconcileWorkspaceThreads,
} from "@/lib/center-workspace-layout";
import { createDefaultWorkspaceLayout } from "@/lib/workspace-pane-storage";
import { useLayout } from "@/contexts/LayoutContext";
import { useUserXp } from "@/contexts/UserXpContext";
import { extractAssistantPaneActions } from "@/lib/assistant-pane-actions";
import {
  AI_UI_COMMAND_SYSTEM_GUIDANCE,
  extractAssistantUiCommands,
} from "@/lib/assistant-ui-commands";
import { extractAssistantProjectTools } from "@/lib/assistant-project-tools";
import {
  buildGitCommandsSystemGuidance,
  extractAssistantGitCommands,
} from "@/lib/assistant-git-commands";
import {
  executeGitAssistantCommands,
  formatGitCommandResults,
} from "@/lib/execute-git-assistant-command";
import {
  applyProjectToolsPatches,
  dedupeProjectTools,
  formatProjectToolsPrompt,
  PROJECT_TOOLS_UPDATE_GUIDANCE,
} from "@/lib/project-tools";
import {
  addAgentMemory,
  createProjectMemory,
  ensureAgentContext,
  formatRetrievedContextForPrompt,
  getRelevantContextForAgent,
  updateAgentSummary,
} from "@/lib/project-memory";
import { notifyAgentFinishedWhenBackgrounded, notifyAgentNeedsAttentionWhenBackgrounded } from "@/lib/agent-finish-notification";
import { readAppSettings } from "@/lib/app-settings-storage";
import { playCompletionSound } from "@/lib/completion-sound";
import type { NodePermissions } from "@/types/project";
import type {
  AiWorkspacePayload,
  Chat,
  ChatMessage,
  ChatThread,
  ResponseLoadingState,
  SendMessagePayload,
} from "@/types/chat";
import type { ProjectMemory } from "@/types/agent-memory";
import type { AgentPermissions } from "@/types/agent-permissions";
import type { WorkspacePaneLayout } from "@/types/workspace-pane";
import type {
  AgentActivityEvent,
  AgentActivityType,
} from "@/types/agent-activity";
import { useAiCommandBus } from "@/contexts/AiCommandBusContext";
import { useAppToast } from "@/contexts/AppToastContext";

interface ChatsContextValue {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
  activeWorkspaceLayout: WorkspacePaneLayout | null;
  patchActiveWorkspaceLayout: (
    fn: (prev: WorkspacePaneLayout) => WorkspacePaneLayout,
  ) => void;
  expandActiveWorkspaceLayout: (aspectWide: boolean) => boolean;
  /** Removes the pane for this leaf (4→3→2→1) and drops its thread. */
  closeActiveWorkspaceLeaf: (leafId: string) => boolean;
  responseLoading: ResponseLoadingState | null;
  createChat: (options?: {
    title?: string;
    titleLocked?: boolean;
    persistImmediately?: boolean;
  }) => string;
  /** Same entry point as File → New Project and the projects sidebar "+ New" button. */
  startNewProject: () => string;
  renamingChatId: string | null;
  setRenamingChatId: (id: string | null) => void;
  selectChat: (id: string) => void;
  /** Activate a workspace and focus a specific agent (thread) pane within it. */
  selectAgent: (chatId: string, threadId: string) => void;
  renameChat: (id: string, title: string) => void;
  renameThread: (threadId: string, title: string) => void;
  /** Per-agent settings (name, system prompt) scoped to one thread. */
  patchAgentSettings: (
    chatId: string,
    threadId: string,
    patch: {
      title?: string;
      systemPrompt?: string;
      agentPermissions?: AgentPermissions;
    },
  ) => void;
  /** Project-wide settings shared by all agents in the chat. */
  patchWorkspaceSettings: (
    chatId: string,
    patch: {
      title?: string;
      projectDescription?: string;
      projectTools?: string[];
      fileAccessEnabled?: boolean;
      multiModelMode?: boolean;
      autoScrollEnabled?: boolean;
      queuedMessageBehavior?: QueuedMessageBehavior;
    },
  ) => void;
  /** Stops the in-flight AI response for this thread without closing the tab. */
  forceKillThread: (threadId: string) => void;
  togglePinChat: (id: string) => void;
  deleteChat: (id: string) => void;
  sendMessage: (payload: SendMessagePayload) => void;
  truncateThreadAfterMessage: (
    chatId: string,
    threadId: string,
    messageId: string,
  ) => void;
  /** Messages waiting to send after the current response on this thread. */
  getQueuedMessageCount: (chatId: string, threadId: string) => number;
  getStreamingActivities: (
    chatId: string,
    threadId: string,
  ) => AiToolActivityEvent[];
  getAgentActivityEvents: (
    chatId: string,
    threadId: string,
  ) => AgentActivityEvent[];
  updateChatPermissions: (
    chatId: string,
    updater: (
      prev: Record<string, NodePermissions>,
    ) => Record<string, NodePermissions>,
  ) => void;
  setChatPermissions: (
    chatId: string,
    permissions: Record<string, NodePermissions>,
  ) => void;
  setChatGitProject: (chatId: string, projectId: string | null) => void;
  canUndoActiveChat: boolean;
  canRedoActiveChat: boolean;
  undoActiveChat: () => boolean;
  redoActiveChat: () => boolean;
}

const ChatsContext = createContext<ChatsContextValue | null>(null);

function resolveActiveId(chats: Chat[], storedId: string | null): string | null {
  if (storedId && chats.some((c) => c.id === storedId)) return storedId;
  if (chats.length === 0) return null;
  return chats[0].id;
}

function buildEmptyChat(options?: { title?: string; titleLocked?: boolean }): Chat {
  const now = Date.now();
  const tid = crypto.randomUUID();
  const title = options?.title?.trim() || "New Chat";
  return {
    id: crypto.randomUUID(),
    title,
    titleLocked: options?.titleLocked,
    threads: [{ id: tid, messages: [], createdAt: now, updatedAt: now }],
    nextAgentNumber: 2,
    createdAt: now,
    updatedAt: now,
    permissions: {},
    gitProjectId: null,
    workspace: createDefaultWorkspaceLayout(tid),
  };
}

function partitionLoadedChats(
  loaded: Chat[],
  storedActiveId: string | null,
): { chats: Chat[]; draftChat: Chat | null; activeChatId: string | null } {
  const normalized = loaded.map((chat) => {
    if (chat.hadMessages || chatHasMessages(chat)) {
      return { ...chat, hadMessages: true };
    }
    return chat;
  });
  const chats = normalized.filter(chatShouldPersist);
  const empty = normalized.filter((c) => !chatShouldPersist(c));
  const draftFromActive = storedActiveId
    ? (empty.find((c) => c.id === storedActiveId) ?? null)
    : null;
  const draftChat = draftFromActive ?? empty[0] ?? null;
  const activeChatId = draftChat?.id ?? resolveActiveId(chats, storedActiveId);
  return { chats, draftChat, activeChatId };
}

function resolveThreadId(chat: Chat, threadId: string | null | undefined): string {
  if (threadId && chat.threads.some((t) => t.id === threadId)) return threadId;
  if (chat.threads[0]) return chat.threads[0].id;
  return crypto.randomUUID();
}

function inferNextAgentNumber(chat: Chat): number {
  let max = 1;
  for (const thread of chat.threads) {
    const title = thread.title?.trim();
    if (!title) continue;
    const match = /^Agent\s+(\d+)$/i.exec(title);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return Math.max(max + 1, chat.threads.length + 1);
}

function threadResponseKey(chatId: string, threadId: string): string {
  return `${chatId}:${threadId}`;
}

function makeAiStreamId(chatId: string, threadId: string, runId: number): string {
  return `${chatId}|${threadId}|${runId}`;
}

function parseAiStreamId(streamId: string): {
  chatId: string;
  threadId: string;
  runId: number;
} | null {
  const [chatId, threadId, runIdRaw] = streamId.split("|");
  if (!chatId || !threadId || !runIdRaw) return null;
  const runId = Number(runIdRaw);
  if (!Number.isFinite(runId)) return null;
  return { chatId, threadId, runId };
}

function findChatSnapshot(
  chats: Chat[],
  draftChat: Chat | null,
  chatId: string,
): Chat | null {
  if (draftChat?.id === chatId) return draftChat;
  return chats.find((c) => c.id === chatId) ?? null;
}

function resolveAgentNotificationParams(
  chatSnapshot: Chat,
  threadId: string,
): { workspaceName: string; agentName: string } {
  const threadIndex = chatSnapshot.threads.findIndex((thread) => thread.id === threadId);
  const thread = threadIndex >= 0 ? chatSnapshot.threads[threadIndex] : undefined;
  return {
    workspaceName: chatSnapshot.title?.trim() || "Workspace",
    agentName: thread
      ? threadDisplayTitle(thread, threadIndex)
      : defaultThreadTitle(0),
  };
}

function buildThreadHistory(chat: Chat, threadId: string): ChatTurn[] {
  const thread = chat.threads.find((t) => t.id === threadId);
  return (thread?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function cloneChatSnapshot(chat: Chat): Chat {
  return structuredClone(chat);
}

function resolveThreadRole(chat: Chat, threadId: string): string {
  const thread = chat.threads.find((item) => item.id === threadId);
  return thread?.title?.trim() || `Agent ${threadId.slice(0, 6)}`;
}

function buildMemoryTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0] ?? "";
  const trimmed = firstLine.trim();
  if (!trimmed) return "Context note";
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}...`;
}

type CommittedSend = {
  resolvedChatId: string;
  finalThreadId: string;
  trimmed: string;
  history: ChatTurn[];
  targetModelIds: string[];
  contributions: { modelId: string; percentage: number }[];
  workspace?: AiWorkspacePayload;
};

function appendUserMessageToThread(
  list: Chat[],
  chatId: string | null,
  threadId: string | null,
  userMessage: ChatMessage,
  trimmed: string,
  now: number,
): { chats: Chat[]; resolvedChatId: string; resolvedThreadId: string } {
  if (!chatId || !list.some((c) => c.id === chatId)) {
    const tid = crypto.randomUUID();
    const cid = crypto.randomUUID();
    const chat: Chat = {
      id: cid,
      title: fallbackWorkspaceTitle(trimmed || "Attachments"),
      hadMessages: true,
      threads: [
        {
          id: tid,
          messages: [userMessage],
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      nextAgentNumber: 2,
      permissions: {},
      workspace: createDefaultWorkspaceLayout(tid),
    };
    return { chats: [chat, ...list], resolvedChatId: cid, resolvedThreadId: tid };
  }

  const targetChat = list.find((c) => c.id === chatId)!;
  const tid = resolveThreadId(targetChat, threadId);

  return {
    resolvedChatId: chatId,
    resolvedThreadId: tid,
    chats: list.map((chat) => {
      if (chat.id !== chatId) return chat;
      const threads = chat.threads.map((th) => {
        if (th.id !== tid) return th;
        return {
          ...th,
          messages: [...th.messages, userMessage],
          updatedAt: now,
        };
      });
      const isFirstWorkspaceMessage = workspaceUserMessageCount(chat) === 0;
      return {
        ...chat,
        hadMessages: true,
        threads,
        title:
          isFirstWorkspaceMessage && canAutoTitleWorkspace(chat)
            ? fallbackWorkspaceTitle(trimmed || "Attachments")
            : chat.title,
        updatedAt: now,
      };
    }),
  };
}

function appendAssistantToThread(
  list: Chat[],
  chatId: string,
  threadId: string,
  assistantMessage: ChatMessage,
): Chat[] {
  return list.map((chat) => {
    if (chat.id !== chatId) return chat;
    return {
      ...chat,
      threads: chat.threads.map((th) =>
        th.id === threadId
          ? {
              ...th,
              messages: [...th.messages, assistantMessage],
              updatedAt: assistantMessage.createdAt,
            }
          : th,
      ),
      updatedAt: assistantMessage.createdAt,
    };
  });
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { addUsage, isAtTokenLimit, tokenLimitMessage, isSignedIn, signInRequiredMessage } =
    useApiUsage();
  const { awardNewAgent } = useUserXp();
  const {
    requestBottomPanelTab,
    setWorkspaceBottomPanelOpen,
    setLeftSidebarViewVisible,
  } = useLayout();
  const { enqueueCommands } = useAiCommandBus();
  const { pushToast } = useAppToast();
  const boot = useMemo(() => {
    const loaded = loadChats();
    return partitionLoadedChats(loaded, loadActiveChatId());
  }, []);

  const [chats, setChats] = useState<Chat[]>(boot.chats);
  const [draftChat, setDraftChat] = useState<Chat | null>(boot.draftChat);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    boot.activeChatId,
  );
  const [responseLoading, setResponseLoading] =
    useState<ResponseLoadingState | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const responseRunRef = useRef(0);
  const inFlightThreadsRef = useRef(new Set<string>());
  const queuedSendsRef = useRef(new Map<string, SendMessagePayload[]>());
  const projectMemoriesRef = useRef<Record<string, ProjectMemory>>(
    loadProjectMemories(),
  );
  const chatsRef = useRef(chats);
  const draftChatRef = useRef(draftChat);
  const flushQueueRef = useRef<(chatId: string, threadId: string) => void>(
    () => {},
  );
  const [queuedCountByKey, setQueuedCountByKey] = useState<
    Record<string, number>
  >({});
  const [streamingActivitiesByKey, setStreamingActivitiesByKey] = useState<
    Record<string, AiToolActivityEvent[]>
  >({});
  const [agentActivitiesByKey, setAgentActivitiesByKey] = useState<
    Record<string, AgentActivityEvent[]>
  >({});
  const activeStreamIdByThreadRef = useRef(new Map<string, string>());
  const undoHistoryByChatRef = useRef(new Map<string, Chat[]>());
  const redoHistoryByChatRef = useRef(new Map<string, Chat[]>());
  const [activeHistoryState, setActiveHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const MAX_CHAT_HISTORY = 50;

  useEffect(() => {
    chatsRef.current = chats;
    draftChatRef.current = draftChat;
  }, [chats, draftChat]);

  const syncActiveHistoryState = useCallback(
    (chatId: string | null) => {
      if (!chatId) {
        setActiveHistoryState({ canUndo: false, canRedo: false });
        return;
      }
      const canUndo = (undoHistoryByChatRef.current.get(chatId)?.length ?? 0) > 0;
      const canRedo = (redoHistoryByChatRef.current.get(chatId)?.length ?? 0) > 0;
      setActiveHistoryState((prev) => {
        if (prev.canUndo === canUndo && prev.canRedo === canRedo) return prev;
        return { canUndo, canRedo };
      });
    },
    [],
  );

  const getChatByIdSnapshot = useCallback((chatId: string): Chat | null => {
    return findChatSnapshot(chatsRef.current, draftChatRef.current, chatId);
  }, []);

  const pushUndoSnapshot = useCallback(
    (chatId: string, snapshot: Chat) => {
      const undoStack = undoHistoryByChatRef.current.get(chatId) ?? [];
      const nextUndoStack = [...undoStack, cloneChatSnapshot(snapshot)];
      if (nextUndoStack.length > MAX_CHAT_HISTORY) {
        nextUndoStack.splice(0, nextUndoStack.length - MAX_CHAT_HISTORY);
      }
      undoHistoryByChatRef.current.set(chatId, nextUndoStack);
      redoHistoryByChatRef.current.set(chatId, []);
      if (chatId === activeChatId) {
        syncActiveHistoryState(chatId);
      }
    },
    [activeChatId, syncActiveHistoryState],
  );

  const applyChatSnapshot = useCallback((chatId: string, snapshot: Chat) => {
    const next = cloneChatSnapshot(snapshot);
    if (draftChatRef.current?.id === chatId) {
      draftChatRef.current = next;
      setDraftChat(next);
      return;
    }
    setChats((prev) => {
      const updated = prev.map((chat) => (chat.id === chatId ? next : chat));
      chatsRef.current = updated;
      return updated;
    });
  }, []);

  useEffect(() => {
    syncActiveHistoryState(activeChatId);
  }, [activeChatId, syncActiveHistoryState]);

  const syncQueueCount = useCallback((key: string, count: number) => {
    setQueuedCountByKey((prev) => {
      if (count <= 0) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === count) return prev;
      return { ...prev, [key]: count };
    });
  }, []);

  const clearMessageQueue = useCallback(
    (chatId: string, threadId: string) => {
      const key = threadResponseKey(chatId, threadId);
      queuedSendsRef.current.delete(key);
      syncQueueCount(key, 0);
    },
    [syncQueueCount],
  );

  const enqueueMessage = useCallback(
    (key: string, payload: SendMessagePayload) => {
      const queue = queuedSendsRef.current.get(key) ?? [];
      queue.push(payload);
      queuedSendsRef.current.set(key, queue);
      syncQueueCount(key, queue.length);
    },
    [syncQueueCount],
  );

  const getQueuedMessageCount = useCallback(
    (chatId: string, threadId: string) =>
      queuedCountByKey[threadResponseKey(chatId, threadId)] ?? 0,
    [queuedCountByKey],
  );

  const clearStreamingActivities = useCallback((chatId: string, threadId: string) => {
    const key = threadResponseKey(chatId, threadId);
    setStreamingActivitiesByKey((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const getStreamingActivities = useCallback(
    (chatId: string, threadId: string) =>
      streamingActivitiesByKey[threadResponseKey(chatId, threadId)] ?? [],
    [streamingActivitiesByKey],
  );

  const clearAgentActivityEvents = useCallback((chatId: string, threadId: string) => {
    const key = threadResponseKey(chatId, threadId);
    setAgentActivitiesByKey((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const appendAgentActivityEvent = useCallback(
    (
      chatId: string,
      threadId: string,
      type: AgentActivityType,
      message: string,
      filePath?: string,
    ) => {
      const key = threadResponseKey(chatId, threadId);
      const trimmed = message.trim();
      if (!trimmed) return;
      const event: AgentActivityEvent = {
        id: crypto.randomUUID(),
        type,
        message: trimmed,
        timestamp: Date.now(),
        filePath: filePath?.trim() || undefined,
      };
      setAgentActivitiesByKey((prev) => {
        const existing = prev[key] ?? [];
        const next = [...existing, event].slice(-80);
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const getAgentActivityEvents = useCallback(
    (chatId: string, threadId: string) =>
      agentActivitiesByKey[threadResponseKey(chatId, threadId)] ?? [],
    [agentActivitiesByKey],
  );

  const persistProjectMemories = useCallback(() => {
    saveProjectMemories(projectMemoriesRef.current);
  }, []);

  const getOrCreateProjectMemory = useCallback(
    (chat: Chat): ProjectMemory => {
      const key = chat.id;
      const existing = projectMemoriesRef.current[key];
      if (existing) {
        if (
          chat.gitProjectId &&
          existing.projectId.startsWith("chat:") &&
          existing.projectId !== chat.gitProjectId
        ) {
          existing.projectId = chat.gitProjectId;
          existing.lastUpdatedAt = Date.now();
          persistProjectMemories();
        }
        return existing;
      }
      const next = createProjectMemory(chat.gitProjectId ?? `chat:${chat.id}`);
      projectMemoriesRef.current[key] = next;
      persistProjectMemories();
      return next;
    },
    [persistProjectMemories],
  );

  const addMessageMemoryRecord = useCallback(
    (
      chat: Chat,
      threadId: string,
      role: "user" | "assistant",
      content: string,
      relatedFiles: string[],
    ) => {
      const projectMemory = getOrCreateProjectMemory(chat);
      const threadRole = resolveThreadRole(chat, threadId);
      const agent = ensureAgentContext(projectMemory, threadId, threadRole);
      agent.messages = [...agent.messages, { role, content }].slice(-50);
      addAgentMemory(projectMemory, threadId, {
        role: threadRole,
        type: role === "assistant" ? "summary" : "summary",
        title: buildMemoryTitle(content),
        content,
        tags: [
          role,
          threadRole.toLowerCase(),
          ...(role === "assistant" ? ["response"] : ["request"]),
        ],
        relatedFiles,
        importanceScore: role === "assistant" ? 0.62 : 0.55,
        stale: false,
      });
      updateAgentSummary(projectMemory, threadId, threadRole);
      persistProjectMemories();
    },
    [getOrCreateProjectMemory, persistProjectMemories],
  );

  const getRetrievedMemoryPrompt = useCallback(
    (chat: Chat, threadId: string, userRequest: string): string | null => {
      const projectMemory = getOrCreateProjectMemory(chat);
      const relatedFiles = Object.entries(chat.permissions ?? {})
        .filter(([, permission]) => permission.enabled)
        .map(([path]) => path)
        .slice(0, 20);
      const retrieved = getRelevantContextForAgent(projectMemory, threadId, {
        query: userRequest,
        relatedFiles,
        maxSnippets: 6,
      });
      return formatRetrievedContextForPrompt(retrieved);
    },
    [getOrCreateProjectMemory],
  );

  useEffect(() => {
    saveChats(chats.filter(chatShouldPersist));
  }, [chats]);

  useEffect(() => {
    saveActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let off: (() => void) | undefined;
    void listenAiToolActivity((event) => {
      const parsed = parseAiStreamId(event.streamId);
      if (!parsed) return;
      const key = threadResponseKey(parsed.chatId, parsed.threadId);
      const activeStreamId = activeStreamIdByThreadRef.current.get(key);
      if (!activeStreamId || activeStreamId !== event.streamId) return;
      setStreamingActivitiesByKey((prev) => {
        const existing = prev[key] ?? [];
        const next = [...existing, event].slice(-40);
        return { ...prev, [key]: next };
      });
      appendAgentActivityEvent(
        parsed.chatId,
        parsed.threadId,
        event.action === "read" ? "reading" : "editing",
        event.action === "read"
          ? `Reading ${event.path}`
          : `Editing ${event.path}`,
        event.path,
      );
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        off = unlisten;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      off?.();
    };
  }, [appendAgentActivityEvent]);

  useEffect(() => {
    if (!activeChatId) return;
    const isDraft = draftChat?.id === activeChatId;
    const isSaved = chats.some((c) => c.id === activeChatId);
    if (!isDraft && !isSaved) {
      const nextId = draftChat?.id ?? chats[0]?.id ?? null;
      queueMicrotask(() => setActiveChatId(nextId));
    }
  }, [chats, activeChatId, draftChat]);

  const activeWorkspaceLayout = useMemo(() => {
    const c =
      (draftChat?.id === activeChatId ? draftChat : null) ??
      chats.find((x) => x.id === activeChatId);
    if (!c?.threads[0]) return null;
    const t0 = c.threads[0].id;
    const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
    const valid = new Set(c.threads.map((t) => t.id));
    return ensureFocusedLeafExists(
      reconcileWorkspaceThreads(base, valid, t0),
    );
  }, [chats, activeChatId, draftChat]);

  const patchActiveChat = useCallback(
    (updater: (chat: Chat) => Chat) => {
      if (!activeChatId) return;
      if (draftChat?.id === activeChatId) {
        setDraftChat((prev) => (prev ? updater(prev) : null));
        return;
      }
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? updater(c) : c)),
      );
    },
    [activeChatId, draftChat?.id],
  );

  const patchActiveWorkspaceLayout = useCallback(
    (fn: (prev: WorkspacePaneLayout) => WorkspacePaneLayout) => {
      patchActiveChat((c) => {
        const t0 = c.threads[0]?.id;
        if (!t0) return c;
        const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
        const valid = new Set(c.threads.map((t) => t.id));
        const reconciled = ensureFocusedLeafExists(
          reconcileWorkspaceThreads(base, valid, t0),
        );
        const next = ensureFocusedLeafExists(fn(reconciled));
        return { ...c, workspace: next, updatedAt: Date.now() };
      });
    },
    [patchActiveChat],
  );

  const expandActiveWorkspaceLayout = useCallback(
    (aspectWide: boolean): boolean => {
      if (!activeChatId) return false;
      let ok = false;
      const expand = (c: Chat): Chat => {
        const newTid = crypto.randomUUID();
        const t0 = c.threads[0]?.id;
        if (!t0) return c;
        const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
        const expanded = expandWorkspaceLayout(base, aspectWide, newTid);
        if (!expanded) return c;
        ok = true;
        const nextAgentNumber = c.nextAgentNumber ?? inferNextAgentNumber(c);
        const newThread: ChatThread = {
          id: newTid,
          title: defaultThreadTitle(nextAgentNumber - 1),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return {
          ...c,
          threads: [...c.threads, newThread],
          nextAgentNumber: nextAgentNumber + 1,
          workspace: ensureFocusedLeafExists(expanded),
          updatedAt: Date.now(),
        };
      };
      if (draftChat?.id === activeChatId) {
        setDraftChat((prev) => (prev ? expand(prev) : null));
      } else {
        setChats((prev) =>
          prev.map((c) => (c.id === activeChatId ? expand(c) : c)),
        );
      }
      if (ok) awardNewAgent();
      return ok;
    },
    [activeChatId, draftChat?.id, awardNewAgent],
  );

  const closeActiveWorkspaceLeaf = useCallback(
    (leafId: string): boolean => {
      if (!activeChatId) return false;

      let didMutate = false;
      let removedThreadId: string | null = null;

      const applyClose = (chat: Chat): Chat | null => {
        if (!chat.threads[0]) return null;
        const t0 = chat.threads[0].id;
        const base = chat.workspace ?? createDefaultWorkspaceLayout(t0);
        const valid = new Set(chat.threads.map((t) => t.id));
        const reconciled = ensureFocusedLeafExists(
          reconcileWorkspaceThreads(base, valid, t0),
        );
        const collapsed = collapseWorkspaceByLeaf(reconciled, leafId);
        if (!collapsed) return null;
        const threads = chat.threads.filter(
          (t) => t.id !== collapsed.removedThreadId,
        );
        if (threads.length === 0) return null;
        didMutate = true;
        removedThreadId = collapsed.removedThreadId;
        return {
          ...chat,
          threads,
          workspace: ensureFocusedLeafExists(collapsed.layout),
          updatedAt: Date.now(),
        };
      };

      if (draftChat?.id === activeChatId) {
        const next = applyClose(draftChat);
        if (next) setDraftChat(next);
      } else {
        setChats((prev) => {
          const chat = prev.find((c) => c.id === activeChatId);
          if (!chat) return prev;
          const next = applyClose(chat);
          if (!next) return prev;
          return prev.map((c) => (c.id === activeChatId ? next : c));
        });
      }

      if (!didMutate) return false;

      setResponseLoading((rl) => {
        if (
          rl &&
          rl.chatId === activeChatId &&
          removedThreadId &&
          rl.threadId === removedThreadId
        ) {
          responseRunRef.current += 1;
          clearMessageQueue(rl.chatId, removedThreadId);
          const key = threadResponseKey(rl.chatId, removedThreadId);
          activeStreamIdByThreadRef.current.delete(key);
          clearStreamingActivities(rl.chatId, removedThreadId);
          inFlightThreadsRef.current.delete(key);
          return null;
        }
        return rl;
      });

      return true;
    },
    [activeChatId, draftChat, clearMessageQueue, clearStreamingActivities],
  );

  const createChat = useCallback((options?: {
    title?: string;
    titleLocked?: boolean;
    persistImmediately?: boolean;
  }): string => {
    const chat = buildEmptyChat(options);
    if (options?.persistImmediately) {
      setChats((prev) => [chat, ...prev]);
      setDraftChat(null);
    } else {
      setDraftChat(chat);
    }
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const startNewProject = useCallback(() => {
    const id = createChat({ title: "New Project" });
    setRenamingChatId(id);
    return id;
  }, [createChat]);

  const selectChat = useCallback((id: string) => {
    setDraftChat((prev) => {
      if (!prev) return prev;
      if (id === prev.id) return prev;
      if (chatShouldPersist(prev)) {
        setChats((existing) => {
          if (existing.some((chat) => chat.id === prev.id)) return existing;
          return [prev, ...existing];
        });
      }
      return null;
    });
    setActiveChatId(id);
  }, []);

  const selectAgent = useCallback(
    (chatId: string, threadId: string) => {
      const focusThread = (chat: Chat): Chat => {
        const t0 = chat.threads[0]?.id;
        if (!t0) return chat;
        const base = chat.workspace ?? createDefaultWorkspaceLayout(t0);
        const valid = new Set(chat.threads.map((t) => t.id));
        const reconciled = ensureFocusedLeafExists(
          reconcileWorkspaceThreads(base, valid, t0),
        );
        const leaf = collectLeaves(reconciled.root).find(
          (item) => item.threadId === threadId,
        );
        return {
          ...chat,
          workspace: {
            ...reconciled,
            focusedLeafId: leaf?.id ?? reconciled.focusedLeafId,
          },
          updatedAt: Date.now(),
        };
      };

      selectChat(chatId);
      setDraftChat((prev) =>
        prev && prev.id === chatId ? focusThread(prev) : prev,
      );
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? focusThread(chat) : chat)),
      );
    },
    [selectChat],
  );

  const patchChatById = useCallback(
    (chatId: string, updater: (chat: Chat) => Chat) => {
      const current = getChatByIdSnapshot(chatId);
      if (!current) return;
      pushUndoSnapshot(chatId, current);
      if (draftChat?.id === chatId) {
        setDraftChat((prev) => (prev ? updater(prev) : null));
        return;
      }
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? updater(chat) : chat)),
      );
    },
    [draftChat?.id, getChatByIdSnapshot, pushUndoSnapshot],
  );

  const renameChat = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      patchChatById(id, (chat) => ({
        ...chat,
        title: trimmed,
        titleLocked: true,
        updatedAt: Date.now(),
      }));
    },
    [patchChatById],
  );

  const refineWorkspaceTitle = useCallback(
    async (chatId: string, userMessage: string) => {
      if (!isTauri()) return;
      try {
        const title = await generateWorkspaceTitleWithAi(userMessage);
        patchChatById(chatId, (chat) => {
          if (!canAutoTitleWorkspace(chat)) return chat;
          if (workspaceUserMessageCount(chat) !== 1) return chat;
          return { ...chat, title, updatedAt: Date.now() };
        });
      } catch {
        // Keep the fallback title from the first message.
      }
    },
    [patchChatById],
  );

  const renameThread = useCallback(
    (threadId: string, title: string) => {
      if (!activeChatId) return;
      const trimmed = title.trim();
      if (!trimmed) return;
      patchChatById(activeChatId, (chat) => ({
        ...chat,
        threads: chat.threads.map((t) =>
          t.id === threadId
            ? { ...t, title: trimmed, updatedAt: Date.now() }
            : t,
        ),
        updatedAt: Date.now(),
      }));
    },
    [activeChatId, patchChatById],
  );

  const patchAgentSettings = useCallback(
    (
      chatId: string,
      threadId: string,
      patch: {
        title?: string;
        systemPrompt?: string;
        agentPermissions?: AgentPermissions;
      },
    ) => {
      patchChatById(chatId, (chat) => {
        const threadIndex = chat.threads.findIndex((t) => t.id === threadId);
        if (threadIndex < 0) return chat;
        const now = Date.now();
        return {
          ...chat,
          threads: chat.threads.map((t) => {
            if (t.id !== threadId) return t;
            const next: ChatThread = { ...t, updatedAt: now };
            if (patch.title !== undefined) {
              const trimmed = patch.title.trim();
              next.title = trimmed || undefined;
            }
            if (patch.systemPrompt !== undefined) {
              const trimmed = patch.systemPrompt.trim();
              next.systemPrompt = trimmed || undefined;
            }
            if (patch.agentPermissions !== undefined) {
              next.agentPermissions = serializeAgentPermissions(
                patch.agentPermissions,
              );
            }
            return next;
          }),
          updatedAt: now,
        };
      });
    },
    [patchChatById],
  );

  const patchWorkspaceSettings = useCallback(
    (
      chatId: string,
      patch: {
        title?: string;
        projectDescription?: string;
        projectTools?: string[];
        fileAccessEnabled?: boolean;
        multiModelMode?: boolean;
        autoScrollEnabled?: boolean;
        queuedMessageBehavior?: QueuedMessageBehavior;
      },
    ) => {
      patchChatById(chatId, (chat) => {
        const now = Date.now();
        const next: Chat = { ...chat, updatedAt: now };
        if (patch.title !== undefined) {
          const trimmed = patch.title.trim();
          if (trimmed) {
            next.title = trimmed;
            next.titleLocked = true;
          }
        }
        if (patch.projectDescription !== undefined) {
          const trimmed = patch.projectDescription.trim();
          next.projectDescription = trimmed || undefined;
        }
        if (patch.projectTools !== undefined) {
          const normalized = dedupeProjectTools(patch.projectTools);
          next.projectTools = normalized.length > 0 ? normalized : undefined;
        }
        if (patch.fileAccessEnabled !== undefined) {
          next.fileAccessEnabled = patch.fileAccessEnabled;
        }
        if (patch.multiModelMode !== undefined) {
          next.multiModelMode = patch.multiModelMode;
        }
        if (patch.autoScrollEnabled !== undefined) {
          next.autoScrollEnabled = patch.autoScrollEnabled;
        }
        if (patch.queuedMessageBehavior !== undefined) {
          next.queuedMessageBehavior = patch.queuedMessageBehavior;
        }
        return next;
      });
    },
    [patchChatById],
  );

  const interruptThreadResponse = useCallback(
    (chatId: string, threadId: string) => {
      const key = threadResponseKey(chatId, threadId);
      if (!inFlightThreadsRef.current.has(key)) return;

      responseRunRef.current += 1;
      clearMessageQueue(chatId, threadId);
      activeStreamIdByThreadRef.current.delete(key);
      clearStreamingActivities(chatId, threadId);
      appendAgentActivityEvent(chatId, threadId, "error", "Run interrupted");
      inFlightThreadsRef.current.delete(key);
      setResponseLoading((rl) => {
        if (rl?.chatId === chatId && rl.threadId === threadId) return null;
        return rl;
      });
    },
    [appendAgentActivityEvent, clearMessageQueue, clearStreamingActivities],
  );

  const forceKillThread = useCallback(
    (threadId: string) => {
      if (!activeChatId) return;
      interruptThreadResponse(activeChatId, threadId);
    },
    [activeChatId, interruptThreadResponse],
  );

  const togglePinChat = useCallback(
    (id: string) => {
      patchChatById(id, (chat) => ({
        ...chat,
        pinned: !chat.pinned,
        updatedAt: Date.now(),
      }));
    },
    [patchChatById],
  );

  const deleteChat = useCallback(
    (id: string) => {
      const nextDraft =
        draftChatRef.current?.id === id ? null : draftChatRef.current;
      const nextChats = chatsRef.current.filter((c) => c.id !== id);

      setDraftChat(nextDraft);
      setChats(nextChats);
      setRenamingChatId((current) => (current === id ? null : current));
      setActiveChatId((current) => {
        if (current !== id) return current;
        return nextDraft?.id ?? nextChats[0]?.id ?? null;
      });

      if (projectMemoriesRef.current[id]) {
        delete projectMemoriesRef.current[id];
        persistProjectMemories();
      }
      undoHistoryByChatRef.current.delete(id);
      redoHistoryByChatRef.current.delete(id);
      syncActiveHistoryState(activeChatId === id ? nextDraft?.id ?? nextChats[0]?.id ?? null : activeChatId);
    },
    [activeChatId, persistProjectMemories, syncActiveHistoryState],
  );

  const updateChatPermissions = useCallback(
    (
      chatId: string,
      updater: (
        prev: Record<string, NodePermissions>,
      ) => Record<string, NodePermissions>,
    ) => {
      patchChatById(chatId, (chat) => ({
        ...chat,
        permissions: updater(chat.permissions ?? {}),
      }));
    },
    [patchChatById],
  );

  const setChatPermissions = useCallback(
    (chatId: string, permissions: Record<string, NodePermissions>) => {
      patchChatById(chatId, (chat) => ({ ...chat, permissions }));
    },
    [patchChatById],
  );

  const setChatGitProject = useCallback(
    (chatId: string, projectId: string | null) => {
      patchChatById(chatId, (chat) => ({ ...chat, gitProjectId: projectId }));
      const memory = projectMemoriesRef.current[chatId];
      if (memory && projectId && memory.projectId !== projectId) {
        memory.projectId = projectId;
        memory.lastUpdatedAt = Date.now();
        persistProjectMemories();
      }
    },
    [patchChatById, persistProjectMemories],
  );

  const runAiResponse = useCallback(
    async (
      runId: number,
      chatId: string,
      threadId: string,
      userContent: string,
      history: ChatTurn[],
      targetModelIds: string[],
      contributions: { modelId: string; percentage: number }[],
      workspace: AiWorkspacePayload | undefined,
      retrievedMemoryPrompt: string | null,
    ) => {
      let modelOutputs: { modelId: string; content: string }[] = [];
      const threadKey = threadResponseKey(chatId, threadId);
      const streamId = makeAiStreamId(chatId, threadId, runId);
      const resolvedTargetModelIds = normalizeTargetModelIds(targetModelIds);
      const resolvedContributions =
        contributions
          .map((entry) => ({
            ...entry,
            modelId:
              normalizeTargetModelIds([entry.modelId])[0] ?? entry.modelId,
          }))
          .filter((entry) => resolvedTargetModelIds.includes(entry.modelId));
      const contributionsForMessage =
        resolvedContributions.length > 0
          ? resolvedContributions
          : evenContributions(resolvedTargetModelIds);

      const finish = async (
        content: string,
        options?: { successful?: boolean },
      ) => {
        if (responseRunRef.current !== runId) return;
        const successful = options?.successful ?? true;
        const { visibleContent: afterTools, patches: toolPatches } =
          extractAssistantProjectTools(content);
        if (toolPatches.length > 0) {
          appendAgentActivityEvent(
            chatId,
            threadId,
            "editing",
            "Applying project configuration updates",
          );
        }
        const { visibleContent: afterPaneActions, actions } =
          extractAssistantPaneActions(afterTools);
        const { visibleContent: afterUiCommands, commands } =
          extractAssistantUiCommands(afterPaneActions);
        const { visibleContent, commands: gitCommands } =
          extractAssistantGitCommands(afterUiCommands);
        let chatSnapshot = findChatSnapshot(
          chatsRef.current,
          draftChatRef.current,
          chatId,
        );
        const thread = chatSnapshot?.threads.find((t) => t.id === threadId);
        const agentPermissions = resolveAgentPermissions(thread);

        if (
          toolPatches.length > 0 &&
          agentPermissions.inAppSettings &&
          chatSnapshot
        ) {
          const nextTools = applyProjectToolsPatches(
            chatSnapshot.projectTools ?? [],
            toolPatches,
          );
          patchWorkspaceSettings(chatId, { projectTools: nextTools });
        }

        for (const action of actions) {
          if (!isPaneActionAllowed(action.target, agentPermissions)) {
            continue;
          }
          if (action.target === "terminal") {
            if (action.verb === "open") requestBottomPanelTab("terminal");
            else setWorkspaceBottomPanelOpen(false);
            continue;
          }
          if (action.target === "websites") {
            if (action.verb === "open") requestBottomPanelTab("browser");
            else setWorkspaceBottomPanelOpen(false);
            continue;
          }
          if (action.target === "models") {
            setLeftSidebarViewVisible("agents", action.verb === "open");
            continue;
          }
          if (action.target === "explorer") {
            setLeftSidebarViewVisible("explorer", action.verb === "open");
            continue;
          }
          if (action.target === "agent-cart") {
            setLeftSidebarViewVisible("agents", action.verb === "open");
          }
        }

        if (commands.length > 0) {
          enqueueCommands(commands);
        }

        let finalContent = visibleContent || content;
        if (gitCommands.length > 0 && agentPermissions.git) {
          appendAgentActivityEvent(
            chatId,
            threadId,
            "editing",
            `Running ${gitCommands.length} git command${gitCommands.length === 1 ? "" : "s"}`,
          );
          const gitResults = await executeGitAssistantCommands(
            gitCommands,
            chatSnapshot?.gitProjectId,
          );
          const gitSummary = formatGitCommandResults(gitResults);
          if (gitSummary) {
            finalContent = [finalContent.trim(), gitSummary]
              .filter(Boolean)
              .join("\n\n");
          }
        }
        appendAgentActivityEvent(
          chatId,
          threadId,
          "checking",
          "Checking response and saving results",
        );
        addUsage(
          recordResponseEstimates(
            resolvedTargetModelIds,
            userContent,
            modelOutputs,
            finalContent,
          ),
        );
        const respondingModelId =
          modelOutputs.length === 1
            ? modelOutputs[0]!.modelId
            : resolvedTargetModelIds.length === 1
              ? resolvedTargetModelIds[0]
              : undefined;
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalContent,
          createdAt: Date.now(),
          targetModelIds: resolvedTargetModelIds,
          modelContributions:
            resolvedTargetModelIds.length > 1
              ? contributionsForMessage
              : respondingModelId
                ? [{ modelId: respondingModelId, percentage: 100 }]
                : undefined,
          toolContextRoots:
            workspace && workspace.enabledPaths.length > 0
              ? [...workspace.enabledPaths]
              : undefined,
        };
        const currentChat = getChatByIdSnapshot(chatId);
        if (currentChat) {
          pushUndoSnapshot(chatId, currentChat);
        }
        setChats((prev) => {
          const next = appendAssistantToThread(
            prev,
            chatId,
            threadId,
            assistantMessage,
          );
          chatsRef.current = next;
          return next;
        });
        chatSnapshot = findChatSnapshot(
          chatsRef.current,
          draftChatRef.current,
          chatId,
        );
        if (chatSnapshot) {
          const relatedFiles = Object.entries(chatSnapshot.permissions ?? {})
            .filter(([, permission]) => permission.enabled)
            .map(([path]) => path)
            .slice(0, 20);
          addMessageMemoryRecord(
            chatSnapshot,
            threadId,
            "assistant",
            finalContent,
            relatedFiles,
          );
        }
        if (chatSnapshot) {
          const params = resolveAgentNotificationParams(chatSnapshot, threadId);
          if (successful) {
            if (readAppSettings().completionSound) {
              playCompletionSound();
            }
            void notifyAgentFinishedWhenBackgrounded(params).catch(() => {});
            window.dispatchEvent(
              new CustomEvent("forge:agent-complete", {
                detail: { chatId, threadId },
              }),
            );
          }
        }
        activeStreamIdByThreadRef.current.delete(threadKey);
        clearStreamingActivities(chatId, threadId);
        appendAgentActivityEvent(chatId, threadId, "done", "Done");
        inFlightThreadsRef.current.delete(threadKey);
        setResponseLoading(null);
        flushQueueRef.current(chatId, threadId);
      };

      const fail = async (message: string) => {
        appendAgentActivityEvent(chatId, threadId, "error", `Agent failed: ${message}`);
        const chatSnapshot = findChatSnapshot(
          chatsRef.current,
          draftChatRef.current,
          chatId,
        );
        if (chatSnapshot) {
          void notifyAgentNeedsAttentionWhenBackgrounded(
            resolveAgentNotificationParams(chatSnapshot, threadId),
          ).catch(() => {});
        }
        pushToast(`Agent failed: ${message}`, "warning");
        await finish(`**Could not get a response**\n\n${message}`, {
          successful: false,
        });
      };

      if (!isTauri()) {
        await fail(
          "AI chat requires the desktop app. Run with `npm run tauri:dev` and configure either `FORGE_BACKEND_URL` (recommended) or provider API keys in `.env`.",
        );
        return;
      }

      if (!isSignedIn) {
        await fail(
          signInRequiredMessage ??
            "Sign in to send messages. Your monthly token allowance is tracked per account.",
        );
        return;
      }

      if (isAtTokenLimit) {
        await fail(
          tokenLimitMessage ??
            "You've reached your monthly token limit. Upgrade to Forge Premium or wait until next month.",
        );
        return;
      }

      if (resolvedTargetModelIds.length === 0) {
        await fail(
          "No supported models are selected. Add DeepSeek (or another wired model) to your Model Cart and turn it on in the Round Table.",
        );
        return;
      }

      const workspaceEnabled =
        (workspace?.enabledPaths.length ?? 0) > 0;
      if (workspaceEnabled) {
        appendAgentActivityEvent(
          chatId,
          threadId,
          "searching",
          "Searching enabled workspace paths",
        );
      }
      appendAgentActivityEvent(chatId, threadId, "planning", "Planning response");
      addUsage(
        recordSendEstimates(
          history,
          userContent,
          resolvedTargetModelIds,
          workspaceEnabled,
        ),
      );

      try {
        const chatSnapshot = findChatSnapshot(
          chatsRef.current,
          draftChatRef.current,
          chatId,
        );
        const thread = chatSnapshot?.threads.find((t) => t.id === threadId);
        const agentPermissions = resolveAgentPermissions(thread);
        const agentSystemPrompt =
          thread?.systemPrompt?.trim() || DEFAULT_AGENT_SYSTEM_PROMPT;
        const permissionsNote =
          buildAgentPermissionsSystemNote(agentPermissions);
        const projectDescription =
          chatSnapshot?.projectDescription?.trim() ?? "";
        const projectTools = dedupeProjectTools(chatSnapshot?.projectTools ?? []);
        const projectToolsPrompt = formatProjectToolsPrompt(projectTools);
        const gitRepoPath =
          chatSnapshot?.gitProjectId != null
            ? (loadProjects().find((p) => p.id === chatSnapshot.gitProjectId)
                ?.rootPath ?? null)
            : null;
        const systemParts = [
          agentSystemPrompt,
          permissionsNote ?? "",
          projectDescription
            ? `Project description:\n${projectDescription}`
            : "",
          projectToolsPrompt ?? "",
          agentPermissions.inAppSettings ? PROJECT_TOOLS_UPDATE_GUIDANCE : "",
          agentPermissions.git
            ? buildGitCommandsSystemGuidance(gitRepoPath)
            : "",
          AI_UI_COMMAND_SYSTEM_GUIDANCE,
          retrievedMemoryPrompt ?? "",
        ].filter(Boolean);
        const systemPrompt = systemParts.length > 0 ? systemParts.join("\n\n") : null;
        if (resolvedTargetModelIds.length === 1) {
          appendAgentActivityEvent(
            chatId,
            threadId,
            "checking",
            `Checking model ${getModelById(resolvedTargetModelIds[0])?.name ?? resolvedTargetModelIds[0]}`,
          );
          setResponseLoading({
            chatId,
            threadId,
            targetModelIds: resolvedTargetModelIds,
            phase: "roundtable",
            speakingModelIndex: 0,
          });

          const content = await aiChatComplete(
            resolvedTargetModelIds[0],
            history,
            workspace,
            systemPrompt,
            streamId,
            { chatId, threadId },
          );
          modelOutputs = [{ modelId: resolvedTargetModelIds[0], content }];
          await finish(content);
          return;
        }

        modelOutputs = [];

        for (let i = 0; i < resolvedTargetModelIds.length; i++) {
          if (responseRunRef.current !== runId) return;

          const modelId = resolvedTargetModelIds[i];
          appendAgentActivityEvent(
            chatId,
            threadId,
            "checking",
            `Checking model ${getModelById(modelId)?.name ?? modelId}`,
          );
          setResponseLoading({
            chatId,
            threadId,
            targetModelIds: resolvedTargetModelIds,
            phase: "roundtable",
            speakingModelIndex: i,
          });

          const content = await aiChatComplete(
            modelId,
            history,
            workspace,
            systemPrompt,
            streamId,
            { chatId, threadId },
          );
          modelOutputs.push({ modelId, content });
        }

        if (responseRunRef.current !== runId) return;

        setResponseLoading({
          chatId,
          threadId,
          targetModelIds: resolvedTargetModelIds,
          phase: "synthesizing",
          speakingModelIndex: -1,
        });
        appendAgentActivityEvent(
          chatId,
          threadId,
          "planning",
          "Synthesizing model responses",
        );

        const synthesized = await aiChatSynthesize(
          userContent,
          modelOutputs.map((entry) => ({
            modelId: entry.modelId,
            modelName: getModelById(entry.modelId)?.name,
            content: entry.content,
          })),
          systemPrompt,
          { chatId, threadId },
        );

        await finish(synthesized);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        await fail(message);
      }
    },
    [
      addUsage,
      addMessageMemoryRecord,
      appendAgentActivityEvent,
      clearStreamingActivities,
      requestBottomPanelTab,
      setWorkspaceBottomPanelOpen,
      setLeftSidebarViewVisible,
      patchWorkspaceSettings,
      enqueueCommands,
      pushToast,
      getChatByIdSnapshot,
      pushUndoSnapshot,
      isSignedIn,
      isAtTokenLimit,
      tokenLimitMessage,
      signInRequiredMessage,
    ],
  );

  const startThreadAiRun = useCallback(
    (committed: CommittedSend) => {
      if (!isSignedIn) {
        pushToast(
          signInRequiredMessage ??
            "Sign in to send messages. Your monthly token allowance is tracked per account.",
          "warning",
        );
        return;
      }
      if (isAtTokenLimit) {
        pushToast(
          tokenLimitMessage ??
            "You've reached your monthly token limit. Upgrade to Forge Premium or wait until next month.",
          "warning",
        );
        return;
      }

      const {
        resolvedChatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
      } = committed;
      const key = threadResponseKey(resolvedChatId, finalThreadId);
      inFlightThreadsRef.current.add(key);
      const runId = ++responseRunRef.current;
      const streamId = makeAiStreamId(resolvedChatId, finalThreadId, runId);
      activeStreamIdByThreadRef.current.set(key, streamId);
      clearStreamingActivities(resolvedChatId, finalThreadId);
      clearAgentActivityEvents(resolvedChatId, finalThreadId);
      appendAgentActivityEvent(
        resolvedChatId,
        finalThreadId,
        "analyzing",
        "Analyzing project structure",
      );

      setResponseLoading({
        chatId: resolvedChatId,
        threadId: finalThreadId,
        targetModelIds,
        phase: "roundtable",
        speakingModelIndex: 0,
      });

      const chat = findChatSnapshot(
        chatsRef.current,
        draftChatRef.current,
        resolvedChatId,
      );
      const retrievedMemoryPrompt = chat
        ? getRetrievedMemoryPrompt(chat, finalThreadId, trimmed)
        : null;
      void runAiResponse(
        runId,
        resolvedChatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
        committed.contributions,
        committed.workspace,
        retrievedMemoryPrompt,
      );
    },
    [
      runAiResponse,
      getRetrievedMemoryPrompt,
      clearStreamingActivities,
      clearAgentActivityEvents,
      appendAgentActivityEvent,
      isSignedIn,
      isAtTokenLimit,
      tokenLimitMessage,
      signInRequiredMessage,
      pushToast,
    ],
  );

  const flushMessageQueue = useCallback(
    (chatId: string, threadId: string) => {
      const key = threadResponseKey(chatId, threadId);
      if (inFlightThreadsRef.current.has(key)) return;

      const queue = queuedSendsRef.current.get(key);
      if (!queue?.length) return;

      const payload = queue.shift()!;
      syncQueueCount(key, queue.length);

      const trimmed = payload.content.trim();
      const targetModelIds = payload.targetModelIds;
      if (!trimmed || targetModelIds.length === 0) {
        flushQueueRef.current(chatId, threadId);
        return;
      }

      const chat = findChatSnapshot(
        chatsRef.current,
        draftChatRef.current,
        chatId,
      );
      if (!chat) return;

      const finalThreadId = resolveThreadId(chat, payload.threadId ?? threadId);
      const history = buildThreadHistory(chat, finalThreadId);
      const contributions =
        payload.modelContributions ?? evenContributions(targetModelIds);

      startThreadAiRun({
        resolvedChatId: chatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
        contributions,
        workspace: payload.workspace,
      });
    },
    [startThreadAiRun, syncQueueCount],
  );

  useEffect(() => {
    flushQueueRef.current = flushMessageQueue;
  }, [flushMessageQueue]);

  const sendMessage = useCallback(
    (payload: SendMessagePayload) => {
      const trimmed = payload.content.trim();
      if (!trimmed && (!payload.attachments || payload.attachments.length === 0)) {
        return;
      }

      if (!isSignedIn) {
        pushToast(
          signInRequiredMessage ??
            "Sign in to send messages. Your monthly token allowance is tracked per account.",
          "warning",
        );
        return;
      }

      if (isAtTokenLimit) {
        pushToast(
          tokenLimitMessage ??
            "You've reached your monthly token limit. Upgrade to Forge Premium or wait until next month.",
          "warning",
        );
        return;
      }

      const targetModelIds = payload.targetModelIds;
      if (targetModelIds.length === 0) return;

      const requestedChatId = payload.chatId ?? activeChatId ?? null;
      const requestedThreadId = payload.threadId ?? null;
      if (!requestedChatId || !requestedThreadId) return;

      const chatBeforeSend = findChatSnapshot(
        chatsRef.current,
        draftChatRef.current,
        requestedChatId,
      );
      if (chatBeforeSend) {
        pushUndoSnapshot(chatBeforeSend.id, chatBeforeSend);
      }
      if (chatBeforeSend) {
        const threadBeforeSend = resolveThreadId(
          chatBeforeSend,
          requestedThreadId,
        );
        const inFlightBeforeSend = threadResponseKey(
          requestedChatId,
          threadBeforeSend,
        );
        if (
          inFlightThreadsRef.current.has(inFlightBeforeSend) &&
          resolveQueuedMessageBehavior(chatBeforeSend) === "block-until-responds"
        ) {
          return;
        }
      }

      const contributions =
        payload.modelContributions ?? evenContributions(targetModelIds);

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: now,
        attachments: payload.attachments,
        targetModelIds,
        modelContributions:
          targetModelIds.length > 1 ? contributions : undefined,
      };

      const committingDraft =
        draftChatRef.current != null &&
        (requestedChatId === draftChatRef.current.id ||
          ((!requestedChatId || requestedChatId === activeChatId) &&
            activeChatId === draftChatRef.current.id));

      let nextChats = chatsRef.current;
      if (committingDraft && !nextChats.some((c) => c.id === draftChatRef.current!.id)) {
        nextChats = [draftChatRef.current!, ...nextChats];
      }
      const appendResult = appendUserMessageToThread(
        nextChats,
        committingDraft ? draftChatRef.current!.id : requestedChatId,
        requestedThreadId,
        userMessage,
        trimmed,
        now,
      );
      const { resolvedChatId, resolvedThreadId } = appendResult;

      chatsRef.current = appendResult.chats;
      setChats(appendResult.chats);

      if (committingDraft) {
        setDraftChat(null);
        draftChatRef.current = null;
      }

      setActiveChatId(resolvedChatId);

      const chatAfterCommit = findChatSnapshot(
        chatsRef.current,
        draftChatRef.current,
        resolvedChatId,
      );
      const stableThreadId =
        requestedThreadId &&
        chatAfterCommit?.threads.some((t) => t.id === requestedThreadId)
          ? requestedThreadId
          : (chatAfterCommit?.threads[0]?.id ?? resolvedThreadId);
      const finalThreadId = resolvedThreadId || stableThreadId;

      const history = chatAfterCommit
        ? buildThreadHistory(chatAfterCommit, finalThreadId)
        : [{ role: "user" as const, content: trimmed }];

      if (chatAfterCommit) {
        recordGoToRecent("project", resolvedChatId);
        const relatedFiles = Object.entries(chatAfterCommit.permissions ?? {})
          .filter(([, permission]) => permission.enabled)
          .map(([path]) => path)
          .slice(0, 20);
        addMessageMemoryRecord(
          chatAfterCommit,
          finalThreadId,
          "user",
          trimmed,
          relatedFiles,
        );

        if (
          workspaceUserMessageCount(chatAfterCommit) === 1 &&
          canAutoTitleWorkspace(chatAfterCommit)
        ) {
          void refineWorkspaceTitle(resolvedChatId, trimmed || "Attachments");
        }
      }

      const inFlightKey = threadResponseKey(resolvedChatId, finalThreadId);
      if (inFlightThreadsRef.current.has(inFlightKey)) {
        const queueBehavior = resolveQueuedMessageBehavior(chatAfterCommit);
        if (queueBehavior === "stop-and-send") {
          interruptThreadResponse(resolvedChatId, finalThreadId);
        } else if (queueBehavior === "wait") {
          enqueueMessage(inFlightKey, payload);
          return;
        } else {
          return;
        }
      }

      startThreadAiRun({
        resolvedChatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
        contributions,
        workspace: payload.workspace,
      });
    },
    [
      activeChatId,
      addMessageMemoryRecord,
      enqueueMessage,
      interruptThreadResponse,
      pushUndoSnapshot,
      refineWorkspaceTitle,
      startThreadAiRun,
      isSignedIn,
      isAtTokenLimit,
      tokenLimitMessage,
      signInRequiredMessage,
      pushToast,
    ],
  );

  const undoActiveChat = useCallback((): boolean => {
    if (!activeChatId) return false;
    const undoStack = undoHistoryByChatRef.current.get(activeChatId) ?? [];
    const previousSnapshot = undoStack[undoStack.length - 1];
    if (!previousSnapshot) return false;
    const current = getChatByIdSnapshot(activeChatId);
    if (!current) return false;
    undoHistoryByChatRef.current.set(activeChatId, undoStack.slice(0, -1));
    const redoStack = redoHistoryByChatRef.current.get(activeChatId) ?? [];
    redoHistoryByChatRef.current.set(activeChatId, [
      ...redoStack,
      cloneChatSnapshot(current),
    ]);
    applyChatSnapshot(activeChatId, previousSnapshot);
    syncActiveHistoryState(activeChatId);
    return true;
  }, [activeChatId, applyChatSnapshot, getChatByIdSnapshot, syncActiveHistoryState]);

  const redoActiveChat = useCallback((): boolean => {
    if (!activeChatId) return false;
    const redoStack = redoHistoryByChatRef.current.get(activeChatId) ?? [];
    const nextSnapshot = redoStack[redoStack.length - 1];
    if (!nextSnapshot) return false;
    const current = getChatByIdSnapshot(activeChatId);
    if (!current) return false;
    redoHistoryByChatRef.current.set(activeChatId, redoStack.slice(0, -1));
    const undoStack = undoHistoryByChatRef.current.get(activeChatId) ?? [];
    undoHistoryByChatRef.current.set(activeChatId, [
      ...undoStack,
      cloneChatSnapshot(current),
    ]);
    applyChatSnapshot(activeChatId, nextSnapshot);
    syncActiveHistoryState(activeChatId);
    return true;
  }, [activeChatId, applyChatSnapshot, getChatByIdSnapshot, syncActiveHistoryState]);

  const truncateThreadAfterMessage = useCallback(
    (chatId: string, threadId: string, messageId: string) => {
      const chat = findChatSnapshot(
        chatsRef.current,
        draftChatRef.current,
        chatId,
      );
      const thread = chat?.threads.find((item) => item.id === threadId);
      if (!thread) return;
      const cutoff = thread.messages.findIndex((item) => item.id === messageId);
      if (cutoff < 0 || cutoff >= thread.messages.length - 1) return;

      const now = Date.now();
      patchChatById(chatId, (existing) => ({
        ...existing,
        threads: existing.threads.map((item) =>
          item.id === threadId
            ? {
                ...item,
                messages: item.messages.slice(0, cutoff + 1),
                updatedAt: now,
              }
            : item,
        ),
        updatedAt: now,
      }));

      const key = threadResponseKey(chatId, threadId);
      responseRunRef.current += 1;
      clearMessageQueue(chatId, threadId);
      activeStreamIdByThreadRef.current.delete(key);
      clearStreamingActivities(chatId, threadId);
      clearAgentActivityEvents(chatId, threadId);
      inFlightThreadsRef.current.delete(key);
      setResponseLoading((loading) => {
        if (loading?.chatId === chatId && loading.threadId === threadId) {
          return null;
        }
        return loading;
      });
    },
    [
      patchChatById,
      clearAgentActivityEvents,
      clearMessageQueue,
      clearStreamingActivities,
    ],
  );

  const activeChat = useMemo(() => {
    if (draftChat?.id === activeChatId) return draftChat;
    return chats.find((c) => c.id === activeChatId) ?? null;
  }, [chats, activeChatId, draftChat]);

  const value = useMemo(
    () => ({
      chats,
      activeChat,
      activeChatId,
      activeWorkspaceLayout,
      patchActiveWorkspaceLayout,
      expandActiveWorkspaceLayout,
      closeActiveWorkspaceLeaf,
      responseLoading,
      createChat,
      startNewProject,
      renamingChatId,
      setRenamingChatId,
      selectChat,
      selectAgent,
      renameChat,
      renameThread,
      patchAgentSettings,
      patchWorkspaceSettings,
      forceKillThread,
      togglePinChat,
      deleteChat,
      sendMessage,
      truncateThreadAfterMessage,
      getQueuedMessageCount,
      getStreamingActivities,
      getAgentActivityEvents,
      updateChatPermissions,
      setChatPermissions,
      setChatGitProject,
      canUndoActiveChat: activeHistoryState.canUndo,
      canRedoActiveChat: activeHistoryState.canRedo,
      undoActiveChat,
      redoActiveChat,
    }),
    [
      chats,
      activeChat,
      activeChatId,
      activeWorkspaceLayout,
      patchActiveWorkspaceLayout,
      expandActiveWorkspaceLayout,
      closeActiveWorkspaceLeaf,
      responseLoading,
      createChat,
      startNewProject,
      renamingChatId,
      setRenamingChatId,
      selectChat,
      selectAgent,
      renameChat,
      renameThread,
      patchAgentSettings,
      patchWorkspaceSettings,
      forceKillThread,
      togglePinChat,
      deleteChat,
      sendMessage,
      truncateThreadAfterMessage,
      getQueuedMessageCount,
      getStreamingActivities,
      getAgentActivityEvents,
      updateChatPermissions,
      setChatPermissions,
      setChatGitProject,
      activeHistoryState.canUndo,
      activeHistoryState.canRedo,
      undoActiveChat,
      redoActiveChat,
    ],
  );

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
}

export function useChats() {
  const ctx = useContext(ChatsContext);
  if (!ctx) {
    throw new Error("useChats must be used within ChatsProvider");
  }
  return ctx;
}
