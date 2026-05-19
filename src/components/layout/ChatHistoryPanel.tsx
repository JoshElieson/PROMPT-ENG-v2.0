import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { useChats } from "@/contexts/ChatsContext";
import { formatChatTime, groupChatsByDate } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

function ChatListItem({
  title,
  time,
  active,
  onSelect,
  onDelete,
}: {
  title: string;
  time: string;
  active?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex w-full items-center rounded-lg border border-transparent transition-colors hover:bg-panel-elevated",
        active && "border-foreground bg-panel-elevated",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-9 pl-3 text-left text-sm"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <span className="shrink-0 text-xs text-muted">{time}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-1.5 text-xs font-medium text-muted">{children}</p>
  );
}

interface ChatHistoryPanelProps {
  active?: boolean;
}

export function ChatHistoryPanel({ active }: ChatHistoryPanelProps) {
  const { chats, activeChatId, createChat, selectChat, deleteChat } = useChats();
  const grouped = groupChatsByDate(chats);

  const renderChat = (chat: (typeof chats)[number]) => (
    <ChatListItem
      key={chat.id}
      title={chat.title}
      time={formatChatTime(chat.updatedAt)}
      active={chat.id === activeChatId}
      onSelect={() => selectChat(chat.id)}
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
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => createChat()}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      }
    >
      <ScrollArea className="h-full">
        {chats.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">
            No chats yet. Start a new conversation.
          </p>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <>
                <SectionLabel>Today</SectionLabel>
                {grouped.today.map(renderChat)}
              </>
            )}
            {grouped.yesterday.length > 0 && (
              <>
                <SectionLabel>Yesterday</SectionLabel>
                {grouped.yesterday.map(renderChat)}
              </>
            )}
            {grouped.older.length > 0 && (
              <>
                <SectionLabel>Older</SectionLabel>
                {grouped.older.map(renderChat)}
              </>
            )}
          </>
        )}
      </ScrollArea>
    </SidebarPanel>
  );
}
