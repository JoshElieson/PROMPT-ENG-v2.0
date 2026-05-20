import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { X } from "lucide-react";
import { ForgeWordmark } from "@/components/brand/ForgeWordmark";
import { ActiveModelsBar } from "@/components/chat/ActiveModelsBar";
import { ChatComposer, type ChatComposerHandle } from "@/components/chat/ChatComposer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ResponseLoadingView } from "@/components/chat/ResponseLoadingView";
import { Button } from "@/components/ui/button";
import { ResizablePanels } from "@/components/ui/resizable-panels";
import { PaneRoundTableProvider } from "@/contexts/PaneRoundTableContext";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useChats } from "@/contexts/ChatsContext";
import { useWorkspacePanes } from "@/contexts/WorkspacePanesContext";
import { buildModelKeyboardShortcuts } from "@/data/mock";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import {
  adjacentLeafByArrow,
  type ArrowNavigationKey,
} from "@/lib/workspace-pane-arrows";
import { cn } from "@/lib/utils";
import type { CenterWorkspaceRoot, WorkspaceLeafNode } from "@/types/workspace-pane";

const SLOGAN_SENTENCES = [
  "One prompt.",
  "Multiple models.",
  "Better answers.",
] as const;

const SLOGAN_REVEAL_MS = 1000;

function WelcomePane({
  keyboardShortcuts,
}: {
  keyboardShortcuts: { keys: string; label: string }[];
}) {
  const [sloganVisibleCount, setSloganVisibleCount] = useState(0);

  useEffect(() => {
    setSloganVisibleCount(0);
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
      <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        Welcome to <ForgeWordmark height={36} className="translate-y-px" />
      </h1>
      <p className="mt-2 w-full text-center text-muted-foreground">
        {SLOGAN_SENTENCES.map((sentence, index) => (
          <span
            key={sentence}
            className={cn(
              "transition-opacity duration-500",
              index < sloganVisibleCount ? "opacity-100" : "opacity-0",
              index === SLOGAN_SENTENCES.length - 1 && "text-accent/90",
            )}
          >
            {sentence}
            {index < SLOGAN_SENTENCES.length - 1 ? " " : ""}
          </span>
        ))}
      </p>

      <section className="mt-8 rounded-xl border border-border bg-panel/80 p-4 backdrop-blur-sm">
        <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {keyboardShortcuts.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center gap-3">
              <kbd className="min-w-[3rem] rounded border border-border bg-surface px-2 py-0.5 text-center text-xs font-medium text-muted-foreground">
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

function ChatPaneBody({
  leaf,
  isFocused,
  onFocus,
}: {
  leaf: WorkspaceLeafNode;
  isFocused: boolean;
  onFocus: () => void;
}) {
  const { chats, activeChatId, responseLoading } = useChats();
  const {
    isWorkspaceScreenSelected,
    selectWorkspaceScreen,
    registerFocusComposer,
    registerFocusWorkspaceScreen,
  } = useAppSelection();
  const { onLeafScrollChange, paneCount, closeLeaf } = useWorkspacePanes();

  const closePaneTrailing = useMemo(
    () =>
      paneCount > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-zinc-700 hover:text-foreground"
          title="Close this pane (removes this thread)"
          aria-label="Close pane"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            closeLeaf(leaf.id);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null,
    [paneCount, closeLeaf, leaf.id],
  );

  const messages = useMemo(() => {
    if (!activeChatId) return [];
    const chat = chats.find((c) => c.id === activeChatId);
    const thread = chat?.threads.find((t) => t.id === leaf.threadId);
    return thread?.messages ?? [];
  }, [chats, activeChatId, leaf.threadId]);

  const showWelcome = messages.length === 0 && paneCount <= 1;

  const loadingForPane =
    responseLoading?.chatId === activeChatId &&
    responseLoading.threadId === leaf.threadId
      ? responseLoading
      : null;

  /** With 2+ panes, only the focused pane is scrollable; mouse wheel is disabled on all panes while split. */
  const messageAreaScrollable = paneCount <= 1 || isFocused;

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

  useEffect(() => {
    if (loadingForPane) scrollToEnd();
  }, [loadingForPane, scrollToEnd]);

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

  useEffect(() => {
    if (!isFocused) return;
    return registerFocusComposer(() => composerRef.current?.focus());
  }, [isFocused, registerFocusComposer]);

  useEffect(() => {
    if (!isFocused) return;
    return registerFocusWorkspaceScreen(() => {
      scrollElRef.current?.focus();
    });
  }, [isFocused, registerFocusWorkspaceScreen]);

  const handlePaneMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onFocus();
      const target = e.target as HTMLElement;
      if (
        target.closest(
          "button, a, textarea, input, select, [contenteditable='true'], footer",
        )
      ) {
        return;
      }
      selectWorkspaceScreen();
      e.currentTarget.focus();
    },
    [onFocus, selectWorkspaceScreen],
  );

  useEffect(() => {
    if (!isFocused) return;

    const onKeyDownCapture = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.isComposing) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const pane = paneRef.current;
      if (!pane) return;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (!pane.contains(active)) return;

      if (active.closest("button, a, input, select, [contenteditable='true']")) {
        return;
      }

      const textarea = pane.querySelector<HTMLTextAreaElement>(
        "[data-composer-textarea]",
      );
      if (!textarea) return;
      if (active === textarea) return;

      e.preventDefault();
      e.stopPropagation();
      composerRef.current?.appendText(e.key);
    };

    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, [isFocused]);

  return (
    <div
      ref={paneRef}
      role="region"
      aria-label="Chat pane"
      data-pane-leaf-id={leaf.id}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col bg-background outline-none",
        isFocused && "ring-1 ring-inset ring-accent/35",
      )}
      tabIndex={-1}
      onMouseDown={handlePaneMouseDown}
      onFocus={onFocus}
    >
      <div
        ref={scrollElRef}
        data-workspace-screen
        className={cn(
          "relative min-h-0 flex-1 outline-none",
          messageAreaScrollable ? "overflow-y-auto" : "overflow-y-hidden",
          isWorkspaceScreenSelected &&
            isFocused &&
            "ring-1 ring-inset ring-accent/35",
        )}
        tabIndex={-1}
        onMouseDown={(e) => {
          if (
            (e.target as HTMLElement).closest(
              "button, a, textarea, input, select",
            )
          ) {
            return;
          }
          onFocus();
          selectWorkspaceScreen();
          e.currentTarget.focus();
        }}
        onWheel={
          paneCount > 1
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
              }
            : undefined
        }
        onScroll={(e) => scheduleScrollPersist(e.currentTarget.scrollTop)}
      >
        <ActiveModelsBar
          overlay
          showLayoutMenu={false}
          trailing={closePaneTrailing}
        />

        {showWelcome && (
          <WelcomePane keyboardShortcuts={keyboardShortcuts} />
        )}

        {messages.length > 0 && (
          <section className="mx-auto max-w-2xl space-y-4 px-6 py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {loadingForPane && (
              <ResponseLoadingView loading={loadingForPane} />
            )}

            <div aria-hidden className="h-px" />
          </section>
        )}
      </div>

      <ChatComposer
        ref={composerRef}
        chatId={activeChatId!}
        threadId={leaf.threadId}
        onSent={scrollToEnd}
      />
    </div>
  );
}

function LeafPane({
  leaf,
  isFocused,
  onFocus,
}: {
  leaf: WorkspaceLeafNode;
  isFocused: boolean;
  onFocus: () => void;
}) {
  const { onLeafModelsChange } = useWorkspacePanes();

  return (
    <PaneRoundTableProvider
      session={leaf.models}
      onSessionChange={(next) => onLeafModelsChange(leaf.id, next)}
    >
      <ChatPaneBody leaf={leaf} isFocused={isFocused} onFocus={onFocus} />
    </PaneRoundTableProvider>
  );
}

function WorkspacePaneArrowKeys({ root }: { root: CenterWorkspaceRoot }) {
  const { paneCount, focusedLeafId, setFocusedLeafId } = useWorkspacePanes();
  const { isWorkspaceScreenSelected } = useAppSelection();

  useEffect(() => {
    if (paneCount <= 1) return;

    const handler = (e: globalThis.KeyboardEvent) => {
      const k = e.key;
      if (
        k !== "ArrowUp" &&
        k !== "ArrowDown" &&
        k !== "ArrowLeft" &&
        k !== "ArrowRight"
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!isWorkspaceScreenSelected) return;

      const target = e.target;
      if (target instanceof Element) {
        if (target.closest("[data-composer-textarea]")) return;
      }

      const splitHost = document.querySelector("[data-workspace-split-host]");
      if (
        !splitHost ||
        !(target instanceof Node) ||
        !splitHost.contains(target)
      ) {
        return;
      }

      const nextId = adjacentLeafByArrow(
        root,
        focusedLeafId,
        k as ArrowNavigationKey,
      );
      if (!nextId || nextId === focusedLeafId) return;

      e.preventDefault();
      e.stopPropagation();
      setFocusedLeafId(nextId);
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [paneCount, root, focusedLeafId, setFocusedLeafId, isWorkspaceScreenSelected]);

  return null;
}

function CenterLayoutRenderer({ root }: { root: CenterWorkspaceRoot }) {
  const { focusedLeafId, setFocusedLeafId } = useWorkspacePanes();

  const wrap = (leaf: WorkspaceLeafNode) => (
    <LeafPane
      key={leaf.id}
      leaf={leaf}
      isFocused={leaf.id === focusedLeafId}
      onFocus={() => setFocusedLeafId(leaf.id)}
    />
  );

  switch (root.kind) {
    case "single":
      return wrap(root.leaf);
    case "double":
      return (
        <ResizablePanels
          direction={root.direction}
          defaultSizes={[...root.sizes]}
          className="min-h-0 min-w-0 flex-1"
          sizes={[...root.sizes]}
          resizable={false}
          panels={[
            {
              id: "d0",
              minSize: 120,
              content: wrap(root.first),
            },
            {
              id: "d1",
              minSize: 120,
              content: wrap(root.second),
            },
          ]}
        />
      );
    case "triple":
      return (
        <ResizablePanels
          direction="vertical"
          defaultSizes={[...root.verticalSizes]}
          className="min-h-0 min-w-0 flex-1"
          sizes={[...root.verticalSizes]}
          resizable={false}
          panels={[
            {
              id: "t-top",
              minSize: 96,
              content: (
                <ResizablePanels
                  direction="horizontal"
                  defaultSizes={[...root.topHorizontalSizes]}
                  className="min-h-0 min-w-0 flex-1"
                  sizes={[...root.topHorizontalSizes]}
                  resizable={false}
                  panels={[
                    {
                      id: "tl",
                      minSize: 120,
                      content: wrap(root.topLeft),
                    },
                    {
                      id: "tr",
                      minSize: 120,
                      content: wrap(root.topRight),
                    },
                  ]}
                />
              ),
            },
            {
              id: "t-bottom",
              minSize: 120,
              content: wrap(root.bottom),
            },
          ]}
        />
      );
    case "quad":
      return (
        <ResizablePanels
          direction="vertical"
          defaultSizes={[...root.verticalSizes]}
          className="min-h-0 min-w-0 flex-1"
          sizes={[...root.verticalSizes]}
          resizable={false}
          panels={[
            {
              id: "q-top",
              minSize: 96,
              content: (
                <ResizablePanels
                  direction="horizontal"
                  defaultSizes={[...root.topHorizontalSizes]}
                  className="min-h-0 min-w-0 flex-1"
                  sizes={[...root.topHorizontalSizes]}
                  resizable={false}
                  panels={[
                    {
                      id: "qtl",
                      minSize: 120,
                      content: wrap(root.topLeft),
                    },
                    {
                      id: "qtr",
                      minSize: 120,
                      content: wrap(root.topRight),
                    },
                  ]}
                />
              ),
            },
            {
              id: "q-bottom",
              minSize: 96,
              content: (
                <ResizablePanels
                  direction="horizontal"
                  defaultSizes={[...root.bottomHorizontalSizes]}
                  className="min-h-0 min-w-0 flex-1"
                  sizes={[...root.bottomHorizontalSizes]}
                  resizable={false}
                  panels={[
                    {
                      id: "qbl",
                      minSize: 120,
                      content: wrap(root.bottomLeft),
                    },
                    {
                      id: "qbr",
                      minSize: 120,
                      content: wrap(root.bottomRight),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      );
    default:
      return null;
  }
}

export function RecursiveSplitWorkspace() {
  const { layout } = useWorkspacePanes();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <WorkspacePaneArrowKeys root={layout.root} />
      <CenterLayoutRenderer root={layout.root} />
    </div>
  );
}
