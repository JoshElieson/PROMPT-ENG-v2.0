import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
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
  suggestCommitMessage,
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
      className="group hover:bg-panel-elevated flex w-full items-center gap-1.5 px-2 py-0.5 text-left"
      title={change.path}
    >
      <GitFileIcon path={change.path} />
      <span className="text-foreground min-w-0 truncate text-[13px]">{name}</span>
      {dir && (
        <span className="text-muted min-w-0 truncate text-[12px]">{dir}</span>
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
      <CollapsibleTrigger className="bg-panel/50 hover:bg-panel-elevated flex w-full items-center gap-1 px-2 py-1 text-left">
        {open ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
        )}
        <span className="text-foreground flex-1 text-[11px] font-semibold tracking-wide uppercase">
          {title}
        </span>
        <span className="bg-accent flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-black">
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
  const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false);

  const busy = isLoading || isOperating;
  const isRepo = status?.isRepo ?? false;
  const allChanges = useMemo(() => status?.changes ?? [], [status?.changes]);
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

  const handleGenerateCommitMessage = useCallback(async () => {
    setIsGeneratingCommitMessage(true);
    try {
      setCommitMessage(await generateCommitMessageWithAi(allChanges));
    } catch (error) {
      console.error("Could not generate commit message with AI.", error);
      setCommitMessage(suggestCommitMessage(allChanges).split("\n")[0] ?? "chore: update files");
    } finally {
      setIsGeneratingCommitMessage(false);
    }
  }, [allChanges]);

  const menuActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-6 w-6"
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
            <div className="border-border-subtle border-b px-2 py-1.5">
              <select
                className="border-border-subtle bg-surface text-foreground focus:border-accent w-full rounded border px-2 py-1 text-xs outline-none"
                value={projectId ?? ""}
                onChange={(e) => setActiveProject(e.target.value || null)}
                aria-label="Repository for this workspace"
              >
                <option value="">Select repository…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {!projectId && (
              <p className="text-muted px-3 py-4 text-center text-xs">
                Choose a repository for this workspace.
              </p>
            )}

            {projectId && isRepo && (
              <div className="border-border-subtle shrink-0 border-b px-3 pt-2 pb-2">
                <div className="relative">
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={onCommitKeyDown}
                    placeholder={`Message (Ctrl+Enter to commit on "${branchLabel}")`}
                    disabled={busy}
                    rows={3}
                    className="border-border-subtle text-foreground placeholder:text-muted focus:border-accent/60 w-full resize-none rounded border bg-[#1e1e1e] px-2 py-1.5 pr-8 text-[13px] leading-snug outline-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-accent absolute top-1 right-1 h-6 w-6"
                    title={GENERATE_COMMIT_AI_TOOLTIP}
                    disabled={busy || isGeneratingCommitMessage}
                    onClick={() => void handleGenerateCommitMessage()}
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
              <div className="border-border-subtle bg-surface mx-2 mt-2 shrink-0 space-y-2 rounded-md border p-2">
                <p className="text-muted text-[10px] font-medium tracking-wide uppercase">
                  Clone repository
                </p>
                <input
                  type="url"
                  placeholder="https://github.com/user/repo.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  className="border-border-subtle bg-panel text-foreground focus:border-accent w-full rounded border px-2 py-1 text-xs outline-none"
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
              {projectId && !isRepo && repoPath && (
                <div className="px-3 py-6 text-center">
                  <p className="text-muted text-xs">No repository found.</p>
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

              {projectId && isRepo && status?.clean && (
                <p className="text-muted px-3 py-4 text-center text-xs">
                  No changes. Working tree clean.
                </p>
              )}

              {projectId && isRepo && (
                <>
                  <ChangesSection title="Staged Changes" changes={staged} />
                  <ChangesSection title="Changes" changes={unstaged} />
                </>
              )}
            </ScrollArea>

            {projectId && isRepo && (
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
