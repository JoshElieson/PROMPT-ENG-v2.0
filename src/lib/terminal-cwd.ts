import { useEffect, useMemo, useState } from "react";
import { useChats } from "@/contexts/ChatsContext";
import { useGit } from "@/contexts/GitContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { basename, getUserHomeDir } from "@/lib/fs";
import { getOutermostEnabledContextRoots } from "@/lib/project-ai-paths";
import type { NodePermissions } from "@/types/project";

function isProbablyFile(path: string): boolean {
  const name = basename(path);
  return /\.[a-z0-9]{1,8}$/i.test(name) && !name.startsWith(".");
}

/** Directories with AI access enabled in the active chat (outermost roots only). */
export function getSelectedProjectDirectories(
  permissions: Record<string, NodePermissions> | undefined,
  projectRootPaths: ReadonlySet<string>,
): string[] {
  return getOutermostEnabledContextRoots(permissions)
    .map((root) => root.path)
    .filter(
      (path) => projectRootPaths.has(path) || !isProbablyFile(path),
    );
}

export function resolveTerminalCwd(
  gitRepoPath: string | null | undefined,
  permissions: Record<string, NodePermissions> | undefined,
  projectRootPaths: ReadonlySet<string>,
  homeDir: string | null,
): string | null {
  const trimmedGit = gitRepoPath?.trim();
  if (trimmedGit) return trimmedGit;

  const selected = getSelectedProjectDirectories(permissions, projectRootPaths);
  if (selected.length === 1) return selected[0]!;
  return homeDir;
}

export interface TerminalCwdState {
  cwd: string | null;
  /** False until the user home path has been fetched from the shell. */
  ready: boolean;
}

/** Default cwd for new workspace terminals (git repo, single AI-enabled folder, or home). */
export function useTerminalCwd(): TerminalCwdState {
  const { repoPath } = useGit();
  const { activeChat } = useChats();
  const { projects } = useProjects();
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const projectRootPaths = useMemo(
    () => new Set(projects.map((p) => p.rootPath)),
    [projects],
  );

  const permissions = useMemo(
    () => activeChat?.permissions,
    [activeChat?.permissions],
  );

  useEffect(() => {
    let cancelled = false;
    void getUserHomeDir()
      .then((dir) => {
        if (!cancelled) setHomeDir(dir);
      })
      .catch(() => {
        if (!cancelled) setHomeDir(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cwd = useMemo(
    () => resolveTerminalCwd(repoPath, permissions, projectRootPaths, homeDir),
    [repoPath, permissions, projectRootPaths, homeDir],
  );

  return { cwd, ready };
}
