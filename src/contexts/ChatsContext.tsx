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
import type { NodePermissions } from "@/types/project";
import type {
  AiWorkspacePayload,
  Chat,
  ChatMessage,
  ResponseLoadingState,
  SendMessagePayload,
} from "@/types/chat";

interface ChatsContextValue {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
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

function appendUserMessage(
  list: Chat[],
  chatId: string | null,
  userMessage: ChatMessage,
  trimmed: string,
  now: number,
): { chats: Chat[]; resolvedChatId: string } {
  if (!chatId || !list.some((c) => c.id === chatId)) {
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: titleFromMessage(trimmed || "Attachments"),
      messages: [userMessage],
      createdAt: now,
      updatedAt: now,
    };
    return { chats: [chat, ...list], resolvedChatId: chat.id };
  }

  return {
    resolvedChatId: chatId,
    chats: list.map((chat) => {
      if (chat.id !== chatId) return chat;
      const isFirst = chat.messages.length === 0;
      return {
        ...chat,
        title: isFirst
          ? titleFromMessage(trimmed || "Attachments")
          : chat.title,
        messages: [...chat.messages, userMessage],
        updatedAt: now,
      };
    }),
  };
}

function appendAssistantMessage(
  list: Chat[],
  chatId: string,
  assistantMessage: ChatMessage,
): Chat[] {
  return list.map((chat) => {
    if (chat.id !== chatId) return chat;
    return {
      ...chat,
      messages: [...chat.messages, assistantMessage],
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

  const createChat = useCallback((): string => {
    const now = Date.now();
    const chat: Chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      messages: [],
      createdAt: now,
      updatedAt: now,
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
        setChats((prev) => appendAssistantMessage(prev, chatId, assistantMessage));
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
      };

      let resolvedChatId = activeChatId ?? "";

      setChats((prev) => {
        const result = appendUserMessage(
          prev,
          activeChatId,
          userMessage,
          trimmed,
          now,
        );
        resolvedChatId = result.resolvedChatId;
        return result.chats;
      });

      setActiveChatId(resolvedChatId);

      const sourceChatId =
        activeChatId != null && chats.some((c) => c.id === activeChatId)
          ? activeChatId
          : null;
      const priorMessages =
        sourceChatId != null
          ? (chats.find((c) => c.id === sourceChatId)?.messages ?? [])
          : [];

      const history: ChatTurn[] = [
        ...priorMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: trimmed },
      ];

      setResponseLoading({
        chatId: resolvedChatId,
        targetModelIds,
        phase: "roundtable",
        speakingModelIndex: 0,
      });

      void runAiResponse(
        runId,
        resolvedChatId,
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
      responseLoading:
        responseLoading?.chatId === activeChatId ? responseLoading : null,
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
