import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
  Trash2,
} from "lucide-react";
import { listDirectory } from "@/lib/fs";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { AccessCheckbox } from "@/components/projects/PermissionToggles";
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

  const walk = (entry: FsEntry, depth: number, projectId: string) => {
    out.push({
      path: entry.path,
      name: entry.name,
      depth,
      isDirectory: entry.isDirectory,
      projectId,
      isProjectRoot: depth === 0,
    });
    if (!entry.isDirectory || !expanded.has(entry.path)) return;
    const kids = childrenByPath[entry.path];
    if (kids == null) return;
    for (const c of sortEntries(kids)) {
      walk(c, depth + 1, projectId);
    }
  };

  for (const p of projects) {
    walk(
      { name: p.name, path: p.rootPath, isDirectory: true },
      0,
      p.id,
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
    selectProject,
    registerFocusProjectTree,
    selectWorkspaceScreen,
    focusComposer,
  } = useAppSelection();
  const { getPermissions, setPermissions, setDirectoryPermissions } =
    useProjects();
  const treeRef = useRef<HTMLDivElement>(null);
  const childrenByPathRef = useRef<Record<string, FsEntry[] | undefined>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [childrenByPath, setChildrenByPath] = useState<
    Record<string, FsEntry[] | undefined>
  >({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [togglingAccessPath, setTogglingAccessPath] = useState<string | null>(
    null,
  );
  const pendingDescendIntoRef = useRef<string | null>(null);
  const lastProjectFocusRef = useRef<string | null>(null);

  childrenByPathRef.current = childrenByPath;

  const projectRootPaths = useMemo(
    () => new Set(projects.map((p) => p.rootPath)),
    [projects],
  );

  useEffect(() => {
    if (!editingProjects) return;
    setExpandedPaths(new Set());
  }, [editingProjects]);

  const visibleRows = useMemo(
    () => buildVisibleRows(projects, expandedPaths, childrenByPath),
    [projects, expandedPaths, childrenByPath],
  );

  useLayoutEffect(() => {
    if (projectFocusRootPath) {
      const projectChanged =
        lastProjectFocusRef.current !== projectFocusRootPath;
      lastProjectFocusRef.current = projectFocusRootPath;

      const focusInvalid =
        focusedPath == null ||
        !visibleRows.some((r) => r.path === focusedPath);

      if (projectChanged || focusInvalid) {
        setFocusedPath(projectFocusRootPath);
      }
      return;
    }

    lastProjectFocusRef.current = null;

    if (visibleRows.length === 0) {
      if (focusedPath !== null) setFocusedPath(null);
      return;
    }
    if (
      focusedPath != null &&
      !visibleRows.some((r) => r.path === focusedPath)
    ) {
      setFocusedPath(null);
    }
  }, [visibleRows, focusedPath, projectFocusRootPath]);

  const focusedIndex = useMemo(() => {
    if (focusedPath == null) return -1;
    return visibleRows.findIndex((r) => r.path === focusedPath);
  }, [visibleRows, focusedPath]);

  const loadChildren = useCallback(async (dirPath: string) => {
    if (Object.prototype.hasOwnProperty.call(childrenByPathRef.current, dirPath)) {
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

  const toggleRowAccess = useCallback(
    async (row: VisibleRow) => {
      if (editingProjects && row.isProjectRoot) return;
      if (togglingAccessPath === row.path) return;

      const nextEnabled = !getPermissions(row.path).enabled;
      setTogglingAccessPath(row.path);
      try {
        if (row.isDirectory) {
          await setDirectoryPermissions(row.path, { enabled: nextEnabled });
        } else {
          setPermissions(row.path, { enabled: nextEnabled });
        }
      } finally {
        setTogglingAccessPath(null);
      }
    },
    [
      editingProjects,
      togglingAccessPath,
      getPermissions,
      setPermissions,
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
      if (e.key === "ArrowRight") {
        stopKey();
        selectWorkspaceScreen();
        requestAnimationFrame(() => focusComposer());
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
        if (editingProjects && row.isProjectRoot) return;
        stopKey();
        setFocusedPath(row.path);
        if (row.isProjectRoot) selectProject(row.path);
        void toggleRowAccess(row);
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
      childrenByPath,
      loadChildren,
      toggleDirectory,
      toggleRowAccess,
      editingProjects,
      projectRootPaths,
      selectProject,
      selectWorkspaceScreen,
      focusComposer,
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
      if (t.closest("button, input, label")) return;
      if (!isProjectRoot) return;
      selectProject(path);
      setFocusedPath(path);
      focusTree();
    },
    [focusTree, selectProject],
  );

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

  const activeDescendant =
    focusedPath != null ? safeTreeItemId(focusedPath) : undefined;

  return (
    <div
      ref={treeRef}
      role="tree"
      tabIndex={0}
      aria-activedescendant={activeDescendant}
      aria-label="Project files"
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
            onToggleDirectory={() => {
              setFocusedPath(row.path);
              if (row.isProjectRoot) selectProject(row.path);
              void toggleDirectory(row.path);
            }}
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
  onToggleDirectory,
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
  onToggleDirectory: () => void;
}) {
  const { getPermissions, setPermissions, setDirectoryPermissions, removeProject } =
    useProjects();
  const permissions = getPermissions(row.path);

  const handleAccessChange = async (enabled: boolean) => {
    if (isAccessToggling) return;
    if (row.isDirectory) {
      await setDirectoryPermissions(row.path, { enabled });
      return;
    }
    setPermissions(row.path, { enabled });
  };

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleDirectory();
  };

  return (
    <section>
      <section
        id={domId}
        role="treeitem"
        aria-selected={isTreeFocused || isAppProjectSelected}
        aria-expanded={row.isDirectory ? isExpanded : undefined}
        aria-level={row.depth + 1}
        tabIndex={-1}
        {...(row.isProjectRoot
          ? { "data-project-root-path": row.path }
          : {})}
        onPointerDown={(e) =>
          onRowBackgroundPointerDown(row.path, row.isProjectRoot, e)
        }
        className={cn(
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
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted" />
          )
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-muted" />
        )}

        <span className="min-w-0 flex-1 truncate" title={row.path}>
          {row.name}
        </span>

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
            <Trash2 className="size-3" strokeWidth={2.5} />
          </button>
        ) : (
          <AccessCheckbox
            enabled={permissions.enabled}
            disabled={isAccessToggling}
            onChange={(enabled) => void handleAccessChange(enabled)}
          />
        )}
      </section>

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
          className="py-0.5 text-[10px] text-muted"
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
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Projects
        </span>
        <PanelTitleInfo
          label="Projects"
          description="Manage model access to files"
          className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-muted-foreground"
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
