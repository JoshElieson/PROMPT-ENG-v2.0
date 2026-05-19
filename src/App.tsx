import { useState } from "react";
import { ActivityBar, type SidebarView } from "@/components/layout/ActivityBar";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { MainWorkspace } from "@/components/layout/MainWorkspace";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { RoundTableProvider } from "@/context/RoundTableContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";

function App() {
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");

  return (
    <RoundTableProvider>
      <ProjectsProvider>
      <section className="flex h-full w-full flex-col">
        <section className="flex min-h-0 flex-1">
          <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />
          <LeftSidebar view={sidebarView} />
          <MainWorkspace />
          <RightSidebar />
        </section>
        <StatusBar />
      </section>
      </ProjectsProvider>
    </RoundTableProvider>
  );
}

export default App;
