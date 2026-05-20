import { useCallback, useEffect, useRef, useState } from "react";

import { Pin, Plus, Trash2 } from "lucide-react";
import { WorkspaceContextMenu } from "@/components/layout/WorkspaceContextMenu";

import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";

import { SidebarPanel } from "@/components/layout/SidebarPanel";

import { useAppSelection } from "@/contexts/AppSelectionContext";

import { useChats } from "@/contexts/ChatsContext";

import { getOutermostEnabledContextRoots } from "@/lib/project-ai-paths";

import type { Chat } from "@/types/chat";

import {
  chatHasMessages,
  sortWorkspaces,
  truncateChatTitle,
} from "@/lib/chat-utils";

import { cn } from "@/lib/utils";



function ChatListItem({
  chat,
  contextRoots,
  isOpen,
  listSelected,
  isRenaming,
  onSelect,
  onDelete,
  onStartRename,
  onFinishRename,
}: {
  chat: Chat;
  contextRoots: { path: string; label: string }[];
  isOpen: boolean;
  listSelected: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
}) {
  const { renameChat } = useChats();
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitOnBlurRef = useRef(false);
  const contextLine =
    contextRoots.length > 0
      ? contextRoots.map((r) => r.label).join(" · ")
      : null;
  const contextTooltip = contextRoots.map((r) => r.path).join("\n");

  const commitRename = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== chat.title) {
      renameChat(chat.id, trimmed);
    }
    onFinishRename();
  }, [chat.id, chat.title, draftTitle, onFinishRename, renameChat]);

  const cancelRename = useCallback(() => {
    skipCommitOnBlurRef.current = true;
    onFinishRename();
  }, [onFinishRename]);

  useEffect(() => {
    if (!isRenaming) return;
    setDraftTitle(chat.title);
    const id = requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isRenaming, chat.title]);

  const titleRow = (
    <span className="flex min-w-0 max-w-full items-center gap-1.5">
      {chat.pinned ? (
        <Pin className="h-3 w-3 shrink-0 text-accent" aria-label="Pinned" />
      ) : null}
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={draftTitle}
          aria-label="Workspace name"
          className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground outline-none ring-1 ring-transparent focus:border-[#6366f1]/35 focus:ring-[#6366f1]/25"
          onChange={(e) => setDraftTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelRename();
            }
          }}
          onBlur={() => {
            if (skipCommitOnBlurRef.current) {
              skipCommitOnBlurRef.current = false;
              return;
            }
            commitRename();
          }}
        />
      ) : (
        <span
          className={cn(
            "block min-w-0 flex-1 truncate text-sm",
            isOpen || listSelected
              ? "text-foreground font-medium"
              : "text-muted-foreground",
          )}
          title={chat.title}
        >
          {truncateChatTitle(chat.title)}
        </span>
      )}
    </span>
  );

  return (
    <WorkspaceContextMenu chat={chat} onStartRename={onStartRename}>
      <div
        data-chat-id={chat.id}
        className={cn(
          "group flex w-full max-w-full min-w-0 items-center gap-1 rounded-xl border transition-all duration-150 hover:border-border hover:bg-panel-elevated/55",
          isRenaming || listSelected
            ? "border-[#6366f1]/28 bg-panel-elevated/72 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
            : isOpen
              ? "border-border bg-panel-elevated/80"
              : "border-transparent",
        )}
      >
        {isRenaming ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch gap-0.5 overflow-hidden py-2 pl-3 pr-2">
            {titleRow}
            {contextLine ? (
              <p
                className="mb-0 block min-w-0 max-w-full truncate text-[10px] leading-snug text-muted"
                title={contextTooltip}
              >
                {contextLine}
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="flex min-h-0 min-w-0 flex-1 flex-col items-stretch gap-0.5 overflow-hidden py-2 pl-3 pr-2 text-left outline-none focus-visible:ring-0"
          >
            {titleRow}
            {contextLine ? (
              <p
                className="mb-0 block min-w-0 max-w-full truncate text-[10px] leading-snug text-muted"
                title={contextTooltip}
              >
                {contextLine}
              </p>
            ) : null}
          </button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mr-1.5 h-7 w-7 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300"
          title="Delete workspace"
          aria-label={`Delete ${chat.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </WorkspaceContextMenu>
  );

}



interface ChatHistoryPanelProps {

  active?: boolean;

}



export function ChatHistoryPanel({ active }: ChatHistoryPanelProps) {

  const { chats, activeChatId, createChat, deleteChat } = useChats();

  const { zone, chatListFocusId, selectChat } = useAppSelection();

  const listRef = useRef<HTMLDivElement>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);

  const savedChats = chats.filter(chatHasMessages);
  const sortedChats = sortWorkspaces(savedChats);



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
      chat={chat}
      contextRoots={getOutermostEnabledContextRoots(chat.permissions)}

      isOpen={chat.id === activeChatId}

      listSelected={zone === "chat-list" && chat.id === chatListFocusId}

      isRenaming={renamingChatId === chat.id}

      onSelect={() => {

        selectChat(chat.id);

      }}

      onDelete={() => deleteChat(chat.id)}

      onStartRename={() => setRenamingChatId(chat.id)}

      onFinishRename={() => setRenamingChatId(null)}

    />

  );



  return (

    <SidebarPanel

      title="Workspaces"

      active={active}

      headerExtra={

        <Button

          variant="ghost"

          size="sm"

          className="h-6 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground"

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

        {savedChats.length === 0 ? (

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


