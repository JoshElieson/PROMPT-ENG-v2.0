import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { titleFromMessage } from "@/lib/chat-utils";
import {
  loadActiveChatId,
  loadChats,
  saveActiveChatId,
  saveChats,
} from "@/lib/storage";
import type { Chat, ChatMessage, SendMessagePayload } from "@/types/chat";

interface ChatsContextValue {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
  createChat: () => string;
  selectChat: (id: string) => void;
  sendMessage: (payload: SendMessagePayload) => void;
}

const ChatsContext = createContext<ChatsContextValue | null>(null);

function resolveActiveId(chats: Chat[], storedId: string | null): string | null {
  if (storedId && chats.some((c) => c.id === storedId)) return storedId;
  if (chats.length === 0) return null;
  return chats[0].id;
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(() =>
    resolveActiveId(loadChats(), loadActiveChatId()),
  );

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

  const sendMessage = useCallback(
    (payload: SendMessagePayload) => {
      const trimmed = payload.content.trim();
      if (!trimmed && (!payload.attachments || payload.attachments.length === 0)) {
        return;
      }

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: now,
        attachments: payload.attachments,
        targetModelIds: payload.targetModelIds,
      };
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "test1",
        createdAt: now + 1,
      };
      const newMessages = [userMessage, assistantMessage];

      setChats((prev) => {
        const chatId = activeChatId;
        const list = prev;

        if (!chatId || !list.some((c) => c.id === chatId)) {
          const chat: Chat = {
            id: crypto.randomUUID(),
            title: titleFromMessage(trimmed || "Attachments"),
            messages: newMessages,
            createdAt: now,
            updatedAt: now + 1,
          };
          setActiveChatId(chat.id);
          return [chat, ...list];
        }

        return list.map((chat) => {
          if (chat.id !== chatId) return chat;
          const isFirst = chat.messages.length === 0;
          return {
            ...chat,
            title: isFirst
              ? titleFromMessage(trimmed || "Attachments")
              : chat.title,
            messages: [...chat.messages, ...newMessages],
            updatedAt: now + 1,
          };
        });
      });
    },
    [activeChatId],
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const value = useMemo(
    () => ({
      chats,
      activeChat,
      activeChatId,
      createChat,
      selectChat,
      sendMessage,
    }),
    [chats, activeChat, activeChatId, createChat, selectChat, sendMessage],
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
