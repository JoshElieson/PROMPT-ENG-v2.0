import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { basename, listDescendantPaths, pickProjectDirectory } from "@/lib/fs";
import { findOwningProject, pathsEqual } from "@/lib/project-paths";
import { loadProjects, saveProjects } from "@/lib/storage";
import { useChats } from "@/contexts/ChatsContext";
import {
  DEFAULT_PERMISSIONS,
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
  addProjectFromPath: (rootPath: string) => Promise<void>;
  removeProject: (id: string) => void;
  getPermissions: (path: string) => NodePermissions;
  setPermissions: (path: string, patch: Partial<NodePermissions>) => void;
  setDirectoryPermissions: (
    dirPath: string,
    patch: Partial<NodePermissions>,
  ) => Promise<void>;
  /** Opens folder picker; adds new projects or enables context on the given chat. */
  pickProjectContextForChat: (chatId: string) => Promise<string | null>;
  clearError: () => void;
  setError: (message: string | null) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const {
    activeChat,
    activeChatId,
    chats,
    updateChatPermissions,
    setChatPermissions,
    setChatGitProject,
  } = useChats();
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePermissions = useMemo(
    () => activeChat?.permissions ?? {},
    [activeChat?.permissions],
  );

  const allChats = useMemo(() => {
    if (activeChat && !chats.some((c) => c.id === activeChat.id)) {
      return [activeChat, ...chats];
    }
    return chats;
  }, [activeChat, chats]);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

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

  const addProjectFromPath = useCallback(
    async (rootPath: string) => {
      setError(null);
      const trimmed = rootPath.trim();
      if (!trimmed) return;

      const duplicate = projects.some(
        (p) => p.rootPath.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) {
        setError("This folder is already added as a project.");
        return;
      }

      const project: Project = {
        id: crypto.randomUUID(),
        name: basename(trimmed),
        rootPath: trimmed,
        addedAt: Date.now(),
      };

      setProjects((prev) => [...prev, project]);
    },
    [projects],
  );

  const addProject = useCallback(async () => {
    setError(null);
    setIsAdding(true);
    try {
      const rootPath = await pickProjectDirectory();
      if (!rootPath) return;
      await addProjectFromPath(rootPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add project folder.");
    } finally {
      setIsAdding(false);
    }
  }, [addProjectFromPath]);

  const enableDirectoryOnChat = useCallback(
    async (
      chatId: string,
      dirPath: string,
      patch: Partial<NodePermissions>,
    ) => {
      const descendants = await listDescendantPaths(dirPath);
      updateChatPermissions(chatId, (prev) => {
        const next = { ...prev };
        const apply = (path: string) => {
          next[path] = { ...(prev[path] ?? DEFAULT_PERMISSIONS), ...patch };
        };
        apply(dirPath);
        for (const path of descendants) apply(path);
        return next;
      });
    },
    [updateChatPermissions],
  );

  const pickProjectContextForChat = useCallback(
    async (chatId: string): Promise<string | null> => {
      setError(null);
      setIsAdding(true);
      try {
        const picked = await pickProjectDirectory("Add project context");
        if (!picked) return null;

        const trimmed = picked.trim();
        const owning = findOwningProject(projects, trimmed);

        if (!owning) {
          const project: Project = {
            id: crypto.randomUUID(),
            name: basename(trimmed),
            rootPath: trimmed,
            addedAt: Date.now(),
          };
          setProjects((prev) => [...prev, project]);
        }

        const contextPath = owning
          ? pathsEqual(owning.rootPath, trimmed)
            ? owning.rootPath
            : trimmed
          : trimmed;

        await enableDirectoryOnChat(chatId, contextPath, { enabled: true });
        return contextPath;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to add project context.",
        );
        return null;
      } finally {
        setIsAdding(false);
      }
    },
    [projects, enableDirectoryOnChat],
  );

  const removeProject = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;

      const prefix = target.rootPath;
      for (const chat of allChats) {
        if (chat.gitProjectId === id) {
          setChatGitProject(chat.id, null);
        }
        if (!chat.permissions) continue;
        const next = { ...chat.permissions };
        for (const key of pathsUnderRoot(next, prefix)) {
          delete next[key];
        }
        setChatPermissions(chat.id, next);
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [projects, allChats, setChatPermissions, setChatGitProject],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      projects,
      isAdding,
      error,
      addProject,
      addProjectFromPath,
      removeProject,
      getPermissions,
      setPermissions,
      setDirectoryPermissions,
      pickProjectContextForChat,
      clearError,
      setError: setError,
    }),
    [
      projects,
      isAdding,
      error,
      addProject,
      addProjectFromPath,
      removeProject,
      getPermissions,
      setPermissions,
      setDirectoryPermissions,
      pickProjectContextForChat,
      clearError,
      setError,
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
