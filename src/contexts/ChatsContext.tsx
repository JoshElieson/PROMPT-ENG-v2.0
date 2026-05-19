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
import { titleFromMessage } from "@/lib/chat-utils";
import {
  buildMockAssistantReply,
  delay,
  evenContributions,
} from "@/lib/mock-chat-response";
import {
  loadActiveChatId,
  loadChats,
  saveActiveChatId,
  saveChats,
} from "@/lib/storage";
import type {
  Chat,
  ChatMessage,
  ResponseLoadingState,
  SendMessagePayload,
} from "@/types/chat";
import { RESPONSE_TURN_MS } from "@/types/chat";

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
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(() =>
    resolveActiveId(loadChats(), loadActiveChatId()),
  );
  const [responseLoading, setResponseLoading] =
    useState<ResponseLoadingState | null>(null);
  const simulationRef = useRef(0);

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

  const runResponseSimulation = useCallback(
    async (
      runId: number,
      chatId: string,
      userContent: string,
      targetModelIds: string[],
      contributions: { modelId: string; percentage: number }[],
    ) => {
      const modelCount = Math.max(targetModelIds.length, 1);

      for (let i = 0; i < modelCount; i++) {
        if (simulationRef.current !== runId) return;

        setResponseLoading({
          chatId,
          targetModelIds,
          phase: "roundtable",
          speakingModelIndex: i,
        });

        await delay(RESPONSE_TURN_MS);
      }

      if (simulationRef.current !== runId) return;

      setResponseLoading({
        chatId,
        targetModelIds,
        phase: "synthesizing",
        speakingModelIndex: -1,
      });

      await delay(RESPONSE_TURN_MS);

      if (simulationRef.current !== runId) return;

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: buildMockAssistantReply(
          userContent,
          targetModelIds,
          contributions,
        ),
        createdAt: Date.now(),
        modelContributions: contributions,
      };

      setChats((prev) => appendAssistantMessage(prev, chatId, assistantMessage));
      setResponseLoading(null);
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

      const runId = ++simulationRef.current;
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

      setResponseLoading({
        chatId: resolvedChatId,
        targetModelIds,
        phase: "roundtable",
        speakingModelIndex: 0,
      });

      void runResponseSimulation(
        runId,
        resolvedChatId,
        trimmed,
        targetModelIds,
        contributions,
      );
    },
    [activeChatId, runResponseSimulation],
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
