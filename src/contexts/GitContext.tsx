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
import { listen } from "@tauri-apps/api/event";
import * as git from "@/lib/git";
import { isTauri } from "@/lib/tauri";
import { shouldRefreshGitFromFsPaths } from "@/lib/fs-ignore-paths";
import { listenProjectFsChanged, syncProjectFsWatchers } from "@/lib/fs-watch";
import { pathsEqual } from "@/lib/project-paths";
import { useChats } from "@/contexts/ChatsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { githubTokenFromSession } from "@/lib/github-git-auth";
import type {
  GitBranchEntry,
  GitBranchListResult,
  GitCommandResult,
  GitStatusResult,
} from "@/types/git";

interface GitContextValue {
  repoPath: string | null;
  projectId: string | null;
  setActiveProject: (id: string | null) => void;
  status: GitStatusResult | null;
  branches: GitBranchEntry[];
  isLoadingBranches: boolean;
  isLoading: boolean;
  isOperating: boolean;
  lastMessage: string | null;
  lastMessageOk: boolean;
  refresh: () => Promise<void>;
  loadBranches: () => Promise<void>;
  checkoutBranch: (branch: string) => Promise<void>;
  syncBranch: (branch: string) => Promise<void>;
  pull: () => Promise<void>;
  push: (branch?: string) => Promise<void>;
  syncChanges: (branch?: string) => Promise<void>;
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

function gitStatusEqual(
  a: GitStatusResult,
  b: GitStatusResult,
): boolean {
  if (
    a.isRepo !== b.isRepo ||
    a.branch !== b.branch ||
    a.ahead !== b.ahead ||
    a.behind !== b.behind ||
    a.clean !== b.clean ||
    a.changes.length !== b.changes.length
  ) {
    return false;
  }
  return a.changes.every((c, i) => {
    const d = b.changes[i];
    return (
      c.path === d.path && c.status === d.status && c.staged === d.staged
    );
  });
}

export function GitProvider({ children }: { children: ReactNode }) {
  const { projects } = useProjects();
  const { session } = useAuth();
  const { activeChatId, activeChat, setChatGitProject } = useChats();
  const githubToken = githubTokenFromSession(session);

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
  const [branches, setBranches] = useState<GitBranchEntry[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOperating, setIsOperating] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageOk, setLastMessageOk] = useState(true);
  const fsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMessage = useCallback((ok: boolean, text: string) => {
    setLastMessageOk(ok);
    setLastMessage(text.trim() || (ok ? "Done." : "Command failed."));
  }, []);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!repoPath) {
        setStatus(null);
        return;
      }
      const silent = options?.silent ?? false;
      if (!silent) {
        setIsLoading(true);
      }
      try {
        const result = await git.gitStatus(repoPath);
        setStatus((prev) =>
          prev && gitStatusEqual(prev, result) ? prev : result,
        );
        if (!silent) {
          setLastMessage(null);
        }
      } catch (e) {
        setStatus((prev) => prev ?? EMPTY_STATUS);
        setMessage(
          false,
          git.formatInvokeError(e, "Failed to read git status."),
        );
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [repoPath, setMessage],
  );

  const loadBranches = useCallback(async () => {
    if (!repoPath || !status?.isRepo) {
      setBranches([]);
      return;
    }
    setIsLoadingBranches(true);
    try {
      const result: GitBranchListResult = await git.gitListBranches(repoPath);
      setBranches(result.branches);
    } catch (e) {
      setBranches([]);
      setMessage(
        false,
        git.formatInvokeError(e, "Failed to list git branches."),
      );
    } finally {
      setIsLoadingBranches(false);
    }
  }, [repoPath, status?.isRepo, setMessage]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches, status?.branch]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    const onGitRefresh = () => {
      void refresh({ silent: true });
    };
    window.addEventListener("forge:git-refresh", onGitRefresh);
    let unlistenTauri: (() => void) | undefined;
    if (isTauri()) {
      void listen("forge:git-refresh", onGitRefresh).then((fn) => {
        unlistenTauri = fn;
      });
    }
    return () => {
      window.removeEventListener("forge:git-refresh", onGitRefresh);
      unlistenTauri?.();
    };
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
      if (!shouldRefreshGitFromFsPaths(event.paths)) return;
      if (fsRefreshTimerRef.current) {
        clearTimeout(fsRefreshTimerRef.current);
      }
      fsRefreshTimerRef.current = setTimeout(() => {
        fsRefreshTimerRef.current = null;
        void refresh({ silent: true });
      }, 600);
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
        await refresh({ silent: true });
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
    await runOp("Pull complete.", () => git.gitPull(repoPath, githubToken));
  }, [repoPath, runOp, githubToken]);

  const checkoutBranch = useCallback(
    async (branch: string) => {
      if (!repoPath) return;
      await runOp(`Checked out ${branch}.`, () =>
        git.gitCheckoutBranch(repoPath, branch),
      );
      await loadBranches();
    },
    [repoPath, runOp, loadBranches],
  );

  const syncBranch = useCallback(
    async (branch: string) => {
      if (!repoPath) return;
      await runOp(`Updated ${branch} from remote.`, () =>
        git.gitSyncBranch(repoPath, branch, githubToken),
      );
      await loadBranches();
    },
    [repoPath, runOp, loadBranches, githubToken],
  );

  const push = useCallback(
    async (branch?: string) => {
      if (!repoPath) return;
      await runOp("Push complete.", () =>
        git.gitPush(repoPath, branch, githubToken),
      );
    },
    [repoPath, runOp, githubToken],
  );

  const syncChanges = useCallback(
    async (branch?: string) => {
      if (!repoPath) return;
      await runOp("Sync complete.", () =>
        git.gitSync(repoPath, branch, githubToken),
      );
    },
    [repoPath, runOp, githubToken],
  );

  const fetchRemote = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Fetch complete.", () => git.gitFetch(repoPath, githubToken));
  }, [repoPath, runOp, githubToken]);

  const init = useCallback(async () => {
    if (!repoPath) return;
    await runOp("Repository initialized.", () => git.gitInit(repoPath));
  }, [repoPath, runOp]);

  const clone = useCallback(
    async (url: string, parentPath: string) => {
      setIsOperating(true);
      setLastMessage(null);
      try {
        const result = await git.gitClone(url, parentPath, githubToken);
        setMessage(result.success, result.output || "Clone complete.");
        if (result.success) {
          await refresh({ silent: true });
        }
        return result;
      } catch (e) {
        const msg = git.formatInvokeError(e, "Clone failed.");
        setMessage(false, msg);
        return { success: false, output: msg };
      } finally {
        setIsOperating(false);
      }
    },
    [refresh, setMessage, githubToken],
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
      branches,
      isLoadingBranches,
      isLoading,
      isOperating,
      lastMessage,
      lastMessageOk,
      refresh,
      loadBranches,
      checkoutBranch,
      syncBranch,
      pull,
      push,
      syncChanges,
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
      branches,
      isLoadingBranches,
      isLoading,
      isOperating,
      lastMessage,
      lastMessageOk,
      refresh,
      loadBranches,
      checkoutBranch,
      syncBranch,
      pull,
      push,
      syncChanges,
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
