import { useState } from "react";

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

  const [editingProjects, setEditingProjects] = useState(false);



  return (
    <SidebarPanel active={active} className="min-h-0">
      {error && (
        <div className="mx-2 mt-2 flex shrink-0 items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
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
      <ProjectsHeader
        onAdd={addProject}
        editingProjects={editingProjects}
        onEditingProjectsChange={setEditingProjects}
      />
      <ScrollArea className="min-h-0 flex-1" data-projects-panel>
        <ProjectTree projects={projects} editingProjects={editingProjects} />
      </ScrollArea>
    </SidebarPanel>
  );

}


