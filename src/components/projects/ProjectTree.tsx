import { useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  Trash2,
} from "lucide-react";
import { listDirectory } from "@/lib/fs";
import { useProjects } from "@/contexts/ProjectsContext";
import { AccessCheckbox } from "@/components/projects/PermissionToggles";
import type { FsEntry, Project } from "@/types/project";
import { cn } from "@/lib/utils";

interface ProjectTreeProps {
  projects: Project[];
}

function FsTreeNode({
  entry,
  depth,
  onRemoveProject,
  projectId,
}: {
  entry: FsEntry;
  depth: number;
  onRemoveProject?: () => void;
  projectId?: string;
}) {
  const { getPermissions, setPermissions, removeProject } = useProjects();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FsEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const permissions = getPermissions(entry.path);
  const isRoot = depth === 0;

  const handleToggle = useCallback(async () => {
    if (!entry.isDirectory) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (children !== null) return;

    setLoading(true);
    setLoadError(null);
    try {
      const entries = await listDirectory(entry.path);
      setChildren(entries);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load folder");
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [entry.isDirectory, entry.path, expanded, children]);

  const handleAccessChange = (enabled: boolean) => {
    setPermissions(entry.path, { enabled });
  };

  return (
    <section>
      <section
        className="group flex items-center gap-0.5 rounded-md py-0.5 pr-1 text-sm text-muted-foreground hover:bg-panel-elevated hover:text-foreground"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {entry.isDirectory ? (
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={loading}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {entry.isDirectory ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted" />
          )
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-muted" />
        )}

        <span className="min-w-0 flex-1 truncate" title={entry.path}>
          {entry.name}
        </span>

        <AccessCheckbox
          enabled={permissions.enabled}
          onChange={handleAccessChange}
        />

        {isRoot && projectId && onRemoveProject && (
          <button
            type="button"
            title="Remove project"
            onClick={(e) => {
              e.stopPropagation();
              removeProject(projectId);
            }}
            className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </section>

      {loadError && expanded && (
        <p
          className="text-[10px] text-red-400"
          style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
        >
          {loadError}
        </p>
      )}

      {expanded && children && children.length > 0 && (
        <section>
          {children.map((child) => (
            <FsTreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </section>
      )}

      {expanded && children && children.length === 0 && entry.isDirectory && (
        <p
          className="py-0.5 text-[10px] text-muted"
          style={{ paddingLeft: `${(depth + 1) * 12 + 20}px` }}
        >
          Empty folder
        </p>
      )}
    </section>
  );
}

function ProjectRoot({ project }: { project: Project }) {
  const rootEntry: FsEntry = {
    name: project.name,
    path: project.rootPath,
    isDirectory: true,
  };

  return (
    <FsTreeNode entry={rootEntry} depth={0} projectId={project.id} />
  );
}

export function ProjectTree({ projects }: ProjectTreeProps) {
  if (projects.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs leading-relaxed text-muted">
        No project folders yet.
        <br />
        Click <span className="text-muted-foreground">+</span> to add a directory
        from your computer.
      </p>
    );
  }

  return (
    <section className="space-y-1 pb-2">
      {projects.map((project) => (
        <ProjectRoot key={project.id} project={project} />
      ))}
    </section>
  );
}

export function ProjectsHeader({ onAdd }: { onAdd: () => void }) {
  const { isAdding } = useProjects();

  return (
    <section className="flex items-center justify-between px-3 py-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        Projects
      </span>
      <button
        type="button"
        title="Add folder from computer"
        disabled={isAdding}
        onClick={() => void onAdd()}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded text-muted-foreground",
          "hover:bg-panel-elevated hover:text-foreground disabled:opacity-50",
        )}
      >
        {isAdding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="text-base leading-none">+</span>
        )}
      </button>
    </section>
  );
}
