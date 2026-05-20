import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultPermissionsForProjects } from "@/lib/project-ai-paths";
import { basename, listDescendantPaths, pickProjectDirectory } from "@/lib/fs";
import { loadProjects, saveProjects } from "@/lib/storage";
import { useChats } from "@/contexts/ChatsContext";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_ROOT_PERMISSIONS,
  type NodePermissions,
  type Project,
} from "@/types/project";

function pathsUnderRoot(
  permissions: Record<string, NodePermissions>,
  rootPath: string,
): string[] {
  return Object.keys(permissions).filter(
    (key) =>
      key === rootPath ||
      key.startsWith(`${rootPath}\\`) ||
      key.startsWith(`${rootPath}/`),
  );
}

interface ProjectsContextValue {
  projects: Project[];
  isAdding: boolean;
  error: string | null;
  addProject: () => Promise<void>;
  removeProject: (id: string) => void;
  getPermissions: (path: string) => NodePermissions;
  setPermissions: (path: string, patch: Partial<NodePermissions>) => void;
  setDirectoryPermissions: (
    dirPath: string,
    patch: Partial<NodePermissions>,
  ) => Promise<void>;
  clearError: () => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const {
    activeChatId,
    chats,
    updateChatPermissions,
    setChatPermissions,
  } = useChats();
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const activePermissions = activeChat?.permissions ?? {};

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    if (!activeChatId || projects.length === 0) return;
    const chat = chats.find((c) => c.id === activeChatId);
    if (!chat) return;
    if (chat.permissions && Object.keys(chat.permissions).length > 0) return;
    setChatPermissions(activeChatId, defaultPermissionsForProjects(projects));
  }, [activeChatId, chats, projects, setChatPermissions]);

  const patchActivePermissions = useCallback(
    (updater: (prev: Record<string, NodePermissions>) => Record<string, NodePermissions>) => {
      if (!activeChatId) return;
      updateChatPermissions(activeChatId, updater);
    },
    [activeChatId, updateChatPermissions],
  );

  const getPermissions = useCallback(
    (path: string): NodePermissions => {
      return activePermissions[path] ?? DEFAULT_PERMISSIONS;
    },
    [activePermissions],
  );

  const setPermissions = useCallback(
    (path: string, patch: Partial<NodePermissions>) => {
      patchActivePermissions((prev) => ({
        ...prev,
        [path]: { ...(prev[path] ?? DEFAULT_PERMISSIONS), ...patch },
      }));
    },
    [patchActivePermissions],
  );

  const setDirectoryPermissions = useCallback(
    async (dirPath: string, patch: Partial<NodePermissions>) => {
      const descendants = await listDescendantPaths(dirPath);
      patchActivePermissions((prev) => {
        const next = { ...prev };
        const apply = (path: string) => {
          next[path] = { ...(prev[path] ?? DEFAULT_PERMISSIONS), ...patch };
        };
        apply(dirPath);
        for (const path of descendants) apply(path);
        return next;
      });
    },
    [patchActivePermissions],
  );

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

      if (activeChatId) {
        patchActivePermissions((prev) => ({
          ...prev,
          [rootPath]: { ...DEFAULT_ROOT_PERMISSIONS },
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add project folder.");
    } finally {
      setIsAdding(false);
    }
  }, [projects, activeChatId, patchActivePermissions]);

  const removeProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;

      const prefix = target.rootPath;
      for (const chat of chats) {
        if (!chat.permissions) continue;
        const next = { ...chat.permissions };
        for (const key of pathsUnderRoot(next, prefix)) {
          delete next[key];
        }
        setChatPermissions(chat.id, next);
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [projects, chats, setChatPermissions],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      projects,
      isAdding,
      error,
      addProject,
      removeProject,
      getPermissions,
      setPermissions,
      setDirectoryPermissions,
      clearError,
    }),
    [
      projects,
      isAdding,
      error,
      addProject,
      removeProject,
      getPermissions,
      setPermissions,
      setDirectoryPermissions,
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
