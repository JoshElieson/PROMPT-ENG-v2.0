import { ResizablePanels, ResizableSidebar } from "@/components/ui/resizable-panels";
import { AgentCartPanel } from "@/components/layout/AgentCartPanel";
import { ChatHistoryPanel } from "@/components/layout/ChatHistoryPanel";
import { ProjectsPanel } from "@/components/layout/ProjectsPanel";
import type { SidebarView } from "@/components/layout/ActivityBar";

interface LeftSidebarProps {
  activeSection: SidebarView;
}

export function LeftSidebar({ activeSection }: LeftSidebarProps) {
  const isExplorer = activeSection === "explorer";

  return (
    <ResizableSidebar
      side="left"
      defaultWidth={224}
      minWidth={200}
      maxWidth={420}
      storageKey="prompt:left-sidebar-width"
      className="min-h-0"
    >
      {isExplorer ? (
        <ResizablePanels
          key="explorer"
          direction="vertical"
          storageKey="prompt:left-panels-explorer"
          defaultSizes={[0.55, 0.45]}
          className="min-h-0 flex-1"
          panels={[
            {
              id: "chats",
              minSize: 72,
              content: <ChatHistoryPanel active />,
            },
            {
              id: "projects",
              minSize: 64,
              content: <ProjectsPanel active />,
            },
          ]}
        />
      ) : (
        <section key="agents" className="flex min-h-0 flex-1 flex-col">
          <AgentCartPanel active />
        </section>
      )}

      <footer className="shrink-0 border-t border-border-subtle px-3 py-2">
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">Claude 3.5</span>
          <span className="mx-1 text-muted">·</span>
          <span className="text-muted">⌘ 2 to switch</span>
        </p>
      </footer>
    </ResizableSidebar>
  );
}
