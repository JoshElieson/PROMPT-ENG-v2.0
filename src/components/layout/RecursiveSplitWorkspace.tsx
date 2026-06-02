import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { Plus, X } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ForgeWordmark } from "@/components/brand/ForgeWordmark";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ResponseLoadingView } from "@/components/chat/ResponseLoadingView";
import {
  ThreadTabUnreadDot,
  TypingIndicator,
} from "@/components/chat/TypingIndicator";
import { Button } from "@/components/ui/button";
import { PaneRoundTableProvider } from "@/contexts/PaneRoundTableContext";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import {
  dataTransferAcceptsComposerDrop,
  isProjectDragActive,
} from "@/lib/project-drag";
import { useChats } from "@/contexts/ChatsContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useWorkspacePanes } from "@/contexts/WorkspacePanesContext";
import { buildModelKeyboardShortcuts } from "@/data/keyboard-shortcuts";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { resolveAutoScrollEnabled } from "@/lib/chat-behavior";
import { extractForgeActivities } from "@/lib/forge-activity";
import { gitRestorePaths } from "@/lib/git";
import { threadDisplayTitle } from "@/lib/chat-utils";
import { collectLeaves, findLeaf } from "@/lib/center-workspace-layout";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatThread, ResponseLoadingState } from "@/types/chat";
import type { WorkspaceLeafNode } from "@/types/workspace-pane";
import { SplitPaneGroup } from "@/components/workspace/SplitPaneGroup";

type DropSide = "before" | "after";

async function confirmCloseWorkingThread(title: string): Promise<boolean> {
  const message = `"${title}" is still working. Close this agent? The current response will be stopped.`;
  return isTauri()
    ? await confirm(message, {
        title: "Agent is working",
        kind: "warning",
      })
    : window.confirm(message);
}

function ChatThreadTab({
  leaf,
  index,
  thread,
  isActive,
  isLoading,
  hasUnread,
  paneCount,
  isRenaming,
  onSelect,
  onRequestClose,
  onStartRename,
  onFinishRename,
  onForceKill,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging,
  dropIndicatorSide,
}: {
  leaf: WorkspaceLeafNode;
  index: number;
  thread: ChatThread | undefined;
  isActive: boolean;
  isLoading: boolean;
  hasUnread: boolean;
  paneCount: number;
  isRenaming: boolean;
  onSelect: () => void;
  onRequestClose: () => void;
  onStartRename: () => void;
  onFinishRename: () => void;
  onForceKill: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  dropIndicatorSide?: DropSide | null;
}) {
  const { renameThread } = useChats();
  const title = thread
    ? threadDisplayTitle(thread, index)
    : `Agent ${index + 1}`;
  const [draftTitle, setDraftTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitOnBlurRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    queueMicrotask(() => setDraftTitle(title));
    const id = requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isRenaming, title]);

  const commitRename = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) {
      renameThread(leaf.threadId, trimmed);
    }
    onFinishRename();
  }, [draftTitle, leaf.threadId, onFinishRename, renameThread, title]);

  const cancelRename = useCallback(() => {
    skipCommitOnBlurRef.current = true;
    onFinishRename();
  }, [onFinishRename]);

  const statusTitle = isLoading
    ? `${title} — working…`
    : hasUnread
      ? `${title} — new response`
      : title;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-agent-tab-leaf-id={leaf.id}
          role="tab"
          aria-selected={isActive}
          aria-busy={isLoading}
          draggable={draggable}
          className={cn(
            "group relative flex shrink-0 items-center rounded-lg border text-xs font-medium transition-all duration-150",
            draggable && "cursor-grab active:cursor-grabbing",
            isDragging && "opacity-70",
            isActive
              ? "border-[#6366f1]/28 bg-panel-elevated/72 text-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-panel-elevated/70 hover:text-foreground",
          )}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
        >
          {dropIndicatorSide === "before" && (
            <span className="pointer-events-none absolute inset-y-0 -left-0.5 w-0.5 rounded-full bg-[#818cf8]" />
          )}
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              aria-label="Agent name"
              className="border-border bg-background text-foreground mx-1 max-w-[10rem] min-w-[4rem] rounded border px-1.5 py-0.5 text-xs ring-1 ring-transparent outline-none focus:border-[#6366f1]/35 focus:ring-[#6366f1]/25"
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
            <button
              type="button"
              className={cn(
                "flex min-w-0 items-center gap-1 py-1 pl-2",
                paneCount > 1 ? "pr-0.5" : "pr-2",
              )}
              title={statusTitle}
              onClick={onSelect}
            >
              <ChatThreadTabStatus
                isLoading={isLoading}
                hasUnread={hasUnread}
              />
              <span>{title}</span>
            </button>
          )}
          {paneCount > 1 ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-panel-elevated hover:text-foreground mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
              title={`Close ${title}`}
              aria-label={`Close ${title}`}
              onClick={(e) => {
                e.stopPropagation();
                void onRequestClose();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          {dropIndicatorSide === "after" && (
            <span className="pointer-events-none absolute inset-y-0 -right-0.5 w-0.5 rounded-full bg-[#818cf8]" />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[180px]">
        <ContextMenuItem onSelect={onStartRename}>Rename…</ContextMenuItem>
        {isLoading ? (
          <ContextMenuItem
            className="text-red-300 data-[highlighted]:text-red-200"
            onSelect={onForceKill}
          >
            Force kill
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ChatThreadTabStatus({
  isLoading,
  hasUnread,
}: {
  isLoading: boolean;
  hasUnread: boolean;
}) {
  if (isLoading) {
    return (
      <TypingIndicator
        className="shrink-0 px-0.5"
        dotClassName="bg-foreground/70"
      />
    );
  }
  if (hasUnread) {
    return <ThreadTabUnreadDot />;
  }
  return (
    <span
      className="bg-muted-foreground/55 h-1.5 w-1.5 shrink-0 rounded-full"
      aria-hidden
    />
  );
}

const SLOGAN_SENTENCES = [
  "One prompt.",
  "Multiple models.",
  "Better answers.",
] as const;

const SLOGAN_REVEAL_MS = 1000;

function dropSideFromPointer(e: DragEvent<HTMLDivElement>): DropSide {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
}

function reorderIdListByPlacement(
  ids: string[],
  sourceId: string,
  targetId: string,
  side: DropSide,
): string[] {
  if (sourceId === targetId) return ids;
  if (!ids.includes(sourceId) || !ids.includes(targetId)) return ids;
  const withoutSource = ids.filter((id) => id !== sourceId);
  const targetIndex = withoutSource.findIndex((id) => id === targetId);
  if (targetIndex < 0) return ids;
  const insertAt = side === "before" ? targetIndex : targetIndex + 1;
  const next = [...withoutSource];
  next.splice(insertAt, 0, sourceId);
  return next;
}

function CompactWelcomePane() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <ForgeWordmark height={44} className="translate-y-px" />
    </section>
  );
}

function WelcomePane({
  keyboardShortcuts,
}: {
  keyboardShortcuts: { keys: string; label: string }[];
}) {
  const [sloganVisibleCount, setSloganVisibleCount] = useState(0);

  useEffect(() => {
    const timers = SLOGAN_SENTENCES.map((_, index) =>
      window.setTimeout(
        () => setSloganVisibleCount(index + 1),
        SLOGAN_REVEAL_MS * (index + 1),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="flex flex-col items-center px-8 pt-16 pb-8">
      <h1 className="flex items-center gap-3 text-[1.55rem] font-medium tracking-tight">
        Welcome to <ForgeWordmark height={36} className="translate-y-px" />
      </h1>
      <p className="text-muted mt-2 w-full text-center">
        {SLOGAN_SENTENCES.map((sentence, index) => (
          <span
            key={sentence}
            className={cn(
              "transition-opacity duration-500",
              index < sloganVisibleCount ? "opacity-100" : "opacity-0",
              index === SLOGAN_SENTENCES.length - 1 && "text-accent/75",
            )}
          >
            {sentence}
            {index < SLOGAN_SENTENCES.length - 1 ? " " : ""}
          </span>
        ))}
      </p>

      <section className="border-border bg-panel/80 mt-8 rounded-xl border p-4 backdrop-blur-sm">
        <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {keyboardShortcuts.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center gap-3">
              <kbd className="border-border bg-surface text-muted-foreground min-w-[3rem] rounded border px-2 py-0.5 text-center text-xs font-medium">
                {shortcut.keys}
              </kbd>
              <span className="text-muted-foreground">{shortcut.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function collectWrittenPathsFromAssistantMessages(messages: ChatMessage[]): string[] {
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const { activities } = extractForgeActivities(message.content);
    for (const activity of activities) {
      if (activity.action !== "write") continue;
      const path = activity.path.trim();
      if (!path) continue;
      seen.add(path);
    }
  }
  return [...seen];
}

function ChatPaneBody({
  leaf,
  isActive,
}: {
  leaf: WorkspaceLeafNode;
  isActive: boolean;
}) {
  const {
    activeChat,
    activeChatId,
    responseLoading,
    getStreamingActivities,
    getAgentActivityEvents,
    forceKillThread,
    truncateThreadAfterMessage,
  } = useChats();
  const { projects } = useProjects();
  const {
    isWorkspaceScreenSelected,
    selectWorkspaceScreen,
    registerFocusComposer,
    registerFocusWorkspaceScreen,
  } = useAppSelection();
  const { paneCount, onLeafScrollChange, setFocusedLeafId } = useWorkspacePanes();
  const { workspaceBottomPanelOpen } = useLayout();

  const messages = useMemo(() => {
    if (!activeChat) return [];
    const thread = activeChat.threads.find((t) => t.id === leaf.threadId);
    return thread?.messages ?? [];
  }, [activeChat, leaf.threadId]);
  const agentLabel = useMemo(() => {
    if (!activeChat) return "Agent";
    const threadIndex = activeChat.threads.findIndex((t) => t.id === leaf.threadId);
    const thread = threadIndex >= 0 ? activeChat.threads[threadIndex] : undefined;
    return thread ? threadDisplayTitle(thread, threadIndex) : "Agent";
  }, [activeChat, leaf.threadId]);

  const showWelcome = messages.length === 0;
  const showFullWelcome =
    showWelcome && paneCount === 1 && !workspaceBottomPanelOpen;
  const showCompactWelcome = showWelcome && !showFullWelcome;

  const loadingForPane =
    responseLoading?.chatId === activeChatId &&
    responseLoading.threadId === leaf.threadId
      ? responseLoading
      : null;
  const loadingActivities = useMemo(() => {
    if (!loadingForPane || !activeChatId) return [];
    return getStreamingActivities(activeChatId, leaf.threadId);
  }, [activeChatId, getStreamingActivities, leaf.threadId, loadingForPane]);
  const agentActivityEvents = useMemo(() => {
    if (!activeChatId) return [];
    return getAgentActivityEvents(activeChatId, leaf.threadId);
  }, [activeChatId, getAgentActivityEvents, leaf.threadId]);
  const loadingHighlightIds = useMemo(() => {
    if (!loadingForPane) return [];
    const speakingIdx = loadingForPane.speakingModelIndex;
    if (
      speakingIdx >= 0 &&
      speakingIdx < loadingForPane.targetModelIds.length
    ) {
      return [loadingForPane.targetModelIds[speakingIdx]];
    }
    return loadingForPane.targetModelIds;
  }, [loadingForPane]);
  const autoScrollEnabled = resolveAutoScrollEnabled(activeChat);

  const scrollElRef = useRef<HTMLDivElement>(null);
  const scrollWriteTimer = useRef(0);

  const { selectedIds, activeIds } = useChatRoundTable();
  const keyboardShortcuts = useMemo(
    () =>
      buildModelKeyboardShortcuts(
        selectedIds.filter((id) => activeIds.includes(id)),
      ),
    [selectedIds, activeIds],
  );

  useLayoutEffect(() => {
    const el = scrollElRef.current;
    if (!el) return;
    el.scrollTop = leaf.scrollTop ?? 0;
  }, [leaf.id, leaf.scrollTop]);

  const scrollToEnd = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const scrollToPreviousUserMessage = useCallback(() => {
    const scrollEl = scrollElRef.current;
    if (!scrollEl) return;

    const userMessages = Array.from(
      scrollEl.querySelectorAll<HTMLElement>('[data-chat-message-role="user"]'),
    );
    if (userMessages.length === 0) return;

    const currentTop = scrollEl.scrollTop;
    const target = [...userMessages]
      .reverse()
      .find((messageEl) => messageEl.offsetTop < currentTop - 8);
    if (!target) return;

    const nextTop = Math.max(0, target.offsetTop - 12);
    scrollEl.scrollTo({ top: nextTop, behavior: "smooth" });
    target.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (autoScrollEnabled && loadingForPane) scrollToEnd();
  }, [autoScrollEnabled, loadingForPane, scrollToEnd]);

  useEffect(() => {
    if (!isActive) return;
    const onGoPreviousMessage = () => {
      selectWorkspaceScreen();
      scrollToPreviousUserMessage();
    };
    const onGoNextMessage = () => {
      selectWorkspaceScreen();
      scrollElRef.current?.scrollTo({
        top: scrollElRef.current.scrollHeight,
        behavior: "smooth",
      });
      composerRef.current?.focus();
      const inputEl = paneRef.current?.querySelector<HTMLTextAreaElement>(
        "[data-composer-textarea]",
      );
      if (!inputEl) return;
      const end = inputEl.value.length;
      inputEl.setSelectionRange(end, end);
    };

    window.addEventListener("forge:go-previous-message", onGoPreviousMessage);
    window.addEventListener("forge:go-next-message", onGoNextMessage);
    return () => {
      window.removeEventListener("forge:go-previous-message", onGoPreviousMessage);
      window.removeEventListener("forge:go-next-message", onGoNextMessage);
    };
  }, [isActive, scrollToPreviousUserMessage, selectWorkspaceScreen]);

  const scheduleScrollPersist = useCallback(
    (top: number) => {
      if (scrollWriteTimer.current !== 0) {
        window.clearTimeout(scrollWriteTimer.current);
      }
      scrollWriteTimer.current = window.setTimeout(() => {
        scrollWriteTimer.current = 0;
        onLeafScrollChange(leaf.id, top);
      }, 200);
    },
    [leaf.id, onLeafScrollChange],
  );

  useEffect(() => {
    return () => {
      if (scrollWriteTimer.current !== 0) {
        window.clearTimeout(scrollWriteTimer.current);
      }
    };
  }, []);

  const paneRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const [undoMessageId, setUndoMessageId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  const handleWorkspaceDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!dataTransferAcceptsComposerDrop(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleWorkspaceDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (composerRef.current?.attachFromDataTransfer(e.dataTransfer)) return;
    if (!isProjectDragActive()) return;
    composerRef.current?.dropProjectFromDataTransfer(e.dataTransfer);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    return registerFocusComposer(() => composerRef.current?.focus());
  }, [isActive, registerFocusComposer]);

  useEffect(() => {
    if (!isActive) return;
    return registerFocusWorkspaceScreen(() => {
      scrollElRef.current?.focus();
    });
  }, [isActive, registerFocusWorkspaceScreen]);

  const handlePaneMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, a, textarea, input, select, [contenteditable='true'], footer",
        )
      ) {
        return;
      }
      setFocusedLeafId(leaf.id);
      selectWorkspaceScreen();
      e.currentTarget.focus();
    },
    [leaf.id, selectWorkspaceScreen, setFocusedLeafId],
  );

  useEffect(() => {
    if (!isActive) return;

    const onKeyDownCapture = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.isComposing) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      if (!isWorkspaceScreenSelected) return;

      const pane = paneRef.current;
      if (!pane) return;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;

      if (active.closest("[data-composer-textarea]")) return;

      if (
        active.closest(
          "button, a, input, select, textarea, [data-workspace-terminal], .xterm, [contenteditable='true']",
        )
      ) {
        return;
      }

      if (!pane.contains(active)) return;

      const textarea = pane.querySelector<HTMLTextAreaElement>(
        "[data-composer-textarea]",
      );
      if (!textarea) return;

      e.preventDefault();
      e.stopPropagation();
      composerRef.current?.appendText(e.key);
    };

    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, [isActive, isWorkspaceScreenSelected]);

  const handleUndoFromMessage = useCallback(
    async (messageId: string) => {
      if (!activeChatId || !activeChat) return;
      const thread = activeChat.threads.find((item) => item.id === leaf.threadId);
      if (!thread) return;
      const cutoff = thread.messages.findIndex((item) => item.id === messageId);
      if (cutoff < 0 || cutoff >= thread.messages.length - 1) return;

      setUndoError(null);
      setUndoMessageId(messageId);
      try {
        if (loadingForPane) {
          forceKillThread(leaf.threadId);
        }

        const droppedMessages = thread.messages.slice(cutoff + 1);
        const writtenPaths = collectWrittenPathsFromAssistantMessages(droppedMessages);
        const projectRoot = projects.find(
          (project) => project.id === activeChat.gitProjectId,
        )?.rootPath;

        if (projectRoot && writtenPaths.length > 0) {
          const result = await gitRestorePaths(projectRoot, writtenPaths);
          if (!result.success) {
            setUndoError(result.output || "Undo restored files with errors.");
          }
        }

        truncateThreadAfterMessage(activeChatId, leaf.threadId, messageId);
      } catch (error) {
        setUndoError(
          error instanceof Error
            ? error.message
            : "Undo failed. Please retry.",
        );
      } finally {
        setUndoMessageId(null);
      }
    },
    [
      activeChatId,
      activeChat,
      leaf.threadId,
      loadingForPane,
      forceKillThread,
      projects,
      truncateThreadAfterMessage,
    ],
  );

  return (
    <div
      ref={paneRef}
      role="region"
      aria-label="Chat pane"
      data-pane-leaf-id={leaf.id}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background outline-none"
      tabIndex={-1}
      onMouseDown={handlePaneMouseDown}
    >
      <span className="pointer-events-none absolute top-2 left-3 z-10 text-[10px] font-medium text-muted-foreground/50">
        {agentLabel}
      </span>
      <div
        ref={scrollElRef}
        data-workspace-screen
        className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] outline-none"
        tabIndex={-1}
        onMouseDown={(e) => {
          if (
            (e.target as HTMLElement).closest(
              "button, a, textarea, input, select",
            )
          ) {
            return;
          }
          selectWorkspaceScreen();
          e.currentTarget.focus();
        }}
        onDragOver={handleWorkspaceDragOver}
        onDrop={handleWorkspaceDrop}
        onScroll={(e) => scheduleScrollPersist(e.currentTarget.scrollTop)}
      >
        <div className="flex min-w-0 flex-col">
          {showFullWelcome && (
            <WelcomePane keyboardShortcuts={keyboardShortcuts} />
          )}

          {showCompactWelcome && <CompactWelcomePane />}

          {messages.length > 0 && (
            <section className="mx-auto w-full max-w-2xl space-y-4 px-6 pt-4 pb-2">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showStopAction={
                    message.role === "user" &&
                    loadingForPane != null &&
                    messages.slice(index + 1).every((item) => item.role !== "assistant")
                  }
                  showUndoAction={
                    message.role === "user" &&
                    index < messages.length - 1
                  }
                  onStop={() => forceKillThread(leaf.threadId)}
                  onUndo={() => void handleUndoFromMessage(message.id)}
                  disableActions={undoMessageId === message.id}
                />
              ))}

              {undoError ? (
                <p className="text-[11px] text-amber-300/95">{undoError}</p>
              ) : null}

              {loadingForPane && (
                <ResponseLoadingView
                  loading={loadingForPane}
                  activities={loadingActivities}
                  activityEvents={agentActivityEvents}
                />
              )}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <ChatComposer
          ref={composerRef}
          chatId={activeChatId!}
          threadId={leaf.threadId}
          onSent={autoScrollEnabled ? scrollToEnd : undefined}
          highlightIdsOverride={loadingHighlightIds}
        />
      </div>
    </div>
  );
}

function LeafPane({
  leaf,
  isActive,
}: {
  leaf: WorkspaceLeafNode;
  isActive: boolean;
}) {
  const { onLeafModelsChange } = useWorkspacePanes();

  return (
    <PaneRoundTableProvider
      session={leaf.models}
      onSessionChange={(next) => onLeafModelsChange(leaf.id, next)}
    >
      <ChatPaneBody leaf={leaf} isActive={isActive} />
    </PaneRoundTableProvider>
  );
}

function ChatThreadTabs() {
  const {
    layout,
    paneCount,
    maxPanes,
    focusedLeafId,
    setFocusedLeafId,
    expandLayout,
    closeLeaf,
    dragLeafId,
    setDragLeafId,
  } = useWorkspacePanes();
  const { activeChat, activeChatId, responseLoading, forceKillThread } =
    useChats();
  const {
    selectWorkspaceScreen,
    registerFocusWorkspaceAgentTabs,
  } = useAppSelection();

  const leaves = useMemo(() => collectLeaves(layout.root), [layout.root]);
  const [orderedLeafIds, setOrderedLeafIds] = useState<string[]>([]);
  const [dropHint, setDropHint] = useState<{
    targetLeafId: string;
    side: DropSide;
  } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setOrderedLeafIds((prev) => {
        const nextIds = leaves.map((leaf) => leaf.id);
        const nextSet = new Set(nextIds);
        const kept = prev.filter((id) => nextSet.has(id));
        const missing = nextIds.filter((id) => !kept.includes(id));
        return [...kept, ...missing];
      });
    });
  }, [leaves]);

  const orderedLeaves = useMemo(() => {
    const leafById = new Map(leaves.map((leaf) => [leaf.id, leaf]));
    const inOrder = orderedLeafIds
      .map((id) => leafById.get(id))
      .filter((leaf): leaf is WorkspaceLeafNode => leaf != null);
    const seen = new Set(inOrder.map((leaf) => leaf.id));
    const append = leaves.filter((leaf) => !seen.has(leaf.id));
    return [...inOrder, ...append];
  }, [leaves, orderedLeafIds]);

  const threadById = useMemo(() => {
    const map = new Map<string, ChatThread>();
    for (const t of activeChat?.threads ?? []) {
      map.set(t.id, t);
    }
    return map;
  }, [activeChat?.threads]);

  const focusedThreadId = useMemo(() => {
    const leaf = findLeaf(layout.root, focusedLeafId);
    return leaf?.threadId ?? null;
  }, [layout.root, focusedLeafId]);

  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const prevResponseLoadingRef = useRef<ResponseLoadingState | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [prevActiveChatForTabs, setPrevActiveChatForTabs] = useState(activeChatId);

  if (activeChatId !== prevActiveChatForTabs) {
    setPrevActiveChatForTabs(activeChatId);
    setUnreadThreadIds(new Set());
    setRenamingThreadId(null);
  }

  useEffect(() => {
    const prev = prevResponseLoadingRef.current;
    prevResponseLoadingRef.current = responseLoading;

    if (
      prev &&
      !responseLoading &&
      prev.chatId === activeChatId &&
      focusedThreadId != null &&
      prev.threadId !== focusedThreadId
    ) {
      setUnreadThreadIds((current) => {
        const next = new Set(current);
        next.add(prev.threadId);
        return next;
      });
    }
  }, [responseLoading, activeChatId, focusedThreadId]);

  const clearUnread = useCallback((threadId: string) => {
    setUnreadThreadIds((current) => {
      if (!current.has(threadId)) return current;
      const next = new Set(current);
      next.delete(threadId);
      return next;
    });
  }, []);

  const selectTab = useCallback(
    (leafId: string) => {
      const leaf = findLeaf(layout.root, leafId);
      if (leaf) clearUnread(leaf.threadId);
      setFocusedLeafId(leafId);
      selectWorkspaceScreen();
    },
    [layout.root, clearUnread, setFocusedLeafId, selectWorkspaceScreen],
  );

  const handleAddTab = useCallback(() => {
    expandLayout(true);
    selectWorkspaceScreen();
  }, [expandLayout, selectWorkspaceScreen]);

  const handleCloseTab = useCallback(
    (leafId: string) => {
      const leaf = findLeaf(layout.root, leafId);
      if (leaf) {
        setUnreadThreadIds((current) => {
          if (!current.has(leaf.threadId)) return current;
          const next = new Set(current);
          next.delete(leaf.threadId);
          return next;
        });
        if (renamingThreadId === leaf.threadId) {
          setRenamingThreadId(null);
        }
      }
      closeLeaf(leafId);
    },
    [layout.root, closeLeaf, renamingThreadId],
  );

  const requestCloseTab = useCallback(
    async (leafId: string) => {
      const leaf = findLeaf(layout.root, leafId);
      if (!leaf) return;
      const index = orderedLeaves.findIndex((l) => l.id === leafId);
      const thread = threadById.get(leaf.threadId);
      const title = thread
        ? threadDisplayTitle(thread, index)
        : `Agent ${index + 1}`;
      const isLoading =
        responseLoading?.chatId === activeChatId &&
        responseLoading.threadId === leaf.threadId;
      if (isLoading) {
        const ok = await confirmCloseWorkingThread(title);
        if (!ok) return;
      }
      handleCloseTab(leafId);
    },
    [
      layout.root,
      orderedLeaves,
      threadById,
      responseLoading,
      activeChatId,
      handleCloseTab,
    ],
  );

  const focusActiveTab = useCallback(() => {
    const host = tabsRef.current;
    if (!host) return;
    const button = host.querySelector<HTMLButtonElement>(
      `[data-agent-tab-leaf-id="${CSS.escape(focusedLeafId)}"] button`,
    );
    button?.focus();
  }, [focusedLeafId]);

  useEffect(() => {
    return registerFocusWorkspaceAgentTabs(focusActiveTab);
  }, [registerFocusWorkspaceAgentTabs, focusActiveTab]);

  const reorderAgentTabs = useCallback(
    (sourceLeafId: string, targetLeafId: string, side: DropSide) => {
      setOrderedLeafIds((prev) =>
        reorderIdListByPlacement(prev, sourceLeafId, targetLeafId, side),
      );
    },
    [],
  );

  const handleAgentTabDragStart = useCallback((leafId: string, e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leafId);
    setDragLeafId(leafId);
  }, [setDragLeafId]);

  const handleAgentTabDrop = useCallback(
    (targetLeafId: string, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const sourceLeafId = e.dataTransfer.getData("text/plain");
      if (!sourceLeafId) return;
      const side =
        dropHint?.targetLeafId === targetLeafId
          ? dropHint.side
          : dropSideFromPointer(e);
      reorderAgentTabs(sourceLeafId, targetLeafId, side);
      setDragLeafId(null);
      setDropHint(null);
    },
    [dropHint, reorderAgentTabs, setDragLeafId],
  );

  return (
    <div
      ref={tabsRef}
      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
    >
        {orderedLeaves.map((leaf, index) => {
          const isActive = leaf.id === focusedLeafId;
          const thread = threadById.get(leaf.threadId);
          const isLoading =
            responseLoading?.chatId === activeChatId &&
            responseLoading.threadId === leaf.threadId;
          const hasUnread =
            !isActive && !isLoading && unreadThreadIds.has(leaf.threadId);
          return (
            <ChatThreadTab
              key={leaf.id}
              leaf={leaf}
              index={index}
              thread={thread}
              isActive={isActive}
              isLoading={isLoading}
              hasUnread={hasUnread}
              paneCount={paneCount}
              isRenaming={renamingThreadId === leaf.threadId}
              onSelect={() => selectTab(leaf.id)}
              onRequestClose={() => void requestCloseTab(leaf.id)}
              onStartRename={() => setRenamingThreadId(leaf.threadId)}
              onFinishRename={() => setRenamingThreadId(null)}
              onForceKill={() => forceKillThread(leaf.threadId)}
              draggable
              onDragStart={(e) => handleAgentTabDragStart(leaf.id, e)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (!dragLeafId || dragLeafId === leaf.id) {
                  setDropHint(null);
                  return;
                }
                setDropHint({
                  targetLeafId: leaf.id,
                  side: dropSideFromPointer(e),
                });
              }}
              onDrop={(e) => handleAgentTabDrop(leaf.id, e)}
              onDragLeave={(e) => {
                const related = e.relatedTarget as Node | null;
                if (related && e.currentTarget.contains(related)) return;
                setDropHint((prev) =>
                  prev?.targetLeafId === leaf.id ? null : prev,
                );
              }}
              onDragEnd={() => {
                setDragLeafId(null);
                setDropHint(null);
              }}
              isDragging={dragLeafId === leaf.id}
              dropIndicatorSide={
                dropHint?.targetLeafId === leaf.id ? dropHint.side : null
              }
            />
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground h-6 w-6 shrink-0 rounded-md"
          title={
            paneCount >= maxPanes
              ? "Remove active agents before opening more"
              : "New agent"
          }
          aria-label="New agent"
          disabled={paneCount >= maxPanes}
          onClick={handleAddTab}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
    </div>
  );
}

export function WorkspaceAgentTabs() {
  return <ChatThreadTabs />;
}

export function RecursiveSplitWorkspace() {
  const {
    layout,
    focusedLeafId,
    splitOrientation,
    visibleLeafIds,
    setVisibleLeafIds,
    dragLeafId,
    setDragLeafId,
    setFocusedLeafId,
  } = useWorkspacePanes();

  const leaves = useMemo(() => collectLeaves(layout.root), [layout.root]);
  const leafById = useMemo(() => {
    return new Map(leaves.map((leaf) => [leaf.id, leaf]));
  }, [leaves]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <SplitPaneGroup
          visiblePaneIds={visibleLeafIds}
          draggingPaneId={dragLeafId}
          orientation={splitOrientation}
          onDropComplete={(nextVisibleLeafIds) => {
            setVisibleLeafIds(nextVisibleLeafIds);
            if (dragLeafId && nextVisibleLeafIds.includes(dragLeafId)) {
              setFocusedLeafId(dragLeafId);
            }
            setDragLeafId(null);
          }}
          renderPane={(leafId) => {
            const leaf = leafById.get(leafId);
            if (!leaf) return null;
            return <LeafPane key={leaf.id} leaf={leaf} isActive={leaf.id === focusedLeafId} />;
          }}
        />
      </div>
    </div>
  );
}
