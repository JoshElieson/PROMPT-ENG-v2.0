import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AgentCartPanel } from "@/components/layout/AgentCartPanel";
import { ProjectTree, ProjectsHeader } from "@/components/projects/ProjectTree";
import type { SidebarView } from "@/components/layout/ActivityBar";
import { useProjects } from "@/contexts/ProjectsContext";
import { chatHistory } from "@/data/mock";
import { cn } from "@/lib/utils";

function ChatListItem({
  title,
  time,
  active,
}: {
  title: string;
  time: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-panel-elevated",
        active && "bg-panel-elevated",
      )}
    >
      {active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      )}
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

function ExplorerPanel() {
  const { projects, addProject, error, clearError } = useProjects();

  return (
    <>
      <div className="p-3">
        <Button className="w-full justify-between" size="sm">
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </span>
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
            ⌘ N
          </kbd>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <SectionLabel>Today</SectionLabel>
        {chatHistory.today.map((chat) => (
          <ChatListItem
            key={chat.id}
            title={chat.title}
            time={chat.time}
            active={chat.active}
          />
        ))}

        <SectionLabel>Yesterday</SectionLabel>
        {chatHistory.yesterday.map((chat) => (
          <ChatListItem key={chat.id} title={chat.title} time={chat.time} />
        ))}

        <Separator className="my-3" />

        {error && (
          <div className="mx-2 mb-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            <span className="flex-1 leading-snug">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 rounded p-0.5 hover:bg-red-500/20"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <ProjectsHeader onAdd={addProject} />
        <ProjectTree projects={projects} />
      </ScrollArea>

      <div className="border-t border-border-subtle px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">Claude 3.5</span>
          <span className="mx-1 text-muted">·</span>
          <span className="text-muted">⌘ 2 to switch</span>
        </p>
      </div>
    </>
  );
}

interface LeftSidebarProps {
  view: SidebarView;
}

export function LeftSidebar({ view }: LeftSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border-subtle bg-panel">
      {view === "agents" ? <AgentCartPanel /> : <ExplorerPanel />}
    </aside>
  );
}
