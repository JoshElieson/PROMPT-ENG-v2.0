import { useCallback, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { CommitMessageChat } from "@/components/git/CommitMessageChat";
import { GitFileIcon } from "@/components/git/GitFileIcon";
import { SourceControlIcon } from "@/components/git/SourceControlIcon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { useGit } from "@/contexts/GitContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useProjects } from "@/contexts/ProjectsContext";
import {
  GENERATE_COMMIT_AI_TOOLTIP,
  generateCommitMessageWithAi,
} from "@/lib/commit-message";
import type { GitFileChange, GitFileStatus } from "@/types/git";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<GitFileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflicted: "!",
};

function splitFilePath(filePath: string): { name: string; dir: string } {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) return { name: normalized, dir: "" };
  return { name: normalized.slice(idx + 1), dir: normalized.slice(0, idx) };
}

function ChangeRow({ change }: { change: GitFileChange }) {
  const { name, dir } = splitFilePath(change.path);
  const label = STATUS_LABEL[change.status];

  return (
    <div
      className="group flex w-full items-center gap-1.5 px-2 py-0.5 text-left hover:bg-panel-elevated"
      title={change.path}
    >
      <GitFileIcon path={change.path} />
      <span className="min-w-0 truncate text-[13px] text-foreground">{name}</span>
      {dir && (
        <span className="min-w-0 truncate text-[12px] text-muted">{dir}</span>
      )}
      <span
        className={cn(
          "ml-auto shrink-0 text-[11px] font-semibold",
          change.status === "modified" && "text-amber-500/90",
          change.status === "added" && "text-success",
          change.status === "deleted" && "text-red-400",
          change.status === "untracked" && "text-muted",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function ChangesSection({
  title,
  changes,
  defaultOpen = true,
}: {
  title: string;
  changes: GitFileChange[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (changes.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 bg-panel/50 px-2 py-1 text-left hover:bg-panel-elevated">
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-black">
          {changes.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {changes.map((c) => (
          <ChangeRow key={`${title}-${c.path}-${c.staged}`} change={c} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface GitPanelProps {
  active?: boolean;
}

export function GitPanel({ active }: GitPanelProps) {
  const { dispatchMenuAction } = useLayout();
  const { projects, addProject, isAdding } = useProjects();
  const {
    repoPath,
    projectId,
    setActiveProject,
    status,
    isLoading,
    isOperating,
    lastMessage,
    lastMessageOk,
    refresh,
    pull,
    push,
    fetch,
    init,
    clone,
    commit,
    clearMessage,
  } = useGit();

  const [commitMessage, setCommitMessage] = useState("");
  const [showClone, setShowClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");

  const busy = isLoading || isOperating;
  const isRepo = status?.isRepo ?? false;
  const allChanges = status?.changes ?? [];
  const staged = allChanges.filter((c) => c.staged);
  const unstaged = allChanges.filter((c) => !c.staged);
  const hasStaged = staged.length > 0;
  const branchLabel = status?.branch ?? "main";

  const handleCommit = useCallback(
    async (stageAll: boolean) => {
      const msg = commitMessage.trim();
      if (!msg) return;
      await commit(msg, stageAll);
      setCommitMessage("");
    },
    [commit, commitMessage],
  );

  const onCommitKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleCommit(!hasStaged);
    }
  };

  const handleClone = async () => {
    const parent = repoPath;
    if (!parent || !cloneUrl.trim()) return;
    const result = await clone(cloneUrl.trim(), parent);
    if (result.success) {
      setShowClone(false);
      setCloneUrl("");
    }
  };

  const menuActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          title="More Actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={() => void refresh()} disabled={busy || !repoPath}>
          Refresh
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void pull()} disabled={busy || !isRepo}>
          Pull
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void push()} disabled={busy || !isRepo}>
          Push
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void fetch()} disabled={busy || !isRepo}>
          Fetch
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowClone(true)} disabled={busy}>
          Clone Repository…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SidebarPanel
      title="Source Control"
      active={active}
      titleIcon={<SourceControlIcon className="h-3.5 w-3.5" />}
      headerExtra={menuActions}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-3 py-8">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAdding}
              className="border-border-subtle bg-surface/80 text-foreground hover:bg-menu-hover hover:text-foreground"
              onClick={() => {
                dispatchMenuAction("view.explorer");
                void addProject();
              }}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Opening…
                </>
              ) : (
                "Add Project"
              )}
            </Button>
          </div>
        ) : (
          <>
            {projects.length > 1 && (
              <div className="border-b border-border-subtle px-2 py-1.5">
                <select
                  className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
                  value={projectId ?? projects[0]?.id ?? ""}
                  onChange={(e) => setActiveProject(e.target.value || null)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isRepo && (
              <div className="shrink-0 border-b border-border-subtle px-3 pb-2 pt-2">
                <div className="relative">
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={onCommitKeyDown}
                    placeholder={`Message (Ctrl+Enter to commit on "${branchLabel}")`}
                    disabled={busy}
                    rows={3}
                    className="w-full resize-none rounded border border-border-subtle bg-[#1e1e1e] px-2 py-1.5 pr-8 text-[13px] leading-snug text-foreground placeholder:text-muted outline-none focus:border-accent/60"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-accent"
                    title={GENERATE_COMMIT_AI_TOOLTIP}
                    disabled={busy}
                    onClick={() =>
                      setCommitMessage(generateCommitMessageWithAi(allChanges))
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="mt-2 flex">
                  <Button
                    type="button"
                    className="h-[26px] flex-1 gap-1.5 rounded-r-none bg-[#0e639c] text-xs text-white hover:bg-[#1177bb]"
                    disabled={busy || !commitMessage.trim()}
                    onClick={() => void handleCommit(!hasStaged)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Commit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        className="h-[26px] rounded-l-none border-l border-[#0a4f7c] bg-[#0e639c] px-1.5 text-white hover:bg-[#1177bb]"
                        disabled={busy || !commitMessage.trim()}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => void handleCommit(false)}
                        disabled={!hasStaged}
                      >
                        Commit Staged
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleCommit(true)}>
                        Commit All
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await handleCommit(true);
                          await push();
                        }}
                      >
                        Commit All & Push
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}

            {lastMessage && (
              <div
                className={cn(
                  "mx-2 mt-2 flex shrink-0 items-start gap-2 rounded-md border px-2 py-1.5 text-[11px]",
                  lastMessageOk
                    ? "border-success/30 bg-success/10 text-green-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300",
                )}
              >
                <span className="flex-1 leading-snug">{lastMessage}</span>
                <button
                  type="button"
                  onClick={clearMessage}
                  className="shrink-0 rounded p-0.5 hover:bg-white/10"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {showClone && (
              <div className="mx-2 mt-2 shrink-0 space-y-2 rounded-md border border-border-subtle bg-surface p-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                  Clone repository
                </p>
                <input
                  type="url"
                  placeholder="https://github.com/user/repo.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  className="w-full rounded border border-border-subtle bg-panel px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    disabled={busy || !cloneUrl.trim() || !repoPath}
                    onClick={() => void handleClone()}
                  >
                    Clone
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowClone(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="min-h-0 flex-1">
              {!isRepo && repoPath && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted">No repository found.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    disabled={busy}
                    onClick={() => void init()}
                  >
                    Initialize Repository
                  </Button>
                </div>
              )}

              {isRepo && status?.clean && (
                <p className="px-3 py-4 text-center text-xs text-muted">
                  No changes. Working tree clean.
                </p>
              )}

              {isRepo && (
                <>
                  <ChangesSection title="Staged Changes" changes={staged} />
                  <ChangesSection title="Changes" changes={unstaged} />
                </>
              )}
            </ScrollArea>

            {isRepo && (
              <CommitMessageChat
                changes={allChanges}
                draft={commitMessage}
                onApply={setCommitMessage}
                disabled={busy}
              />
            )}
          </>
        )}
      </div>
    </SidebarPanel>
  );
}
