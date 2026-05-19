import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as git from "@/lib/git";
import { useProjects } from "@/contexts/ProjectsContext";
import type { GitCommandResult, GitStatusResult } from "@/types/git";

interface GitContextValue {
  repoPath: string | null;
  projectId: string | null;
  setActiveProject: (id: string | null) => void;
  status: GitStatusResult | null;
  isLoading: boolean;
  isOperating: boolean;
  lastMessage: string | null;
  lastMessageOk: boolean;
  refresh: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  fetch: () => Promise<void>;
  init: () => Promise<void>;
  clone: (url: string, parentPath: string) => Promise<GitCommandResult>;
  clearMessage: () => void;
}

const GitContext = createContext<GitContextValue | null>(null);

const EMPTY_STATUS: GitStatusResult = {
  isRepo: false,
  branch: null,
  ahead: 0,
  behind: 0,
  changes: [],
  clean: true,
};

export function GitProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjects();
  const [projectId, setActiveProject] = useState<string | null>(null);
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageOk, setLastMessageOk] = useState(true);

  const activeProject = useMemo(() => {
    if (projects.length === 0) return null;
    if (projectId) {
      return projects.find((p) => p.id === projectId) ?? projects[0];
    }
    return projects[0];
  }, [projects, projectId]);

  const repoPath = activeProject?.rootPath ?? null;

  useEffect(() => {
    if (projects.length === 0) {
      setActiveProject(null);
      return;
    }
    if (projectId && !projects.some((p) => p.id === projectId)) {
      setActiveProject(projects[0].id);
    }
  }, [projects, projectId]);

  const setMessage = useCallback((ok: boolean, text: string) => {
    setLastMessageOk(ok);
    setLastMessage(text.trim() || (ok ? "Done." : "Command failed."));
  }, []);

  const refresh = useCallback(async () => {
    if (!repoPath) {
      setStatus(null);
      return;
    }
    setIsLoading(true);
    try {
      const result = await git.gitStatus(repoPath);
      setStatus(result);
    } catch (e) {
      setStatus(EMPTY_STATUS);
      setMessage(false, e instanceof Error ? e.message : "Failed to read git status.");
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, setMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runOp = useCallback(
    async (label: string, fn: () => Promise<GitCommandResult>) => {
      if (!repoPath) return;
      setIsOperating(true);
      setLastMessage(null);
      try {
        const result = await fn();
        setMessage(result.success, result.output || label);
        await refresh();
      } catch (e) {
        setMessage(false, e instanceof Error ? e.message : `${label} failed.`);
      } finally {
        setIsOperating(false);
      }
    },
    [repoPath, refresh, setMessage],
  );

  const pull = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Pull complete.", () => git.gitPull(repoPath));
  }, [repoPath, runOp]);

  const push = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Push complete.", () => git.gitPush(repoPath));
  }, [repoPath, runOp]);

  const fetchRemote = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Fetch complete.", () => git.gitFetch(repoPath));
  }, [repoPath, runOp]);

  const init = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Repository initialized.", () => git.gitInit(repoPath));
  }, [repoPath, runOp]);

  const clone = useCallback(
    async (url: string, parentPath: string) => {
      setIsOperating(true);
      setLastMessage(null);
      try {
        const result = await git.gitClone(url, parentPath);
        setMessage(result.success, result.output || "Clone complete.");
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Clone failed.";
        setMessage(false, msg);
        return { success: false, output: msg };
      } finally {
        setIsOperating(false);
      }
    },
    [setMessage],
  );

  const clearMessage = useCallback(() => setLastMessage(null), []);

  const value = useMemo(
    () => ({
      repoPath,
      projectId: activeProject?.id ?? null,
      setActiveProject,
      status,
      isLoading,
      isOperating,
      lastMessage,
      lastMessageOk,
      refresh,
      pull,
      push,
      fetch: fetchRemote,
      init,
      clone,
      clearMessage,
    }),
    [
      repoPath,
      activeProject?.id,
      status,
      isLoading,
      isOperating,
      lastMessage,
      lastMessageOk,
      refresh,
      pull,
      push,
      fetchRemote,
      init,
      clone,
      clearMessage,
    ],
  );

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

export function useGit() {
  const ctx = useContext(GitContext);
  if (!ctx) {
    throw new Error("useGit must be used within GitProvider");
  }
  return ctx;
}
