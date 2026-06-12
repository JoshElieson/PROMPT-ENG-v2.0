import { open } from "@tauri-apps/plugin-dialog";
import type { ChatAttachment } from "@/types/chat";
import { basename } from "@/lib/fs";
import { isTauri } from "@/lib/tauri";

/** Desktop/Tauri paths from native file picker or drag-drop. */
export function pathsToChatAttachments(paths: string[]): ChatAttachment[] {
  return paths.map((path) => ({
    id: crypto.randomUUID(),
    name: basename(path),
    path,
  }));
}

/** Browser file input / drag-and-drop: path is display-only (same as file picker). */
export function filesToChatAttachments(files: Iterable<File>): ChatAttachment[] {
  return Array.from(files).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    path: filePathFromFile(file) ?? file.name,
    size: file.size,
  }));
}

function filePathFromFile(file: File): string | null {
  const withPath = file as File & { path?: string };
  if (typeof withPath.path === "string" && withPath.path.length > 0) {
    return withPath.path;
  }
  return null;
}

/** Resolve absolute paths from a drop (native OS drag or HTML5). */
function pathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
  const fromList = dataTransfer.getData("text/uri-list").trim();
  if (fromList) {
    const parsed = fromList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map(uriToPath)
      .filter((p): p is string => p != null);
    if (parsed.length > 0) return parsed;
  }

  const paths: string[] = [];
  const files = dataTransfer.files;
  if (files?.length) {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const path = filePathFromFile(file);
      if (path) paths.push(path);
    }
  }
  return paths;
}

function uriToPath(uri: string): string | null {
  if (!uri.startsWith("file:")) return null;
  try {
    const url = new URL(uri);
    let pathname = decodeURIComponent(url.pathname);
    if (/^\/[a-zA-Z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return null;
  }
}

/** Prefer real paths from a drop; fall back to file metadata. */
export function attachmentsFromDataTransfer(
  dataTransfer: DataTransfer,
): ChatAttachment[] {
  const paths = pathsFromDataTransfer(dataTransfer);
  if (paths.length > 0) return pathsToChatAttachments(paths);
  const list = dataTransfer.files;
  if (!list?.length) return [];
  return filesToChatAttachments(list);
}

/**
 * Append attachments, skipping any name already present in `existing` or earlier in `incoming`.
 */
export function mergeAttachmentsDedupeByName(
  existing: ReadonlyArray<ChatAttachment>,
  incoming: ReadonlyArray<ChatAttachment>,
): { next: ChatAttachment[]; skippedDuplicateNames: string[] } {
  const used = new Set(existing.map((a) => a.name));
  const toAdd: ChatAttachment[] = [];
  const skippedRaw: string[] = [];

  for (const att of incoming) {
    if (used.has(att.name)) {
      skippedRaw.push(att.name);
      continue;
    }
    used.add(att.name);
    toAdd.push(att);
  }

  return {
    next: [...existing, ...toAdd],
    skippedDuplicateNames: [...new Set(skippedRaw)],
  };
}

export function duplicateAttachmentNamesWarning(names: string[]): string {
  if (names.length === 0) return "";
  const q = (n: string) => `"${n}"`;
  if (names.length === 1) {
    return `A file named ${q(names[0])} is already attached.`;
  }
  return `These file names are already attached: ${names.map(q).join(", ")}.`;
}

export async function pickAttachmentsFromDialog(): Promise<ChatAttachment[]> {
  if (!isTauri()) {
    return pickAttachmentsFromBrowser();
  }

  const selected = await open({
    multiple: true,
    title: "Attach files",
  });

  if (selected === null) return [];

  const paths = Array.isArray(selected) ? selected : [selected];
  return paths.map((path) => ({
    id: crypto.randomUUID(),
    name: basename(path),
    path,
  }));
}

function pickAttachmentsFromBrowser(): Promise<ChatAttachment[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";

    input.onchange = () => {
      const files = input.files;
      if (!files?.length) {
        resolve([]);
        return;
      }
      resolve(filesToChatAttachments(files));
    };

    input.oncancel = () => resolve([]);
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
