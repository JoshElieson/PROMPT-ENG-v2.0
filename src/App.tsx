import { ActivityBar } from "@/components/layout/ActivityBar";
import { EditContextMenu } from "@/components/layout/EditContextMenu";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MainWorkspace } from "@/components/layout/MainWorkspace";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { AppSelectionProvider } from "@/contexts/AppSelectionContext";
import { ApiUsageProvider } from "@/contexts/ApiUsageContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { FocusedWorkspacePaneRoundTableProvider } from "@/contexts/FocusedWorkspacePaneRoundTableProvider";
import { ModelModeProvider } from "@/contexts/ModelModeContext";
import { RoundTableProvider } from "@/contexts/RoundTableContext";
import { GitProvider } from "@/contexts/GitContext";
import { GoogleOAuthCallback } from "@/components/auth/GoogleOAuthCallback";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserXpProvider } from "@/contexts/UserXpContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { LayoutProvider, useLayout } from "@/contexts/LayoutContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { AiCommandBusProvider } from "@/contexts/AiCommandBusContext";
import { AppToastProvider } from "@/contexts/AppToastContext";

function AppShell() {
  const { sidebarView, setSidebarView, settingsOpen } = useLayout();

  if (settingsOpen) {
    return (
      <section className="bg-background flex h-full w-full overflow-hidden border-0 ring-0 outline-none">
        <SettingsPage />
      </section>
    );
  }

  return (
    <section className="bg-background flex h-full w-full flex-col overflow-hidden border-0 ring-0 outline-none">
      <TitleBar />
      <section className="flex min-h-0 flex-1">
        <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />
        <>
          <LeftSidebar activeSection={sidebarView} />
          <MainWorkspace />
        </>
      </section>
      <StatusBar />
    </section>
  );
}

function App() {
  if (window.location.pathname === "/oauth/google/callback") {
    return <GoogleOAuthCallback />;
  }

  return (
    <AuthProvider>
      <UserXpProvider>
        <LayoutProvider>
          <RoundTableProvider>
            <ModelModeProvider>
              <AppSettingsProvider>
                <AppToastProvider>
                  <AiCommandBusProvider>
                    <ApiUsageProvider>
                      <ChatsProvider>
                        <ProjectsProvider>
                          <FocusedWorkspacePaneRoundTableProvider>
                            <AppSelectionProvider>
                              <GitProvider>
                                <TooltipProvider delayDuration={200}>
                                  <AppShell />
                                  <EditContextMenu />
                                </TooltipProvider>
                              </GitProvider>
                            </AppSelectionProvider>
                          </FocusedWorkspacePaneRoundTableProvider>
                        </ProjectsProvider>
                      </ChatsProvider>
                    </ApiUsageProvider>
                  </AiCommandBusProvider>
                </AppToastProvider>
              </AppSettingsProvider>
            </ModelModeProvider>
          </RoundTableProvider>
        </LayoutProvider>
      </UserXpProvider>
    </AuthProvider>
  );
}

export default App;
