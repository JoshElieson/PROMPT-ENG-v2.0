import { useState } from "react";
import { ActivityBar, type SidebarView } from "@/components/layout/ActivityBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MainWorkspace } from "@/components/layout/MainWorkspace";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { TitleBar } from "@/components/layout/TitleBar";
import { RoundTableProvider } from "@/context/RoundTableContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";

function App() {
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");

  return (
    <RoundTableProvider>
      <ChatsProvider>
      <ProjectsProvider>
      <section className="flex h-full w-full flex-col bg-black">
        <TitleBar />
        <section className="flex min-h-0 flex-1">
          <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />
          <LeftSidebar activeSection={sidebarView} />
          <MainWorkspace />
          <RightSidebar />
        </section>
        <StatusBar />
      </section>
      </ProjectsProvider>
      </ChatsProvider>
    </RoundTableProvider>
  );
}

export default App;
