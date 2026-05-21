import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as git from "@/lib/git";
import { listenProjectFsChanged, syncProjectFsWatchers } from "@/lib/fs-watch";
import { pathsEqual } from "@/lib/project-paths";
import { useChats } from "@/contexts/ChatsContext";
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
  commit: (message: string, stageAll?: boolean) => Promise<void>;
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

function isGitInternalPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/.git/");
}

export function GitProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjects();
  const { activeChatId, activeChat, setChatGitProject } = useChats();

  const projectId = useMemo(() => {
    const id = activeChat?.gitProjectId;
    if (!id) return null;
    return projects.some((p) => p.id === id) ? id : null;
  }, [activeChat?.gitProjectId, projects]);

  const activeProject = useMemo(() => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) ?? null;
  }, [projects, projectId]);

  const repoPath = activeProject?.rootPath ?? null;

  const setActiveProject = useCallback(
    (id: string | null) => {
      if (!activeChatId) return;
      if (id !== null && !projects.some((p) => p.id === id)) return;
      setChatGitProject(activeChatId, id);
    },
    [activeChatId, projects, setChatGitProject],
  );

  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageOk, setLastMessageOk] = useState(true);
  const fsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setLastMessage(null);
    } catch (e) {
      setStatus((prev) => prev ?? EMPTY_STATUS);
      setMessage(
        false,
        git.formatInvokeError(e, "Failed to read git status."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, setMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const roots = projects.map((project) => project.rootPath);
    void syncProjectFsWatchers(roots);
  }, [projects]);

  useEffect(() => {
    if (!repoPath) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenProjectFsChanged((event) => {
      if (cancelled) return;
      if (!pathsEqual(event.rootPath, repoPath)) return;
      if (
        event.paths.length > 0 &&
        event.paths.every((path) => isGitInternalPath(path))
      ) {
        return;
      }
      if (fsRefreshTimerRef.current) {
        clearTimeout(fsRefreshTimerRef.current);
      }
      fsRefreshTimerRef.current = setTimeout(() => {
        fsRefreshTimerRef.current = null;
        void refresh();
      }, 400);
    }).then((fn) => {
      if (!cancelled) unlisten = fn;
    });

    return () => {
      cancelled = true;
      if (fsRefreshTimerRef.current) {
        clearTimeout(fsRefreshTimerRef.current);
        fsRefreshTimerRef.current = null;
      }
      unlisten?.();
    };
  }, [repoPath, refresh]);

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
        setMessage(false, git.formatInvokeError(e, `${label} failed.`));
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
        const msg = git.formatInvokeError(e, "Clone failed.");
        setMessage(false, msg);
        return { success: false, output: msg };
      } finally {
        setIsOperating(false);
      }
    },
    [setMessage],
  );

  const commit = useCallback(
    async (message: string, stageAll = false) => {
      if (!repoPath) return;
      await runOp("Committed.", () => git.gitCommit(repoPath, message, stageAll));
    },
    [repoPath, runOp],
  );

  const clearMessage = useCallback(() => setLastMessage(null), []);

  const value = useMemo(
    () => ({
      repoPath,
      projectId,
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
      commit,
      clearMessage,
    }),
    [
      repoPath,
      projectId,
      setActiveProject,
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
      commit,
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
