import { ActivityBar } from "@/components/layout/ActivityBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MainWorkspace } from "@/components/layout/MainWorkspace";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { AppSelectionProvider } from "@/contexts/AppSelectionContext";
import { ApiUsageProvider } from "@/contexts/ApiUsageContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { FocusedWorkspacePaneRoundTableProvider } from "@/contexts/FocusedWorkspacePaneRoundTableProvider";
import { ModelModeProvider } from "@/contexts/ModelModeContext";
import { RoundTableProvider } from "@/contexts/RoundTableContext";
import { GitProvider } from "@/contexts/GitContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserXpProvider } from "@/contexts/UserXpContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";
import { TooltipProvider } from "@/components/ui/tooltip";

function AppShell() {
  const { sidebarView, setSidebarView } = useLayout();

  return (
    <section className="bg-background flex h-full w-full flex-col overflow-hidden border-0 ring-0 outline-none">
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
      <UserXpProvider>
      <LayoutProvider>
        <RoundTableProvider>
          <ModelModeProvider>
          <ApiUsageProvider>
          <ChatsProvider>
            <ProjectsProvider>
              <FocusedWorkspacePaneRoundTableProvider>
                <AppSelectionProvider>
                  <GitProvider>
                    <TooltipProvider delayDuration={200}>
                      <AppShell />
                    </TooltipProvider>
                  </GitProvider>
                </AppSelectionProvider>
              </FocusedWorkspacePaneRoundTableProvider>
            </ProjectsProvider>
          </ChatsProvider>
          </ApiUsageProvider>
          </ModelModeProvider>
        </RoundTableProvider>
      </LayoutProvider>
      </UserXpProvider>
    </AuthProvider>
  );
}

export default App;
