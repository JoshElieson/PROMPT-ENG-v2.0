import { ActivityBar } from "@/components/layout/ActivityBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MainWorkspace } from "@/components/layout/MainWorkspace";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { RoundTableProvider } from "@/context/RoundTableContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { GitProvider } from "@/contexts/GitContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";
import { TooltipProvider } from "@/components/ui/tooltip";

function AppShell() {
  const { sidebarView, setSidebarView } = useLayout();

  return (
      <section className="flex h-full w-full flex-col overflow-hidden border-0 bg-black outline-none ring-0">
        <TitleBar />
        <section className="flex min-h-0 flex-1">
          <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />
          <LeftSidebar activeSection={sidebarView} />
          <MainWorkspace />
          <RightSidebar />
        </section>
        <StatusBar />
      </section>
  );
}

function App() {
  return (
    <AuthProvider>
      <LayoutProvider>
        <RoundTableProvider>
          <ChatsProvider>
            <ProjectsProvider>
              <GitProvider>
                <TooltipProvider delayDuration={200}>
                  <AppShell />
                </TooltipProvider>
              </GitProvider>
            </ProjectsProvider>
          </ChatsProvider>
        </RoundTableProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}

export default App;
