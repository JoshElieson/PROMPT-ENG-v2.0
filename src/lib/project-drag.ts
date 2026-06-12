import { relativePathFromRootSync } from "@/lib/project-paths";

const PROJECT_DRAG_MIME = "application/x-prompteng-project-entry";

export interface ProjectDragPayload {
  path: string;
  projectRootPath: string;
  isDirectory: boolean;
  name: string;
}

let activeProjectDrag: ProjectDragPayload | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("dragend", () => {
    activeProjectDrag = null;
  });
}

export function beginProjectDrag(payload: ProjectDragPayload): void {
  activeProjectDrag = payload;
}

export function endProjectDrag(): void {
  activeProjectDrag = null;
}

export function isProjectDragActive(): boolean {
  return activeProjectDrag != null;
}

function formatProjectDropText(
  relativePath: string,
  name: string,
  isProjectRoot: boolean,
  isDirectory: boolean,
): string {
  if (isProjectRoot) return name;
  const base = relativePath === "." ? name : relativePath;
  if (!isDirectory) return base;
  if (base.endsWith("/") || base.endsWith("\\")) return base;
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}`;
}

function hasProjectDrag(dataTransfer: DataTransfer): boolean {
  if (activeProjectDrag != null) return true;
  for (let i = 0; i < dataTransfer.types.length; i += 1) {
    if (dataTransfer.types[i] === PROJECT_DRAG_MIME) return true;
  }
  return false;
}

/** OS or browser file input (not project-tree drags). */
function dataTransferHasNativeFiles(dataTransfer: DataTransfer): boolean {
  for (let i = 0; i < dataTransfer.types.length; i += 1) {
    if (dataTransfer.types[i] === "Files") return true;
  }
  if (dataTransfer.items?.length) {
    for (let i = 0; i < dataTransfer.items.length; i += 1) {
      if (dataTransfer.items[i].kind === "file") return true;
    }
  }
  return false;
}

export function dataTransferAcceptsComposerDrop(
  dataTransfer: DataTransfer,
): boolean {
  return (
    dataTransferHasNativeFiles(dataTransfer) ||
    isProjectDragActive() ||
    hasProjectDrag(dataTransfer)
  );
}

function pathToFileUri(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }
  if (normalized.startsWith("//")) {
    return `file:${encodeURI(normalized)}`;
  }
  return `file://${encodeURI(normalized)}`;
}

export function writeProjectDragData(
  dataTransfer: DataTransfer,
  payload: ProjectDragPayload,
  dropText: string,
): void {
  beginProjectDrag(payload);
  dataTransfer.setData(PROJECT_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData("text/plain", dropText);
  dataTransfer.setData("text/uri-list", pathToFileUri(payload.path));
  dataTransfer.effectAllowed = "copy";
}

export function readProjectDragPayload(
  dataTransfer: DataTransfer,
): ProjectDragPayload | null {
  if (
    dataTransferHasNativeFiles(dataTransfer) &&
    !hasProjectDrag(dataTransfer)
  ) {
    return null;
  }

  if (activeProjectDrag) return activeProjectDrag;

  const raw = dataTransfer.getData(PROJECT_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectDragPayload;
    if (
      typeof parsed.path !== "string" ||
      typeof parsed.projectRootPath !== "string" ||
      typeof parsed.isDirectory !== "boolean"
    ) {
      return null;
    }
    return {
      path: parsed.path,
      projectRootPath: parsed.projectRootPath,
      isDirectory: parsed.isDirectory,
      name: typeof parsed.name === "string" ? parsed.name : parsed.path,
    };
  } catch {
    return null;
  }
}

export function buildProjectDragPayload(
  path: string,
  projectRootPath: string,
  name: string,
  isDirectory: boolean,
  isProjectRoot: boolean,
): { payload: ProjectDragPayload; dropText: string } {
  const rel = relativePathFromRootSync(projectRootPath, path);
  const dropText = formatProjectDropText(
    rel,
    name,
    isProjectRoot,
    isDirectory,
  );
  return {
    payload: {
      path,
      projectRootPath,
      isDirectory,
      name,
    },
    dropText,
  };
}
