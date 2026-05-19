import { Plus } from "lucide-react";
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
  onClick,
}: {
  title: string;
  time: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 border border-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-panel-elevated",
        active && "border-foreground bg-panel-elevated",
      )}
    >
      <span
        className={cn(
          "flex-1 truncate",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </span>
      <span className="shrink-0 text-xs text-muted">{time}</span>
    </button>
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
  const { chats, activeChatId, createChat, selectChat } = useChats();
  const grouped = groupChatsByDate(chats);

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
                {grouped.today.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    title={chat.title}
                    time={formatChatTime(chat.updatedAt)}
                    active={chat.id === activeChatId}
                    onClick={() => selectChat(chat.id)}
                  />
                ))}
              </>
            )}
            {grouped.yesterday.length > 0 && (
              <>
                <SectionLabel>Yesterday</SectionLabel>
                {grouped.yesterday.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    title={chat.title}
                    time={formatChatTime(chat.updatedAt)}
                    active={chat.id === activeChatId}
                    onClick={() => selectChat(chat.id)}
                  />
                ))}
              </>
            )}
            {grouped.older.length > 0 && (
              <>
                <SectionLabel>Older</SectionLabel>
                {grouped.older.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    title={chat.title}
                    time={formatChatTime(chat.updatedAt)}
                    active={chat.id === activeChatId}
                    onClick={() => selectChat(chat.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollArea>
    </SidebarPanel>
  );
}
