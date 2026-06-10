import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
  Minus,
} from "lucide-react";
import { listDirectory } from "@/lib/fs";
import { renameFsEntry } from "@/lib/fs-ops";
import {
  listenProjectFsChanged,
  syncProjectFsWatchers,
} from "@/lib/fs-watch";
import {
  directoriesToReloadAfterChange,
  expandedPathsToPrune,
  parentDirectory,
} from "@/lib/project-fs-refresh";
import {
  beginProjectDrag,
  buildProjectDragPayload,
  endProjectDrag,
  writeProjectDragData,
} from "@/lib/project-drag";
import { startNativeFileDrag } from "@/lib/native-file-drag";
import { isTauri } from "@/lib/tauri";
import { pathsEqual, pathsToExpandToReveal } from "@/lib/project-paths";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { AccessIndicator } from "@/components/projects/PermissionToggles";
import { ProjectFolderContextMenu } from "@/components/projects/ProjectFolderContextMenu";
import { PanelTitleInfo } from "@/components/layout/PanelTitleInfo";
import type { FsEntry, Project } from "@/types/project";
import { cn } from "@/lib/utils";

interface ProjectTreeProps {
  projects: Project[];
  editingProjects?: boolean;
}

interface VisibleRow {
  path: string;
  name: string;
  depth: number;
  isDirectory: boolean;
  projectId: string;
  projectRootPath: string;
  isProjectRoot: boolean;
}

function sortEntries(entries: FsEntry[]): FsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function safeTreeItemId(path: string): string {
  try {
    const b = btoa(unescape(encodeURIComponent(path)));
    return `pti_${b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  } catch {
    return `pti_len_${path.length}`;
  }
}

function buildVisibleRows(
  projects: Project[],
  expanded: ReadonlySet<string>,
  childrenByPath: Readonly<Record<string, FsEntry[] | undefined>>,
): VisibleRow[] {
  const out: VisibleRow[] = [];

  const walk = (
    entry: FsEntry,
    depth: number,
    projectId: string,
    projectRootPath: string,
  ) => {
    out.push({
      path: entry.path,
      name: entry.name,
      depth,
      isDirectory: entry.isDirectory,
      projectId,
      projectRootPath,
      isProjectRoot: depth === 0,
    });
    if (!entry.isDirectory || !expanded.has(entry.path)) return;
    const kids = childrenByPath[entry.path];
    if (kids == null) return;
    for (const c of sortEntries(kids)) {
      walk(c, depth + 1, projectId, projectRootPath);
    }
  };

  for (const p of projects) {
    walk(
      { name: p.name, path: p.rootPath, isDirectory: true },
      0,
      p.id,
      p.rootPath,
    );
  }
  return out;
}

export function ProjectTree({
  projects,
  editingProjects = false,
}: ProjectTreeProps) {
  const {
    zone,
    projectFocusRootPath,
    projectFocusPath,
    clearProjectFocusPath,
    selectProject,
    registerFocusProjectTree,
  } = useAppSelection();
  const { getPermissions, setDirectoryPermissions } = useProjects();
  const treeRef = useRef<HTMLDivElement>(null);
  const childrenByPathRef = useRef<Record<string, FsEntry[] | undefined>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [childrenByPath, setChildrenByPath] = useState<
    Record<string, FsEntry[] | undefined>
  >({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [togglingAccessPath, setTogglingAccessPath] = useState<string | null>(
    null,
  );
  const pendingDescendIntoRef = useRef<string | null>(null);
  const lastProjectFocusRef = useRef<string | null>(null);

  useEffect(() => {
    childrenByPathRef.current = childrenByPath;
  }, [childrenByPath]);

  const projectRootPaths = useMemo(
    () => new Set(projects.map((p) => p.rootPath)),
    [projects],
  );

  const [prevEditingProjects, setPrevEditingProjects] = useState(editingProjects);

  if (editingProjects !== prevEditingProjects) {
    setPrevEditingProjects(editingProjects);
    if (editingProjects) {
      setExpandedPaths(new Set());
    }
  }

  const visibleRows = useMemo(
    () => buildVisibleRows(projects, expandedPaths, childrenByPath),
    [projects, expandedPaths, childrenByPath],
  );

  useLayoutEffect(() => {
    if (projectFocusRootPath) {
      if (projectFocusPath) return;

      const projectChanged =
        lastProjectFocusRef.current !== projectFocusRootPath;
      lastProjectFocusRef.current = projectFocusRootPath;

      const focusInvalid =
        focusedPath == null ||
        !visibleRows.some((r) => r.path === focusedPath);

      if (projectChanged || focusInvalid) {
        queueMicrotask(() => setFocusedPath(projectFocusRootPath));
      }
      return;
    }

    lastProjectFocusRef.current = null;

    if (visibleRows.length === 0) {
      if (focusedPath !== null) queueMicrotask(() => setFocusedPath(null));
      return;
    }
    if (
      focusedPath != null &&
      !visibleRows.some((r) => r.path === focusedPath)
    ) {
      queueMicrotask(() => setFocusedPath(null));
    }
  }, [visibleRows, focusedPath, projectFocusRootPath, projectFocusPath]);

  const focusedIndex = useMemo(() => {
    if (focusedPath == null) return -1;
    return visibleRows.findIndex((r) => r.path === focusedPath);
  }, [visibleRows, focusedPath]);

  const loadChildren = useCallback(async (dirPath: string, force = false) => {
    if (
      !force &&
      Object.prototype.hasOwnProperty.call(childrenByPathRef.current, dirPath)
    ) {
      return;
    }
    let alreadyLoading = false;
    setLoadingPaths((prev) => {
      if (prev.has(dirPath)) {
        alreadyLoading = true;
        return prev;
      }
      return new Set(prev).add(dirPath);
    });
    if (alreadyLoading) return;

    setLoadErrors((prev) => {
      const next = { ...prev };
      delete next[dirPath];
      return next;
    });
    try {
      const entries = await listDirectory(dirPath);
      setChildrenByPath((prev) => ({ ...prev, [dirPath]: entries }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load folder";
      setChildrenByPath((prev) => ({ ...prev, [dirPath]: [] }));
      setLoadErrors((prev) => ({ ...prev, [dirPath]: msg }));
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    }
  }, []);

  /** Drop cached listings only; keep folder expansion (pruned separately on delete). */
  const invalidateDirectoryCache = useCallback((dirPath: string) => {
    const prefix = dirPath.replace(/[/\\]+$/, "");
    setChildrenByPath((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (
          key === prefix ||
          key.startsWith(`${prefix}\\`) ||
          key.startsWith(`${prefix}/`)
        ) {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  const reloadDirectory = useCallback(
    async (dirPath: string) => {
      const parent = dirPath.replace(/[/\\][^/\\]+$/, "");
      if (parent && parent !== dirPath) {
        invalidateDirectoryCache(parent);
        await loadChildren(parent, true);
      } else {
        invalidateDirectoryCache(dirPath);
        await loadChildren(dirPath, true);
      }
    },
    [invalidateDirectoryCache, loadChildren],
  );

  const handleEntryRenamed = useCallback(
    (oldPath: string, newPath: string) => {
      const oldNorm = oldPath.replace(/[/\\]+$/, "");
      const newNorm = newPath.replace(/[/\\]+$/, "");

      setFocusedPath((current) =>
        current != null && pathsEqual(current, oldNorm) ? newNorm : current,
      );
      setRenamingPath((current) =>
        current != null && pathsEqual(current, oldNorm) ? null : current,
      );

      setExpandedPaths((prev) => {
        const next = new Set<string>();
        for (const key of prev) {
          if (pathsEqual(key, oldNorm)) {
            next.add(newNorm);
          } else if (
            key.startsWith(`${oldNorm}\\`) ||
            key.startsWith(`${oldNorm}/`)
          ) {
            next.add(newNorm + key.slice(oldNorm.length));
          } else {
            next.add(key);
          }
        }
        return next;
      });

      setChildrenByPath((prev) => {
        const next: Record<string, FsEntry[] | undefined> = {};
        for (const [key, value] of Object.entries(prev)) {
          if (pathsEqual(key, oldNorm)) {
            next[newNorm] = value;
          } else if (
            key.startsWith(`${oldNorm}\\`) ||
            key.startsWith(`${oldNorm}/`)
          ) {
            next[newNorm + key.slice(oldNorm.length)] = value;
          } else {
            next[key] = value;
          }
        }
        return next;
      });

      const parent = parentDirectory(newNorm);
      void reloadDirectory(parent ?? newNorm);
    },
    [reloadDirectory],
  );

  const refreshFromExternalChange = useCallback(
    async (changedPaths: string[]) => {
      if (changedPaths.length === 0) return;

      const prune = expandedPathsToPrune(changedPaths, expandedPaths);
      if (prune.length > 0) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          for (const path of prune) next.delete(path);
          return next;
        });
        for (const path of prune) {
          invalidateDirectoryCache(path);
        }
      }

      const loadedDirs = Object.keys(childrenByPathRef.current);
      const dirsToReload = directoriesToReloadAfterChange(
        changedPaths,
        loadedDirs,
      );
      await Promise.all(dirsToReload.map((dir) => loadChildren(dir, true)));
    },
    [expandedPaths, invalidateDirectoryCache, loadChildren],
  );

  useEffect(() => {
    const roots = projects.map((p) => p.rootPath);
    void syncProjectFsWatchers(roots);
  }, [projects]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenProjectFsChanged((event) => {
      if (cancelled) return;
      if (!projects.some((p) => pathsEqual(p.rootPath, event.rootPath))) return;
      void refreshFromExternalChange(event.paths);
    }).then((fn) => {
      if (!cancelled) unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [projects, refreshFromExternalChange]);

  const toggleRowAccess = useCallback(
    async (row: VisibleRow) => {
      if (!row.isProjectRoot) return;
      if (editingProjects && row.isProjectRoot) return;
      if (togglingAccessPath === row.path) return;

      const nextEnabled = !getPermissions(row.path).enabled;
      setTogglingAccessPath(row.path);
      try {
        if (!row.isDirectory) return;
        await setDirectoryPermissions(row.path, { enabled: nextEnabled });
      } finally {
        setTogglingAccessPath(null);
      }
    },
    [
      editingProjects,
      togglingAccessPath,
      getPermissions,
      setDirectoryPermissions,
    ],
  );

  const toggleDirectory = useCallback(
    async (path: string) => {
      if (editingProjects && projectRootPaths.has(path)) return;

      if (expandedPaths.has(path)) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        return;
      }
      setExpandedPaths((prev) => new Set(prev).add(path));
      await loadChildren(path);
    },
    [editingProjects, projectRootPaths, expandedPaths, loadChildren],
  );

  const scrollFocusedIntoView = useCallback(() => {
    if (focusedPath == null) return;
    const root = treeRef.current;
    if (!root) return;
    const id = safeTreeItemId(focusedPath);
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(id)
        : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const el = root.querySelector<HTMLElement>(`#${escaped}`);
    if (!el) return;

    const viewport = root.closest("[data-radix-scroll-area-viewport]");
    if (!(viewport instanceof HTMLElement)) {
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
      return;
    }

    const rowRect = el.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();

    if (rowRect.top < viewRect.top) {
      viewport.scrollTop += rowRect.top - viewRect.top;
    } else if (rowRect.bottom > viewRect.bottom) {
      viewport.scrollTop += rowRect.bottom - viewRect.bottom;
    }
  }, [focusedPath]);

  useEffect(() => {
    if (!projectFocusPath || !projectFocusRootPath) return;

    let cancelled = false;
    void (async () => {
      const toExpand = pathsToExpandToReveal(
        projectFocusRootPath,
        projectFocusPath,
      );
      for (const dir of toExpand) {
        if (cancelled) return;
        setExpandedPaths((prev) => new Set(prev).add(dir));
        await loadChildren(dir);
      }
      if (cancelled) return;
      setFocusedPath(projectFocusPath);
      clearProjectFocusPath();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    projectFocusPath,
    projectFocusRootPath,
    loadChildren,
    clearProjectFocusPath,
  ]);

  useEffect(() => {
    scrollFocusedIntoView();
  }, [focusedIndex, scrollFocusedIntoView]);

  const focusRowAt = useCallback(
    (index: number) => {
      const row = visibleRows[index];
      if (!row) return;
      setFocusedPath(row.path);
      if (row.isProjectRoot) selectProject(row.path);
    },
    [visibleRows, selectProject],
  );

  const firstChildIndex = useCallback(
    (parentIndex: number) => {
      const parent = visibleRows[parentIndex];
      if (!parent) return null;
      const child = visibleRows[parentIndex + 1];
      if (child && child.depth > parent.depth) return parentIndex + 1;
      return null;
    },
    [visibleRows],
  );

  useEffect(() => {
    const parentPath = pendingDescendIntoRef.current;
    if (!parentPath) return;

    const parentIndex = visibleRows.findIndex((r) => r.path === parentPath);
    if (parentIndex < 0) {
      pendingDescendIntoRef.current = null;
      return;
    }

    const childIdx = firstChildIndex(parentIndex);
    if (childIdx != null) {
      focusRowAt(childIdx);
      pendingDescendIntoRef.current = null;
    }
  }, [visibleRows, childrenByPath, firstChildIndex, focusRowAt]);

  const moveFocusVertical = useCallback(
    async (delta: number) => {
      if (visibleRows.length === 0) return;
      const start = focusedIndex >= 0 ? focusedIndex : 0;

      if (delta > 0) {
        const row = visibleRows[start]!;
        if (row.isDirectory && expandedPaths.has(row.path)) {
          const childIdx = firstChildIndex(start);
          if (childIdx != null) {
            focusRowAt(childIdx);
            return;
          }
          if (childrenByPath[row.path] === undefined) {
            pendingDescendIntoRef.current = row.path;
            await loadChildren(row.path);
            return;
          }
        }
        const next = Math.min(visibleRows.length - 1, start + 1);
        focusRowAt(next);
        return;
      }

      const prev = Math.max(0, start - 1);
      focusRowAt(prev);
    },
    [
      visibleRows,
      focusedIndex,
      expandedPaths,
      childrenByPath,
      firstChildIndex,
      focusRowAt,
      loadChildren,
    ],
  );

  const focusTree = useCallback(() => {
    requestAnimationFrame(() => treeRef.current?.focus());
  }, []);

  useEffect(() => {
    return registerFocusProjectTree(focusTree);
  }, [registerFocusProjectTree, focusTree]);

  const handleProjectsTreeKey = useCallback(
    (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (zone !== "projects" || !projectFocusRootPath) return;
      if (renamingPath) return;

      const target = e.target;
      if (target instanceof HTMLElement) {
        if (
          target.closest(
            "[data-projects-panel] input, [data-projects-panel] textarea, [data-projects-panel] button, [data-projects-panel] label",
          )
        ) {
          return;
        }
        if (target.closest("[data-composer-textarea]")) {
          target.blur();
        }
      }

      const row = focusedIndex >= 0 ? visibleRows[focusedIndex] : visibleRows[0];
      if (!row) return;

      const stopKey = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      if (e.key === "ArrowDown") {
        stopKey();
        void moveFocusVertical(1);
        return;
      }
      if (e.key === "ArrowUp") {
        stopKey();
        void moveFocusVertical(-1);
        return;
      }
      if (e.key === "Home") {
        stopKey();
        const first = visibleRows[0]!;
        setFocusedPath(first.path);
        if (first.isProjectRoot) selectProject(first.path);
        return;
      }
      if (e.key === "End") {
        stopKey();
        const last = visibleRows[visibleRows.length - 1]!;
        setFocusedPath(last.path);
        if (last.isProjectRoot) selectProject(last.path);
        return;
      }
      if (e.key === "ArrowLeft" && row.isDirectory && expandedPaths.has(row.path)) {
        if (editingProjects && projectRootPaths.has(row.path)) return;
        stopKey();
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(row.path);
          return next;
        });
        return;
      }
      if (e.key === "Enter") {
        if (!row.isDirectory) return;
        if (editingProjects && projectRootPaths.has(row.path)) return;
        stopKey();
        setFocusedPath(row.path);
        if (row.isProjectRoot) selectProject(row.path);
        void toggleDirectory(row.path);
        return;
      }
      if (e.key === " " || e.code === "Space") {
        if (!row.isProjectRoot) return;
        if (editingProjects && row.isProjectRoot) return;
        stopKey();
        setFocusedPath(row.path);
        if (row.isProjectRoot) selectProject(row.path);
        void toggleRowAccess(row);
        return;
      }
      if (e.key === "F2" && !row.isProjectRoot && isTauri()) {
        stopKey();
        setRenamingPath(row.path);
        return;
      }
    },
    [
      zone,
      projectFocusRootPath,
      visibleRows,
      focusedIndex,
      moveFocusVertical,
      expandedPaths,
      toggleDirectory,
      toggleRowAccess,
      editingProjects,
      projectRootPaths,
      renamingPath,
      selectProject,
    ],
  );

  useEffect(() => {
    if (zone !== "projects" || !projectFocusRootPath) return;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing) return;
      handleProjectsTreeKey(e);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [zone, projectFocusRootPath, handleProjectsTreeKey]);

  const onRowBackgroundPointerDown = useCallback(
    (path: string, isProjectRoot: boolean, e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, input")) return;
      if (!isProjectRoot) return;
      selectProject(path);
      setFocusedPath(path);
      focusTree();
    },
    [focusTree, selectProject],
  );

  const onRowClick = useCallback(
    (row: VisibleRow, e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("button, input")) return;
      if (!row.isProjectRoot) return;
      if (editingProjects) return;
      void toggleRowAccess(row);
    },
    [editingProjects, toggleRowAccess],
  );

  if (projects.length === 0) {
    return (
      <p className="text-muted px-3 py-4 text-center text-xs leading-relaxed">
        No project folders yet.
        <br />
        Click <span className="text-muted-foreground">+</span> to add a directory
        from your computer.
      </p>
    );
  }

  const activeDescendant =
    focusedPath != null ? safeTreeItemId(focusedPath) : undefined;

  return (
    <div
      ref={treeRef}
      role="tree"
      tabIndex={0}
      aria-activedescendant={activeDescendant}
      aria-label="Project files"
      data-ai-target="sidebar.projects.tree"
      className="space-y-0.5 pb-2 outline-none focus-visible:ring-0"
    >
      {visibleRows.map((row) => {
        const kids = childrenByPath[row.path];
        const rootLocked = editingProjects && row.isProjectRoot;
        const effectiveExpanded = rootLocked ? false : expandedPaths.has(row.path);
        const showEmptyFolder =
          row.isDirectory &&
          effectiveExpanded &&
          kids !== undefined &&
          kids.length === 0 &&
          loadErrors[row.path] == null;

        return (
          <ProjectTreeRow
            key={row.path}
            row={row}
            domId={safeTreeItemId(row.path)}
            isExpanded={effectiveExpanded}
            rootToggleLocked={rootLocked}
            isLoading={loadingPaths.has(row.path)}
            loadError={loadErrors[row.path]}
            showEmptyFolder={showEmptyFolder}
            editingProjects={editingProjects}
            isTreeFocused={row.path === focusedPath}
            isAccessToggling={togglingAccessPath === row.path}
            isAppProjectSelected={
              row.isProjectRoot && row.path === projectFocusRootPath
            }
            onRowBackgroundPointerDown={onRowBackgroundPointerDown}
            onRowClick={onRowClick}
            onToggleDirectory={() => {
              setFocusedPath(row.path);
              if (row.isProjectRoot) selectProject(row.path);
              void toggleDirectory(row.path);
            }}
            onFsChange={() => reloadDirectory(row.path)}
            isRenaming={renamingPath != null && pathsEqual(renamingPath, row.path)}
            onStartRename={
              row.isProjectRoot
                ? undefined
                : () => setRenamingPath(row.path)
            }
            onFinishRename={() => setRenamingPath(null)}
            onEntryRenamed={handleEntryRenamed}
          />
        );
      })}
    </div>
  );
}

function ProjectTreeRow({
  row,
  domId,
  isExpanded,
  rootToggleLocked,
  isLoading,
  loadError,
  showEmptyFolder,
  editingProjects,
  isTreeFocused,
  isAccessToggling,
  isAppProjectSelected,
  onRowBackgroundPointerDown,
  onRowClick,
  onToggleDirectory,
  onFsChange,
  isRenaming,
  onStartRename,
  onFinishRename,
  onEntryRenamed,
}: {
  row: VisibleRow;
  domId: string;
  isExpanded: boolean;
  rootToggleLocked: boolean;
  isLoading: boolean;
  loadError?: string;
  showEmptyFolder: boolean;
  editingProjects: boolean;
  isTreeFocused: boolean;
  isAccessToggling: boolean;
  isAppProjectSelected: boolean;
  onRowBackgroundPointerDown: (
    path: string,
    isProjectRoot: boolean,
    e: MouseEvent,
  ) => void;
  onRowClick: (row: VisibleRow, e: MouseEvent) => void;
  onToggleDirectory: () => void;
  onFsChange: () => void | Promise<void>;
  isRenaming: boolean;
  onStartRename?: () => void;
  onFinishRename: () => void;
  onEntryRenamed: (oldPath: string, newPath: string) => void;
}) {
  const { getPermissions, removeProject, setError } = useProjects();
  const permissions = getPermissions(row.path);
  const [draftName, setDraftName] = useState(row.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const skipCommitOnBlurRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) return;
    queueMicrotask(() => setDraftName(row.name));
    const id = requestAnimationFrame(() => {
      const input = renameInputRef.current;
      input?.focus();
      input?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isRenaming, row.name]);

  const joinSiblingPath = useCallback((name: string) => {
    const parent = parentDirectory(row.path);
    if (!parent) return null;
    const sep = parent.includes("\\") ? "\\" : "/";
    return `${parent}${sep}${name}`;
  }, [row.path]);

  const commitRename = useCallback(async () => {
    const trimmed = draftName.trim();
    onFinishRename();
    if (!trimmed || trimmed === row.name) return;

    const toPath = joinSiblingPath(trimmed);
    if (!toPath) return;

    try {
      await renameFsEntry(row.path, toPath);
      onEntryRenamed(row.path, toPath);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Failed to rename ${row.isDirectory ? "folder" : "file"}.`,
      );
    }
  }, [
    draftName,
    joinSiblingPath,
    onEntryRenamed,
    onFinishRename,
    row.isDirectory,
    row.name,
    row.path,
    setError,
  ]);

  const cancelRename = useCallback(() => {
    skipCommitOnBlurRef.current = true;
    onFinishRename();
  }, [onFinishRename]);

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleDirectory();
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (isRenaming) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("button, input")) {
      e.preventDefault();
      return;
    }
    const { payload, dropText } = buildProjectDragPayload(
      row.path,
      row.projectRootPath,
      row.name,
      row.isDirectory,
      row.isProjectRoot,
    );

    if (isTauri()) {
      e.preventDefault();
      beginProjectDrag(payload);
      void (async () => {
        try {
          await startNativeFileDrag([payload.path]);
        } finally {
          endProjectDrag();
        }
      })();
      return;
    }

    writeProjectDragData(e.dataTransfer, payload, dropText);
  };

  const handleDragEnd = () => {
    endProjectDrag();
  };

  const rowBody = (
    <div
        id={domId}
        role="treeitem"
        aria-selected={isTreeFocused || isAppProjectSelected}
        aria-expanded={row.isDirectory ? isExpanded : undefined}
        aria-level={row.depth + 1}
        tabIndex={-1}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        {...(row.isProjectRoot
          ? { "data-project-root-path": row.path }
          : {})}
        onPointerDown={(e) =>
          onRowBackgroundPointerDown(row.path, row.isProjectRoot, e)
        }
        onClick={(e) => onRowClick(row, e)}
        title={
          row.isProjectRoot && !editingProjects
            ? "Give AI full access — context, read & write"
            : undefined
        }
        {...(row.isProjectRoot && !editingProjects
          ? { "data-ai-target": "chat.settings.file-access" }
          : {})}
        className={cn(
          "cursor-pointer",
          "group flex items-center gap-0.5 rounded-md py-0.5 pr-1 text-sm text-muted-foreground hover:bg-panel-elevated hover:text-foreground",
          isAppProjectSelected &&
            "bg-panel-elevated/80 text-foreground ring-1 ring-inset ring-accent/25",
          isTreeFocused &&
            !isAppProjectSelected &&
            "bg-panel-elevated/50 text-foreground",
        )}
        style={{ paddingLeft: `${row.depth * 12 + 4}px` }}
      >
        {row.isDirectory ? (
          <button
            type="button"
            onClick={handleChevronClick}
            disabled={isLoading || rootToggleLocked}
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded outline-none hover:bg-border focus-visible:ring-0 disabled:opacity-50",
              rootToggleLocked && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
            aria-label={
              rootToggleLocked
                ? "Folder navigation disabled while editing project list"
                : isExpanded
                  ? "Collapse folder"
                  : "Expand folder"
            }
            aria-disabled={rootToggleLocked}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {row.isDirectory ? (
          isExpanded ? (
            <FolderOpen className="text-accent/80 h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="text-muted h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <File className="text-muted h-3.5 w-3.5 shrink-0" />
        )}

        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={draftName}
            aria-label={`Rename ${row.isDirectory ? "folder" : "file"}`}
            className="border-accent/60 bg-background text-foreground ring-accent/30 focus:border-accent focus:ring-accent/50 min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm ring-1 outline-none"
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelRename();
              }
            }}
            onBlur={() => {
              if (skipCommitOnBlurRef.current) {
                skipCommitOnBlurRef.current = false;
                return;
              }
              void commitRename();
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate" title={row.path}>
            {row.name}
          </span>
        )}

        {editingProjects && row.isProjectRoot ? (
          <button
            type="button"
            title="Remove project from list"
            onClick={(e) => {
              e.stopPropagation();
              removeProject(row.projectId);
            }}
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-lg border transition-colors",
              "border-red-500/70 bg-red-600/25 text-red-100 shadow-inner shadow-black/20",
              "hover:border-red-400 hover:bg-red-600/40 hover:text-white",
            )}
          >
            <Minus className="size-3" strokeWidth={2.5} />
          </button>
        ) : row.isProjectRoot ? (
          <AccessIndicator
            enabled={permissions.enabled}
            toggling={isAccessToggling}
          />
        ) : null}
      </div>
  );

  return (
    <section>
      <ProjectFolderContextMenu
        entryPath={row.path}
        entryKind={row.isDirectory ? "folder" : "file"}
        projectRootPath={row.projectRootPath}
        isProjectRoot={row.isProjectRoot}
        projectId={row.isProjectRoot ? row.projectId : undefined}
        onFsChange={onFsChange}
        onStartRename={onStartRename}
      >
        {rowBody}
      </ProjectFolderContextMenu>

      {loadError && isExpanded && (
        <p
          className="text-[10px] text-red-400"
          style={{ paddingLeft: `${(row.depth + 1) * 12 + 20}px` }}
        >
          {loadError}
        </p>
      )}

      {showEmptyFolder && (
        <p
          className="text-muted py-0.5 text-[10px]"
          style={{ paddingLeft: `${(row.depth + 1) * 12 + 20}px` }}
        >
          Empty folder
        </p>
      )}
    </section>
  );
}

export function ProjectsHeader({
  onAdd,
  editingProjects = false,
  onEditingProjectsChange,
}: {
  onAdd: () => void | Promise<void>;
  editingProjects?: boolean;
  onEditingProjectsChange?: (editing: boolean) => void;
}) {
  const { isAdding } = useProjects();

  return (
    <section className="flex shrink-0 items-center justify-between gap-1 px-3 py-1">
      <section className="flex min-w-0 items-center gap-1">
        <span className="text-muted text-xs font-medium tracking-wider uppercase">
          Files
        </span>
        <PanelTitleInfo
          label="Files"
          description="Manage model access to files"
          className="text-muted-foreground/70 hover:text-muted-foreground h-3.5 w-3.5"
        />
      </section>
      <section className="flex shrink-0 items-center gap-0.5">
        {onEditingProjectsChange ? (
          <button
            type="button"
            title={
              editingProjects
                ? "Return to permission checkboxes"
                : "Remove projects from this list"
            }
            onClick={() => onEditingProjectsChange(!editingProjects)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
              editingProjects
                ? "text-red-400 hover:bg-panel-elevated hover:text-red-300"
                : "text-muted-foreground hover:bg-panel-elevated hover:text-foreground",
            )}
          >
            {editingProjects ? "Stop editing" : "Edit"}
          </button>
        ) : null}
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
    </section>
  );
}
