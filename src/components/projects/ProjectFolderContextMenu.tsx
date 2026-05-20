import { useCallback, useState, type ReactNode } from "react";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { basename } from "@/lib/fs";
import {
  copyFsEntry,
  createFsEntry,
  findInDirectory,
  moveFsEntry,
  relativePathFromRoot,
  removeFsEntry,
  revealInFileExplorer,
} from "@/lib/fs-ops";
import {
  clearProjectClipboard,
  getProjectClipboard,
  setProjectClipboard,
} from "@/lib/project-clipboard";
import { isTauri } from "@/lib/tauri";
import { useAppSelection } from "@/contexts/AppSelectionContext";
import { useProjects } from "@/contexts/ProjectsContext";

function joinPath(parent: string, name: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  return `${parent.replace(/[/\\]+$/, "")}${sep}${name}`;
}

function parentDir(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return idx <= 0 ? normalized : normalized.slice(0, idx);
}

async function promptName(title: string, defaultValue = ""): Promise<string | null> {
  const value = window.prompt(title, defaultValue);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

interface ProjectFolderContextMenuProps {
  entryPath: string;
  entryKind: "file" | "folder";
  projectRootPath: string;
  isProjectRoot: boolean;
  projectId?: string;
  children: ReactNode;
  onFsChange: () => void | Promise<void>;
  onStartRename?: () => void;
}

export function ProjectFolderContextMenu({
  entryPath,
  entryKind,
  projectRootPath,
  isProjectRoot,
  projectId,
  children,
  onFsChange,
  onStartRename,
}: ProjectFolderContextMenuProps) {
  const isFile = entryKind === "file";
  const pasteTargetPath = isFile ? parentDir(entryPath) : entryPath;
  const entryLabel = isFile ? "file" : "folder";

  const {
    removeProject,
    setPermissions,
    setDirectoryPermissions,
    setError,
  } = useProjects();
  const { selectWorkspaceScreen, focusComposer } = useAppSelection();
  const [pasteTick, setPasteTick] = useState(0);
  const clipboard = getProjectClipboard();
  const canPaste =
    isTauri() &&
    clipboard != null &&
    clipboard.path.toLowerCase() !== pasteTargetPath.toLowerCase();

  const refresh = useCallback(async () => {
    await onFsChange();
  }, [onFsChange]);

  const handleNewFile = useCallback(async () => {
    const name = await promptName("New file name");
    if (!name) return;
    try {
      await createFsEntry(entryPath, name, false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create file.");
    }
  }, [entryPath, refresh, setError]);

  const handleNewFolder = useCallback(async () => {
    const name = await promptName("New folder name");
    if (!name) return;
    try {
      await createFsEntry(entryPath, name, true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder.");
    }
  }, [entryPath, refresh, setError]);

  const handleReveal = useCallback(async () => {
    try {
      await revealInFileExplorer(entryPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open in File Explorer.");
    }
  }, [entryPath, setError]);

  const handleFindInFolder = useCallback(async () => {
    const query = await promptName("Find in folder");
    if (!query) return;
    try {
      const matches = await findInDirectory(entryPath, query, 50);
      if (matches.length === 0) {
        await message(`No matches for "${query}" in this folder.`, {
          title: "Find in Folder",
          kind: "info",
        });
        return;
      }
      const lines = matches
        .slice(0, 20)
        .map((m) => `${m.path}:${m.line}  ${m.preview}`)
        .join("\n");
      const suffix =
        matches.length > 20
          ? `\n\n… and ${matches.length - 20} more match(es).`
          : "";
      await message(`${lines}${suffix}`, {
        title: `Find in Folder (${matches.length})`,
        kind: "info",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    }
  }, [entryPath, setError]);

  const handleAddToChat = useCallback(async () => {
    try {
      if (isFile) {
        setPermissions(entryPath, { enabled: true });
      } else {
        await setDirectoryPermissions(entryPath, { enabled: true });
      }
      selectWorkspaceScreen();
      requestAnimationFrame(() => focusComposer());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `Failed to add ${entryLabel} to chat.`,
      );
    }
  }, [
    entryPath,
    entryLabel,
    isFile,
    setPermissions,
    setDirectoryPermissions,
    selectWorkspaceScreen,
    focusComposer,
    setError,
  ]);

  const handleCut = useCallback(() => {
    setProjectClipboard({
      op: "cut",
      path: entryPath,
      isDirectory: !isFile,
    });
    setPasteTick((n) => n + 1);
  }, [entryPath, isFile]);

  const handleCopy = useCallback(() => {
    setProjectClipboard({
      op: "copy",
      path: entryPath,
      isDirectory: !isFile,
    });
    setPasteTick((n) => n + 1);
  }, [entryPath, isFile]);

  const handlePaste = useCallback(async () => {
    void pasteTick;
    const entry = getProjectClipboard();
    if (!entry) return;
    const destName = basename(entry.path);
    const destPath = joinPath(pasteTargetPath, destName);
    if (destPath.toLowerCase() === entry.path.toLowerCase()) return;
    try {
      if (entry.op === "cut") {
        await moveFsEntry(entry.path, destPath);
        clearProjectClipboard();
      } else {
        await copyFsEntry(entry.path, destPath);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paste failed.");
    }
  }, [pasteTargetPath, pasteTick, refresh, setError]);

  const handleCopyPath = useCallback(async () => {
    try {
      await copyText(entryPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy path.");
    }
  }, [entryPath, setError]);

  const handleCopyRelativePath = useCallback(async () => {
    try {
      const rel = await relativePathFromRoot(projectRootPath, entryPath);
      await copyText(rel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy relative path.");
    }
  }, [entryPath, projectRootPath, setError]);

  const handleDelete = useCallback(async () => {
    const ok = await confirm(
      isFile
        ? `Delete file "${basename(entryPath)}"?`
        : `Delete folder "${basename(entryPath)}" and everything inside it?`,
      {
        title: isFile ? "Delete File" : "Delete Folder",
        kind: "warning",
      },
    );
    if (!ok) return;
    try {
      await removeFsEntry(entryPath);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Failed to delete ${entryLabel}.`,
      );
    }
  }, [entryPath, entryLabel, isFile, refresh, setError]);

  const handleRemoveFromProjects = useCallback(async () => {
    if (!projectId) return;
    const ok = await confirm(
      `Remove "${basename(entryPath)}" from the project list? Files on disk are not deleted.`,
      { title: "Delete from Projects", kind: "warning" },
    );
    if (!ok) return;
    removeProject(projectId);
  }, [entryPath, projectId, removeProject]);

  if (!isTauri()) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[220px]">
        {!isFile ? (
          <>
            <ContextMenuItem onSelect={() => void handleNewFile()}>
              New File…
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void handleNewFolder()}>
              New Folder…
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuItem onSelect={() => void handleReveal()}>
          Reveal in File Explorer
          <ContextMenuShortcut>Shift+Alt+R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        {!isFile ? (
          <ContextMenuItem onSelect={() => void handleFindInFolder()}>
            Find in Folder…
            <ContextMenuShortcut>Shift+Alt+F</ContextMenuShortcut>
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onSelect={() => void handleAddToChat()}>
          {isFile ? "Add File to Chat" : "Add Folder to Chat"}
        </ContextMenuItem>
        {!isProjectRoot ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={handleCut}>
              Cut
              <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleCopy}>
              Copy
              <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!canPaste}
              onSelect={() => void handlePaste()}
            >
              Paste
              <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void handleCopyPath()}>
          Copy Path
          <ContextMenuShortcut>Shift+Alt+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void handleCopyRelativePath()}>
          Copy Relative Path
          <ContextMenuShortcut>Ctrl+K Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        {!isProjectRoot ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onStartRename} disabled={!onStartRename}>
              Rename…
              <ContextMenuShortcut>F2</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              className="text-red-300 data-[highlighted]:text-red-200"
              onSelect={() => void handleDelete()}
            >
              Delete
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : null}
        {isProjectRoot && projectId ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-red-300 data-[highlighted]:text-red-200"
              onSelect={() => void handleRemoveFromProjects()}
            >
              Delete from Projects
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
