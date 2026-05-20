import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { ProjectTree, ProjectsHeader } from "@/components/projects/ProjectTree";
import { useProjects } from "@/contexts/ProjectsContext";

interface ProjectsPanelProps {
  active?: boolean;
}

export function ProjectsPanel({ active }: ProjectsPanelProps) {
  const { projects, addProject, error, clearError } = useProjects();

  return (
    <SidebarPanel active={active}>
      <ScrollArea className="h-full">
        {error && (
          <div className="mx-2 mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
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
    </SidebarPanel>
  );
}
