import { ResizablePanels, ResizableSidebar } from "@/components/ui/resizable-panels";
import { AgentCartPanel } from "@/components/layout/AgentCartPanel";
import { ChatHistoryPanel } from "@/components/layout/ChatHistoryPanel";
import { GitPanel } from "@/components/layout/GitPanel";
import { ProjectsPanel } from "@/components/layout/ProjectsPanel";
import type { SidebarView } from "@/components/layout/ActivityBar";

interface LeftSidebarProps {
  activeSection: SidebarView;
}

export function LeftSidebar({ activeSection }: LeftSidebarProps) {
  const isExplorer = activeSection === "explorer";
  const isGit = activeSection === "git";
  const isAgents = activeSection === "agents";

  return (
    <ResizableSidebar
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
      ) : isGit ? (
        <section key="git" className="flex min-h-0 flex-1 flex-col">
          <GitPanel active />
        </section>
      ) : isAgents ? (
        <section key="agents" className="flex min-h-0 flex-1 flex-col">
          <AgentCartPanel active />
        </section>
      ) : null}
    </ResizableSidebar>
  );
}
