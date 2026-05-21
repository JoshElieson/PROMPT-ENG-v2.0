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
  isAiModelSupported,
  type ChatTurn,
} from "@/lib/ai-chat";
import {
  chatHasMessages,
  defaultThreadTitle,
  titleFromMessage,
} from "@/lib/chat-utils";
import { useApiUsage } from "@/contexts/ApiUsageContext";
import { evenContributions } from "@/lib/mock-chat-response";
import { isTauri } from "@/lib/tauri";
import {
  recordResponseEstimates,
  recordSendEstimates,
} from "@/lib/token-usage";
import {
  loadActiveChatId,
  loadChats,
  saveActiveChatId,
  saveChats,
} from "@/lib/storage";
import {
  collapseWorkspaceByLeaf,
  ensureFocusedLeafExists,
  expandWorkspaceLayout,
  reconcileWorkspaceThreads,
} from "@/lib/center-workspace-layout";
import { createDefaultWorkspaceLayout } from "@/lib/workspace-pane-storage";
import { useLayout } from "@/contexts/LayoutContext";
import { extractAssistantPaneActions } from "@/lib/assistant-pane-actions";
import type { NodePermissions } from "@/types/project";
import type {
  AiWorkspacePayload,
  Chat,
  ChatMessage,
  ChatThread,
  ResponseLoadingState,
  SendMessagePayload,
} from "@/types/chat";
import type { WorkspacePaneLayout } from "@/types/workspace-pane";

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
  isResponding: boolean;
  createChat: () => string;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  renameThread: (threadId: string, title: string) => void;
  /** Stops the in-flight AI response for this thread without closing the tab. */
  forceKillThread: (threadId: string) => void;
  togglePinChat: (id: string) => void;
  deleteChat: (id: string) => void;
  sendMessage: (payload: SendMessagePayload) => void;
  /** Messages waiting to send after the current response on this thread. */
  getQueuedMessageCount: (chatId: string, threadId: string) => number;
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
}

const ChatsContext = createContext<ChatsContextValue | null>(null);

function resolveActiveId(chats: Chat[], storedId: string | null): string | null {
  if (storedId && chats.some((c) => c.id === storedId)) return storedId;
  if (chats.length === 0) return null;
  return chats[0].id;
}

function buildEmptyChat(): Chat {
  const now = Date.now();
  const tid = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
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
  const chats = loaded.filter(chatHasMessages);
  const empty = loaded.filter((c) => !chatHasMessages(c));
  const draftFromActive = storedActiveId
    ? (empty.find((c) => c.id === storedActiveId) ?? null)
    : null;
  const draftChat = draftFromActive ?? empty[0] ?? null;
  const activeChatId = draftChat?.id ?? resolveActiveId(chats, storedActiveId);
  return { chats, draftChat, activeChatId };
}

function resolveThreadId(chat: Chat, threadId: string | null | undefined): string {
  if (threadId && chat.threads.some((t) => t.id === threadId)) return threadId;
  return chat.threads[0]!.id;
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

function findChatSnapshot(
  chats: Chat[],
  draftChat: Chat | null,
  chatId: string,
): Chat | null {
  if (draftChat?.id === chatId) return draftChat;
  return chats.find((c) => c.id === chatId) ?? null;
}

function buildThreadHistory(chat: Chat, threadId: string): ChatTurn[] {
  const thread = chat.threads.find((t) => t.id === threadId);
  return (thread?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
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
      title: titleFromMessage(trimmed || "Attachments"),
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
      const wasEmpty =
        chat.threads.find((th) => th.id === tid)?.messages.length === 0;
      return {
        ...chat,
        threads,
        title: wasEmpty
          ? titleFromMessage(trimmed || "Attachments")
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
  const { addUsage } = useApiUsage();
  const {
    requestBottomPanelTab,
    setWorkspaceBottomPanelOpen,
    setRightPanelVisible,
    setRightSidebarCollapsed,
    setLeftSidebarViewVisible,
  } = useLayout();
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
  const responseRunRef = useRef(0);
  const inFlightThreadsRef = useRef(new Set<string>());
  const queuedSendsRef = useRef(new Map<string, SendMessagePayload[]>());
  const chatsRef = useRef(chats);
  const draftChatRef = useRef(draftChat);
  const flushQueueRef = useRef<(chatId: string, threadId: string) => void>(
    () => {},
  );
  const [queuedCountByKey, setQueuedCountByKey] = useState<
    Record<string, number>
  >({});

  chatsRef.current = chats;
  draftChatRef.current = draftChat;

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

  useEffect(() => {
    saveChats(chats.filter(chatHasMessages));
  }, [chats]);

  useEffect(() => {
    saveActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const isDraft = draftChat?.id === activeChatId;
    const isSaved = chats.some((c) => c.id === activeChatId);
    if (!isDraft && !isSaved) {
      setActiveChatId(draftChat?.id ?? chats[0]?.id ?? null);
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
      return ok;
    },
    [activeChatId, draftChat?.id],
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
          inFlightThreadsRef.current.delete(
            threadResponseKey(rl.chatId, removedThreadId),
          );
          return null;
        }
        return rl;
      });

      return true;
    },
    [activeChatId, draftChat, clearMessageQueue],
  );

  const createChat = useCallback((): string => {
    const chat = buildEmptyChat();
    setDraftChat(chat);
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const selectChat = useCallback((id: string) => {
    if (draftChat && id !== draftChat.id) {
      setDraftChat(null);
    }
    setActiveChatId(id);
  }, [draftChat]);

  const patchChatById = useCallback(
    (chatId: string, updater: (chat: Chat) => Chat) => {
      if (draftChat?.id === chatId) {
        setDraftChat((prev) => (prev ? updater(prev) : null));
        return;
      }
      setChats((prev) =>
        prev.map((chat) => (chat.id === chatId ? updater(chat) : chat)),
      );
    },
    [draftChat?.id],
  );

  const renameChat = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      patchChatById(id, (chat) => ({
        ...chat,
        title: trimmed,
        updatedAt: Date.now(),
      }));
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

  const forceKillThread = useCallback(
    (threadId: string) => {
      if (!activeChatId) return;
      setResponseLoading((rl) => {
        if (
          rl &&
          rl.chatId === activeChatId &&
          rl.threadId === threadId
        ) {
          responseRunRef.current += 1;
          clearMessageQueue(activeChatId, threadId);
          inFlightThreadsRef.current.delete(
            threadResponseKey(activeChatId, threadId),
          );
          return null;
        }
        return rl;
      });
    },
    [activeChatId, clearMessageQueue],
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

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
  }, []);

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
    },
    [patchChatById],
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
    ) => {
      let modelOutputs: { modelId: string; content: string }[] = [];

      const finish = (content: string) => {
        if (responseRunRef.current !== runId) return;
        const { visibleContent, actions } = extractAssistantPaneActions(content);

        for (const action of actions) {
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
            setRightPanelVisible("roundTable", action.verb === "open");
            continue;
          }
          if (action.target === "workflow") {
            setRightPanelVisible("workflow", action.verb === "open");
            continue;
          }
          if (action.target === "right-sidebar") {
            setRightSidebarCollapsed(action.verb === "close");
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

        const finalContent = visibleContent || content;
        addUsage(
          recordResponseEstimates(
            targetModelIds,
            userContent,
            modelOutputs,
            finalContent,
          ),
        );
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalContent,
          createdAt: Date.now(),
          modelContributions:
            targetModelIds.length > 1 ? contributions : undefined,
        };
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
        inFlightThreadsRef.current.delete(threadResponseKey(chatId, threadId));
        setResponseLoading(null);
        flushQueueRef.current(chatId, threadId);
      };

      const fail = (message: string) => {
        finish(`**Could not get a response**\n\n${message}`);
      };

      if (!isTauri()) {
        fail(
          "AI chat requires the desktop app. Run with `npm run tauri:dev` and ensure API keys are configured in `.env` (installed app users can place this at `%APPDATA%/FORGE/.env`).",
        );
        return;
      }

      const unsupported = targetModelIds.filter((id) => !isAiModelSupported(id));
      if (unsupported.length > 0) {
        const names = unsupported
          .map((id) => getModelById(id)?.name ?? id)
          .join(", ");
        fail(
          `${names} ${unsupported.length === 1 ? "is" : "are"} not connected to a provider yet. Use GPT-4o, Claude, Gemini, DeepSeek, or Grok models.`,
        );
        return;
      }

      const workspaceEnabled =
        (workspace?.enabledPaths.length ?? 0) > 0;
      addUsage(
        recordSendEstimates(
          history,
          userContent,
          targetModelIds,
          workspaceEnabled,
        ),
      );

      try {
        if (targetModelIds.length === 1) {
          setResponseLoading({
            chatId,
            threadId,
            targetModelIds,
            phase: "roundtable",
            speakingModelIndex: 0,
          });

          const content = await aiChatComplete(
            targetModelIds[0],
            history,
            workspace,
          );
          modelOutputs = [{ modelId: targetModelIds[0], content }];
          finish(content);
          return;
        }

        modelOutputs = [];

        for (let i = 0; i < targetModelIds.length; i++) {
          if (responseRunRef.current !== runId) return;

          const modelId = targetModelIds[i];
          setResponseLoading({
            chatId,
            threadId,
            targetModelIds,
            phase: "roundtable",
            speakingModelIndex: i,
          });

          const content = await aiChatComplete(modelId, history, workspace);
          modelOutputs.push({ modelId, content });
        }

        if (responseRunRef.current !== runId) return;

        setResponseLoading({
          chatId,
          threadId,
          targetModelIds,
          phase: "synthesizing",
          speakingModelIndex: -1,
        });

        const synthesized = await aiChatSynthesize(
          userContent,
          modelOutputs.map((entry) => ({
            modelId: entry.modelId,
            modelName: getModelById(entry.modelId)?.name,
            content: entry.content,
          })),
        );

        finish(synthesized);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        fail(message);
      }
    },
    [
      addUsage,
      requestBottomPanelTab,
      setWorkspaceBottomPanelOpen,
      setRightPanelVisible,
      setRightSidebarCollapsed,
      setLeftSidebarViewVisible,
    ],
  );

  const startThreadAiRun = useCallback(
    (committed: CommittedSend) => {
      const { resolvedChatId, finalThreadId, trimmed, history, targetModelIds } =
        committed;
      const key = threadResponseKey(resolvedChatId, finalThreadId);
      inFlightThreadsRef.current.add(key);

      setResponseLoading({
        chatId: resolvedChatId,
        threadId: finalThreadId,
        targetModelIds,
        phase: "roundtable",
        speakingModelIndex: 0,
      });

      const runId = ++responseRunRef.current;
      void runAiResponse(
        runId,
        resolvedChatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
        committed.contributions,
        committed.workspace,
      );
    },
    [runAiResponse],
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
        flushMessageQueue(chatId, threadId);
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

  flushQueueRef.current = flushMessageQueue;

  const sendMessage = useCallback(
    (payload: SendMessagePayload) => {
      const trimmed = payload.content.trim();
      if (!trimmed && (!payload.attachments || payload.attachments.length === 0)) {
        return;
      }

      const targetModelIds = payload.targetModelIds;
      if (targetModelIds.length === 0) return;

      const requestedChatId = payload.chatId ?? activeChatId ?? null;
      const requestedThreadId = payload.threadId ?? null;
      if (!requestedChatId || !requestedThreadId) return;

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

      let resolvedChatId = requestedChatId;
      let resolvedThreadId = "";
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
      resolvedChatId = appendResult.resolvedChatId;
      resolvedThreadId = appendResult.resolvedThreadId;

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

      const inFlightKey = threadResponseKey(resolvedChatId, finalThreadId);
      if (inFlightThreadsRef.current.has(inFlightKey)) {
        enqueueMessage(inFlightKey, payload);
        return;
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
    [activeChatId, enqueueMessage, startThreadAiRun],
  );

  const activeChat = useMemo(() => {
    if (draftChat?.id === activeChatId) return draftChat;
    return chats.find((c) => c.id === activeChatId) ?? null;
  }, [chats, activeChatId, draftChat]);

  const isResponding =
    responseLoading != null && responseLoading.chatId === activeChatId;

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
      isResponding,
      createChat,
      selectChat,
      renameChat,
      renameThread,
      forceKillThread,
      togglePinChat,
      deleteChat,
      sendMessage,
      getQueuedMessageCount,
      updateChatPermissions,
      setChatPermissions,
      setChatGitProject,
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
      isResponding,
      createChat,
      selectChat,
      renameChat,
      renameThread,
      forceKillThread,
      togglePinChat,
      deleteChat,
      sendMessage,
      getQueuedMessageCount,
      updateChatPermissions,
      setChatPermissions,
      setChatGitProject,
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
