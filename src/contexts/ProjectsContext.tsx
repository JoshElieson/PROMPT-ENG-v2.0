import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { basename, pickProjectDirectory } from "@/lib/fs";
import { loadPermissions, loadProjects, savePermissions, saveProjects } from "@/lib/storage";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_ROOT_PERMISSIONS,
  type NodePermissions,
  type Project,
} from "@/types/project";

interface ProjectsContextValue {
  projects: Project[];
  permissions: Record<string, NodePermissions>;
  isAdding: boolean;
  error: string | null;
  addProject: () => Promise<void>;
  removeProject: (id: string) => void;
  getPermissions: (path: string) => NodePermissions;
  setPermissions: (path: string, patch: Partial<NodePermissions>) => void;
  clearError: () => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [permissions, setPermissionsState] = useState<Record<string, NodePermissions>>(
    () => loadPermissions(),
  );
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    savePermissions(permissions);
  }, [permissions]);

  const getPermissions = useCallback(
    (path: string): NodePermissions => {
      return permissions[path] ?? DEFAULT_PERMISSIONS;
    },
    [permissions],
  );

  const setPermissions = useCallback((path: string, patch: Partial<NodePermissions>) => {
    setPermissionsState((prev) => ({
      ...prev,
      [path]: { ...(prev[path] ?? DEFAULT_PERMISSIONS), ...patch },
    }));
  }, []);

  const addProject = useCallback(async () => {
    setError(null);
    setIsAdding(true);
    try {
      const rootPath = await pickProjectDirectory();
      if (!rootPath) return;

      const duplicate = projects.some(
        (p) => p.rootPath.toLowerCase() === rootPath.toLowerCase(),
      );
      if (duplicate) {
        setError("This folder is already added as a project.");
        return;
      }

      const project: Project = {
        id: crypto.randomUUID(),
        name: basename(rootPath),
        rootPath,
        addedAt: Date.now(),
      };

      setProjects((prev) => [...prev, project]);
      setPermissionsState((prev) => ({
        ...prev,
        [rootPath]: { ...DEFAULT_ROOT_PERMISSIONS },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add project folder.");
    } finally {
      setIsAdding(false);
    }
  }, [projects]);

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;

      setPermissionsState((perms) => {
        const next = { ...perms };
        const prefix = target.rootPath;
        for (const key of Object.keys(next)) {
          if (key === prefix || key.startsWith(`${prefix}\\`) || key.startsWith(`${prefix}/`)) {
            delete next[key];
          }
        }
        return next;
      });

      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      projects,
      permissions,
      isAdding,
      error,
      addProject,
      removeProject,
      getPermissions,
      setPermissions,
      clearError,
    }),
    [
      projects,
      permissions,
      isAdding,
      error,
      addProject,
      removeProject,
      getPermissions,
      setPermissions,
      clearError,
    ],
  );

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    throw new Error("useProjects must be used within ProjectsProvider");
  }
  return ctx;
}
