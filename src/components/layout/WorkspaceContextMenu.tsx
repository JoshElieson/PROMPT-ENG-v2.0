import { useCallback, type ReactNode } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@/lib/tauri";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useChats } from "@/contexts/ChatsContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useProjects } from "@/contexts/ProjectsContext";
import type { Chat } from "@/types/chat";

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function buildSharePayload(chat: Chat): string {
  const threads = chat.threads.map((t) => ({
    id: t.id,
    messageCount: t.messages.length,
    updatedAt: t.updatedAt,
  }));
  return JSON.stringify(
    {
      id: chat.id,
      title: chat.title,
      pinned: Boolean(chat.pinned),
      threads,
      updatedAt: chat.updatedAt,
    },
    null,
    2,
  );
}

interface WorkspaceContextMenuProps {
  chat: Chat;
  children: ReactNode;
  onDeleted?: () => void;
  onStartRename?: () => void;
}

export function WorkspaceContextMenu({
  chat,
  children,
  onDeleted,
  onStartRename,
}: WorkspaceContextMenuProps) {
  const { togglePinChat, deleteChat } = useChats();
  const { selectChat, selectProjectPath } = useAppSelection();
  const { dispatchMenuAction } = useLayout();
  const { pickProjectContextForChat, setError } = useProjects();

  const handlePin = useCallback(() => {
    togglePinChat(chat.id);
  }, [chat.id, togglePinChat]);

  const handleShare = useCallback(async () => {
    try {
      await copyText(buildSharePayload(chat));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy workspace.");
    }
  }, [chat, setError]);

  const handleDelete = useCallback(async () => {
    const ok = isTauri()
      ? await confirm(`Delete workspace "${chat.title}"?`, {
          title: "Delete Workspace",
          kind: "warning",
        })
      : window.confirm(`Delete workspace "${chat.title}"?`);
    if (!ok) return;
    deleteChat(chat.id);
    onDeleted?.();
  }, [chat.id, chat.title, deleteChat, onDeleted]);

  const handleAddProjectContext = useCallback(async () => {
    selectChat(chat.id);
    dispatchMenuAction("view.explorer");

    try {
      const rootPath = await pickProjectContextForChat(chat.id);
      if (!rootPath) return;
      selectProjectPath(rootPath);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to add project context.",
      );
    }
  }, [
    chat.id,
    selectChat,
    dispatchMenuAction,
    pickProjectContextForChat,
    selectProjectPath,
    setError,
  ]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuCheckboxItem
          checked={Boolean(chat.pinned)}
          onSelect={handlePin}
        >
          Pin chat
        </ContextMenuCheckboxItem>
        <ContextMenuItem onSelect={() => void handleShare()}>
          Share
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onStartRename?.()}>
          Rename…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void handleAddProjectContext()}>
          Add project context
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-red-300 data-[highlighted]:text-red-200"
          onSelect={() => void handleDelete()}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
