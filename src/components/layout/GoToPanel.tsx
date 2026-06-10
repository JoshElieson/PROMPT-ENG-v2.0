import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Bot, FolderClosed, Search } from "lucide-react";
import { defaultThreadTitle, sortWorkspaces } from "@/lib/chat-utils";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useChats } from "@/contexts/ChatsContext";
import { useGoToRecents } from "@/hooks/use-go-to-recents";
import { cn } from "@/lib/utils";

export type GoToPanelKind = "agent" | "project";

interface GoToPanelProps {
  kind: GoToPanelKind;
  /** Screen rect of the menu item the panel anchors to. */
  anchor: DOMRect;
  onClose: () => void;
}

interface GoToRow {
  key: string;
  label: string;
  detail?: string;
  badge: { kind: "icon-agent" | "icon-project" };
  onSelect: () => void;
}

interface GoToSection {
  id: string;
  title: string;
  rows: GoToRow[];
}

const PANEL_WIDTH = 300;
const MAX_PANEL_HEIGHT = 380;
const ANCHOR_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MAX_RECENT_ROWS = 6;

function matchesQuery(haystacks: string[], query: string): boolean {
  if (!query) return true;
  return haystacks.some((value) => value.toLowerCase().includes(query));
}

/** Order ids by explicit recents first, then the natural fallback order. */
function orderByRecents<T>(
  items: T[],
  getId: (item: T) => string,
  recentIds: string[],
): T[] {
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ra = recentRank.get(getId(a));
    const rb = recentRank.get(getId(b));
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return 0;
  });
}

export function GoToPanel({ kind, anchor, onClose }: GoToPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number }>(() => ({
    top: anchor.top,
    left: anchor.right + ANCHOR_GAP,
  }));

  const { chats, activeChatId, selectAgent, selectChat } = useChats();
  const { selectWorkspaceScreen } = useAppSelection();
  const { recents, recordRecent } = useGoToRecents();

  const q = query.trim().toLowerCase();

  const agentSections = useMemo<GoToSection[]>(() => {
    const agents = sortWorkspaces(chats).flatMap((chat) => {
      const project = chat.title?.trim() || "New Chat";
      return chat.threads.map((thread, index) => ({
        chatId: chat.id,
        threadId: thread.id,
        label: defaultThreadTitle(index),
        project,
      }));
    });
    const recentRows: GoToRow[] = orderByRecents(
      agents,
      (agent) => agent.threadId,
      recents.agent,
    )
      .filter((agent) => matchesQuery([agent.label, agent.project], q))
      .slice(0, MAX_RECENT_ROWS)
      .map((agent) => ({
        key: `agent:${agent.threadId}`,
        label: agent.label,
        detail: agent.project,
        badge: { kind: "icon-agent" },
        onSelect: () => {
          recordRecent("agent", agent.threadId);
          selectAgent(agent.chatId, agent.threadId);
          selectWorkspaceScreen();
          onClose();
        },
      }));

    return [{ id: "recent-agents", title: "Recent Agents", rows: recentRows }].filter(
      (section) => section.rows.length > 0,
    );
  }, [
    chats,
    recents.agent,
    q,
    selectAgent,
    selectWorkspaceScreen,
    recordRecent,
    onClose,
  ]);

  const projectSections = useMemo<GoToSection[]>(() => {
    const workspaceRows = sortWorkspaces(chats).map((chat) => ({
      id: chat.id,
      name: chat.title?.trim() || "New Project",
    }));
    const buildRow = (
      sectionId: string,
      project: { id: string; name: string },
    ): GoToRow => ({
      key: `${sectionId}:${project.id}`,
      label: project.name,
      detail: project.id === activeChatId ? "Active" : undefined,
      badge: { kind: "icon-project" },
      onSelect: () => {
        recordRecent("project", project.id);
        selectChat(project.id);
        selectWorkspaceScreen();
        onClose();
      },
    });

    const filtered = workspaceRows.filter((project) =>
      matchesQuery([project.name], q),
    );
    const projectFromRecent = (recent: string) =>
      filtered.find((project) => project.id === recent);
    const recentProjects = Array.from(
      new Map(
        recents.project
          .map((recent) => projectFromRecent(recent))
          .filter((project): project is NonNullable<typeof project> =>
            Boolean(project),
          )
          .map((project) => [project.id, project]),
      ).values(),
    );
    const recentRows = recentProjects
      .slice(0, MAX_RECENT_ROWS)
      .map((project) => buildRow("recent-project", project));
    const allRows = filtered.map((project) => buildRow("project", project));

    return [
      { id: "recent-projects", title: "Recent Projects", rows: recentRows },
      { id: "all-projects", title: "All Projects", rows: allRows },
    ].filter((section) => section.rows.length > 0);
  }, [
    chats,
    activeChatId,
    recents.project,
    q,
    selectChat,
    selectWorkspaceScreen,
    recordRecent,
    onClose,
  ]);

  const sections = kind === "agent" ? agentSections : projectSections;
  const flatRows = useMemo(
    () => sections.flatMap((section) => section.rows),
    [sections],
  );

  useEffect(() => {
    setHighlight(0);
  }, [kind, q]);

  useEffect(() => {
    setHighlight((prev) => {
      if (flatRows.length === 0) return 0;
      return Math.min(prev, flatRows.length - 1);
    });
  }, [flatRows.length]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const height = Math.min(panel?.offsetHeight ?? MAX_PANEL_HEIGHT, MAX_PANEL_HEIGHT);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchor.right + ANCHOR_GAP;
    if (left + PANEL_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
      left = anchor.left - PANEL_WIDTH - ANCHOR_GAP;
    }
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN));

    let top = anchor.top;
    if (top + height > viewportHeight - VIEWPORT_MARGIN) {
      top = viewportHeight - height - VIEWPORT_MARGIN;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    setPosition({ top, left });
  }, [anchor, sections.length, flatRows.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  useEffect(() => {
    const row = panelRef.current?.querySelector<HTMLElement>(
      `[data-go-row="${highlight}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (flatRows.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((prev) => (prev + 1) % flatRows.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((prev) => (prev - 1 + flatRows.length) % flatRows.length);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        flatRows[highlight]?.onSelect();
      }
    },
    [flatRows, highlight, onClose],
  );

  let rowCursor = -1;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      data-go-to-panel=""
      aria-label={kind === "agent" ? "Go to Agent" : "Go to Project"}
      className={cn(
        "fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-panel/95 text-foreground shadow-elevated backdrop-blur-md",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        top: position.top,
        left: position.left,
        width: PANEL_WIDTH,
        maxHeight: MAX_PANEL_HEIGHT,
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={kind === "agent" ? "Search agents" : "Search projects"}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {flatRows.length === 0 ? (
          <p className="px-2.5 py-3 text-[12px] text-muted">No matches found.</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted">
                {section.title}
              </p>
              {section.rows.map((row) => {
                rowCursor += 1;
                const index = rowCursor;
                const active = index === highlight;
                return (
                  <button
                    key={row.key}
                    type="button"
                    data-go-row={index}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] outline-none transition-colors duration-150",
                      active
                        ? "bg-menu-hover text-foreground"
                        : "text-foreground/90 hover:bg-menu-hover",
                    )}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={row.onSelect}
                  >
                    <RowBadge badge={row.badge} />
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    {row.detail && (
                      <span className="ml-auto max-w-[42%] shrink-0 truncate pl-2 text-[11px] text-muted">
                        {row.detail}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

function RowBadge({ badge }: { badge: GoToRow["badge"] }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-panel-elevated text-muted">
      {badge.kind === "icon-agent" ? (
        <Bot className="h-3.5 w-3.5" />
      ) : (
        <FolderClosed className="h-3.5 w-3.5" />
      )}
    </span>
  );
}
