import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { useChats } from "@/contexts/ChatsContext";
import { getOutermostEnabledContextRoots } from "@/lib/project-ai-paths";
import type { Chat } from "@/types/chat";
import { truncateChatTitle } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

function ChatListItem({
  title,
  contextRoots,
  active,
  onSelect,
  onDelete,
}: {
  title: string;
  contextRoots: { path: string; label: string }[];
  active?: boolean;
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
      className={cn(
        "group relative box-border w-full max-w-full min-w-0 rounded-lg border transition-colors hover:bg-panel-elevated",
        active
          ? "border-foreground/45 bg-panel-elevated"
          : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-0.5 overflow-hidden py-2 pr-9 pl-3 text-left outline-none focus-visible:ring-0"
      >
        <span
          className={cn(
            "block min-w-0 max-w-full truncate text-sm",
            active ? "text-foreground" : "text-muted-foreground",
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
        className="absolute right-1 top-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
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
  const { chats, activeChatId, createChat, selectChat, deleteChat } = useChats();
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const renderChat = (chat: Chat) => (
    <ChatListItem
      key={chat.id}
      title={chat.title}
      contextRoots={getOutermostEnabledContextRoots(chat.permissions)}
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
          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:bg-zinc-700 hover:text-foreground"
          onClick={() => createChat()}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      }
    >
      <ScrollArea className="h-full min-w-0">
        {chats.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">
            No chats yet. Start a new conversation.
          </p>
        ) : (
          <div className="box-border min-w-0 max-w-full space-y-0.5 pl-2.5 pr-3 pb-2 pt-0.5">
            {sortedChats.map(renderChat)}
          </div>
        )}
      </ScrollArea>
    </SidebarPanel>
  );
}
