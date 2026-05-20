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
import { titleFromMessage } from "@/lib/chat-utils";
import { evenContributions } from "@/lib/mock-chat-response";
import { isTauri } from "@/lib/tauri";
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
  deleteChat: (id: string) => void;
  sendMessage: (payload: SendMessagePayload) => void;
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
}

const ChatsContext = createContext<ChatsContextValue | null>(null);

function resolveActiveId(chats: Chat[], storedId: string | null): string | null {
  if (storedId && chats.some((c) => c.id === storedId)) return storedId;
  if (chats.length === 0) return null;
  return chats[0].id;
}

function resolveThreadId(chat: Chat, threadId: string | null | undefined): string {
  if (threadId && chat.threads.some((t) => t.id === threadId)) return threadId;
  return chat.threads[0]!.id;
}

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
  const boot = useMemo(() => {
    const loaded = loadChats();
    return {
      chats: loaded,
      activeChatId: resolveActiveId(loaded, loadActiveChatId()),
    };
  }, []);

  const [chats, setChats] = useState<Chat[]>(boot.chats);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    boot.activeChatId,
  );
  const [responseLoading, setResponseLoading] =
    useState<ResponseLoadingState | null>(null);
  const responseRunRef = useRef(0);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    saveActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    if (activeChatId && !chats.some((c) => c.id === activeChatId)) {
      setActiveChatId(chats[0]?.id ?? null);
    }
  }, [chats, activeChatId]);

  const activeWorkspaceLayout = useMemo(() => {
    const c = chats.find((x) => x.id === activeChatId);
    if (!c?.threads[0]) return null;
    const t0 = c.threads[0].id;
    const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
    const valid = new Set(c.threads.map((t) => t.id));
    return ensureFocusedLeafExists(
      reconcileWorkspaceThreads(base, valid, t0),
    );
  }, [chats, activeChatId]);

  const patchActiveWorkspaceLayout = useCallback(
    (fn: (prev: WorkspacePaneLayout) => WorkspacePaneLayout) => {
      if (!activeChatId) return;
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChatId) return c;
          const t0 = c.threads[0]?.id;
          if (!t0) return c;
          const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
          const valid = new Set(c.threads.map((t) => t.id));
          const reconciled = ensureFocusedLeafExists(
            reconcileWorkspaceThreads(base, valid, t0),
          );
          const next = ensureFocusedLeafExists(fn(reconciled));
          return { ...c, workspace: next, updatedAt: Date.now() };
        }),
      );
    },
    [activeChatId],
  );

  const expandActiveWorkspaceLayout = useCallback(
    (aspectWide: boolean): boolean => {
      if (!activeChatId) return false;
      let ok = false;
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== activeChatId) return c;
          const newTid = crypto.randomUUID();
          const t0 = c.threads[0]?.id;
          if (!t0) return c;
          const base = c.workspace ?? createDefaultWorkspaceLayout(t0);
          const expanded = expandWorkspaceLayout(base, aspectWide, newTid);
          if (!expanded) return c;
          ok = true;
          const newThread: ChatThread = {
            id: newTid,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return {
            ...c,
            threads: [...c.threads, newThread],
            workspace: ensureFocusedLeafExists(expanded),
            updatedAt: Date.now(),
          };
        }),
      );
      return ok;
    },
    [activeChatId],
  );

  const closeActiveWorkspaceLeaf = useCallback(
    (leafId: string): boolean => {
      if (!activeChatId) return false;

      let didMutate = false;
      let removedThreadId: string | null = null;

      setChats((prev) => {
        const chat = prev.find((c) => c.id === activeChatId);
        if (!chat?.threads[0]) return prev;

        const t0 = chat.threads[0].id;
        const base = chat.workspace ?? createDefaultWorkspaceLayout(t0);
        const valid = new Set(chat.threads.map((t) => t.id));
        const reconciled = ensureFocusedLeafExists(
          reconcileWorkspaceThreads(base, valid, t0),
        );

        const collapsed = collapseWorkspaceByLeaf(reconciled, leafId);
        if (!collapsed) return prev;

        const threads = chat.threads.filter(
          (t) => t.id !== collapsed.removedThreadId,
        );
        if (threads.length === 0) return prev;

        didMutate = true;
        removedThreadId = collapsed.removedThreadId;

        return prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                threads,
                workspace: ensureFocusedLeafExists(collapsed.layout),
                updatedAt: Date.now(),
              }
            : c,
        );
      });

      if (!didMutate) return false;

      setResponseLoading((rl) => {
        if (
          rl &&
          rl.chatId === activeChatId &&
          removedThreadId &&
          rl.threadId === removedThreadId
        ) {
          responseRunRef.current += 1;
          return null;
        }
        return rl;
      });

      return true;
    },
    [activeChatId],
  );

  const createChat = useCallback((): string => {
    const now = Date.now();
    const tid = crypto.randomUUID();
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      threads: [{ id: tid, messages: [], createdAt: now, updatedAt: now }],
      createdAt: now,
      updatedAt: now,
      permissions: {},
      workspace: createDefaultWorkspaceLayout(tid),
    };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

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
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          const next = updater(chat.permissions ?? {});
          return { ...chat, permissions: next };
        }),
      );
    },
    [],
  );

  const setChatPermissions = useCallback(
    (chatId: string, permissions: Record<string, NodePermissions>) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, permissions } : chat,
        ),
      );
    },
    [],
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
      const finish = (content: string) => {
        if (responseRunRef.current !== runId) return;
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          createdAt: Date.now(),
          modelContributions:
            targetModelIds.length > 1 ? contributions : undefined,
        };
        setChats((prev) =>
          appendAssistantToThread(prev, chatId, threadId, assistantMessage),
        );
        setResponseLoading(null);
      };

      const fail = (message: string) => {
        finish(`**Could not get a response**\n\n${message}`);
      };

      if (!isTauri()) {
        fail(
          "AI chat requires the desktop app. Run with `npm run tauri:dev` and ensure API keys are in `.env`.",
        );
        return;
      }

      const unsupported = targetModelIds.filter((id) => !isAiModelSupported(id));
      if (unsupported.length > 0) {
        const names = unsupported
          .map((id) => getModelById(id)?.name ?? id)
          .join(", ");
        fail(
          `${names} ${unsupported.length === 1 ? "is" : "are"} not connected to a provider yet. Use GPT-4o, Claude, or Gemini models.`,
        );
        return;
      }

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
          finish(content);
          return;
        }

        const perModel: { modelId: string; content: string }[] = [];

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
          perModel.push({ modelId, content });
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
          perModel.map((entry) => ({
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
    [],
  );

  const sendMessage = useCallback(
    (payload: SendMessagePayload) => {
      const trimmed = payload.content.trim();
      if (!trimmed && (!payload.attachments || payload.attachments.length === 0)) {
        return;
      }

      const targetModelIds = payload.targetModelIds;
      if (targetModelIds.length === 0) return;

      const contributions =
        payload.modelContributions ?? evenContributions(targetModelIds);

      const runId = ++responseRunRef.current;
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

      const requestedChatId = payload.chatId ?? activeChatId ?? null;
      const requestedThreadId = payload.threadId ?? null;

      let resolvedChatId = requestedChatId ?? "";
      let resolvedThreadId = "";

      setChats((prev) => {
        const result = appendUserMessageToThread(
          prev,
          requestedChatId,
          requestedThreadId,
          userMessage,
          trimmed,
          now,
        );
        resolvedChatId = result.resolvedChatId;
        resolvedThreadId = result.resolvedThreadId;
        return result.chats;
      });

      setActiveChatId(resolvedChatId);

      const chat = chats.find((c) => c.id === requestedChatId) ?? null;
      const stableThreadId =
        requestedThreadId && chat?.threads.some((t) => t.id === requestedThreadId)
          ? requestedThreadId
          : (chat?.threads[0]?.id ?? resolvedThreadId);

      const priorMessages =
        chat != null
          ? (chat.threads.find((t) => t.id === stableThreadId)?.messages ?? [])
          : [];

      const history: ChatTurn[] = [
        ...priorMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: trimmed },
      ];

      const finalThreadId = resolvedThreadId || stableThreadId;

      setResponseLoading({
        chatId: resolvedChatId,
        threadId: finalThreadId,
        targetModelIds,
        phase: "roundtable",
        speakingModelIndex: 0,
      });

      void runAiResponse(
        runId,
        resolvedChatId,
        finalThreadId,
        trimmed,
        history,
        targetModelIds,
        contributions,
        payload.workspace,
      );
    },
    [chats, activeChatId, runAiResponse],
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

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
      deleteChat,
      sendMessage,
      updateChatPermissions,
      setChatPermissions,
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
      deleteChat,
      sendMessage,
      updateChatPermissions,
      setChatPermissions,
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
