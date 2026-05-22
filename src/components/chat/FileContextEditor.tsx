import { FolderOpen, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useChats } from "@/contexts/ChatsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  disableContextRoot,
  getOutermostEnabledContextRoots,
} from "@/lib/project-ai-paths";
import { cn } from "@/lib/utils";
import type { NodePermissions } from "@/types/project";

type FileContextEditorProps = {
  chatId: string;
  permissions: Record<string, NodePermissions> | undefined;
  className?: string;
};

export function FileContextEditor({
  chatId,
  permissions,
  className,
}: FileContextEditorProps) {
  const { updateChatPermissions } = useChats();
  const { pickProjectContextForChat, isAdding } = useProjects();
  const [picking, setPicking] = useState(false);

  const contextRoots = useMemo(
    () => getOutermostEnabledContextRoots(permissions),
    [permissions],
  );

  const removeRoot = useCallback(
    (rootPath: string) => {
      updateChatPermissions(chatId, (prev) => disableContextRoot(prev, rootPath));
    },
    [chatId, updateChatPermissions],
  );

  const addContext = useCallback(async () => {
    if (picking || isAdding) return;
    setPicking(true);
    try {
      await pickProjectContextForChat(chatId);
    } finally {
      setPicking(false);
    }
  }, [chatId, isAdding, pickProjectContextForChat, picking]);

  const busy = picking || isAdding;

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-panel-elevated/80 px-2 py-1.5",
        className,
      )}
      data-ai-target="chat.settings.file-context"
    >
      {contextRoots.length > 0 ? (
        <ul className="mb-1.5 space-y-1">
          {contextRoots.map((root) => (
            <li
              key={root.path}
              className="flex min-w-0 items-center gap-1 rounded-md border border-border/50 bg-panel/90 px-1.5 py-0.5"
            >
              <FolderOpen
                className="h-3 w-3 shrink-0 text-muted-foreground/80"
                aria-hidden
              />
              <span
                className="min-w-0 flex-1 truncate text-[11px] text-foreground/90"
                title={root.path}
              >
                {root.label}
              </span>
              <button
                type="button"
                onClick={() => removeRoot(root.path)}
                className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 transition-colors"
                aria-label={`Remove ${root.label} from file context`}
              >
                <X className="h-2.5 w-2.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => void addContext()}
        disabled={busy}
        className={cn(
          "flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/55",
          "text-[11px] text-muted-foreground transition-colors",
          "hover:border-border-subtle hover:bg-panel/60 hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Plus className="h-3 w-3 shrink-0" aria-hidden />
        {busy ? "Opening folder picker…" : "Add folder"}
      </button>
    </div>
  );
}
