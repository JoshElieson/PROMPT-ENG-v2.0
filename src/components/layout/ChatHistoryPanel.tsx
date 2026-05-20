import { useEffect, useRef } from "react";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";

import { SidebarPanel } from "@/components/layout/SidebarPanel";

import { useAppSelection } from "@/contexts/AppSelectionContext";

import { useChats } from "@/contexts/ChatsContext";

import { getOutermostEnabledContextRoots } from "@/lib/project-ai-paths";

import type { Chat } from "@/types/chat";

import { truncateChatTitle } from "@/lib/chat-utils";

import { cn } from "@/lib/utils";



function ChatListItem({

  chatId,

  title,

  contextRoots,

  isOpen,

  listSelected,

  onSelect,

  onDelete,

}: {

  chatId: string;

  title: string;

  contextRoots: { path: string; label: string }[];

  isOpen: boolean;

  listSelected: boolean;

  onSelect: () => void;

  onDelete: () => void;

}) {

  const contextLine =

    contextRoots.length > 0

      ? contextRoots.map((r) => r.label).join(" · ")

      : null;

  const contextTooltip = contextRoots.map((r) => r.path).join("\n");



  return (

    <div

      data-chat-id={chatId}

      className={cn(

        "group flex w-full max-w-full min-w-0 items-center gap-1 rounded-lg border transition-colors hover:bg-panel-elevated",

        listSelected

          ? "border-accent/50 bg-panel-elevated ring-1 ring-inset ring-accent/30"

          : isOpen

            ? "border-foreground/45 bg-panel-elevated"

            : "border-transparent",

      )}

    >

      <button

        type="button"

        onClick={onSelect}

        className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch gap-0.5 overflow-hidden py-2 pl-3 pr-2 text-left outline-none focus-visible:ring-0"

      >

        <span

          className={cn(

            "block min-w-0 max-w-full truncate text-sm",

            isOpen || listSelected ? "text-foreground" : "text-muted-foreground",

          )}

          title={title}

        >

          {truncateChatTitle(title)}

        </span>

        {contextLine ? (

          <p

            className="mb-0 block min-w-0 max-w-full truncate text-[10px] leading-snug text-orange-400/90"

            title={contextTooltip}

          >

            {contextLine}

          </p>

        ) : null}

      </button>

      <Button

        type="button"

        variant="ghost"

        size="icon"

        className="mr-1.5 h-7 w-7 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"

        title="Delete chat"

        aria-label={`Delete ${title}`}

        onClick={(e) => {

          e.stopPropagation();

          onDelete();

        }}

      >

        <Trash2 className="h-3.5 w-3.5" />

      </Button>

    </div>

  );

}



interface ChatHistoryPanelProps {

  active?: boolean;

}



export function ChatHistoryPanel({ active }: ChatHistoryPanelProps) {

  const { chats, activeChatId, createChat, deleteChat } = useChats();

  const { zone, chatListFocusId, selectChat } = useAppSelection();

  const listRef = useRef<HTMLDivElement>(null);

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);



  useEffect(() => {

    if (zone !== "chat-list" || !chatListFocusId) return;

    const el = listRef.current?.querySelector<HTMLElement>(

      `[data-chat-id="${CSS.escape(chatListFocusId)}"]`,

    );

    el?.scrollIntoView({ block: "nearest", behavior: "auto" });

  }, [zone, chatListFocusId, sortedChats.length]);



  const renderChat = (chat: Chat) => (

    <ChatListItem

      key={chat.id}

      chatId={chat.id}

      title={chat.title}

      contextRoots={getOutermostEnabledContextRoots(chat.permissions)}

      isOpen={chat.id === activeChatId}

      listSelected={zone === "chat-list" && chat.id === chatListFocusId}

      onSelect={() => {

        selectChat(chat.id);

      }}

      onDelete={() => deleteChat(chat.id)}

    />

  );



  return (

    <SidebarPanel

      title="Chats"

      active={active}

      headerExtra={

        <Button

          variant="ghost"

          size="sm"

          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:bg-zinc-700 hover:text-foreground"

          onClick={() => {

            const id = createChat();

            selectChat(id);

          }}

        >

          <Plus className="h-3 w-3" />

          New

        </Button>

      }

    >

      <ScrollArea className="h-full min-w-0" data-chat-list-panel>

        {chats.length === 0 ? (

          <p className="px-3 py-6 text-center text-xs text-muted">

            No chats yet. Start a new conversation.

          </p>

        ) : (

          <div

            ref={listRef}

            className="box-border min-w-0 max-w-full space-y-0.5 pl-2.5 pr-3 pb-2 pt-0.5"

          >

            {sortedChats.map(renderChat)}

          </div>

        )}

      </ScrollArea>

    </SidebarPanel>

  );

}


