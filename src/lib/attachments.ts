import { open } from "@tauri-apps/plugin-dialog";
import type { ChatAttachment } from "@/types/chat";
import { basename } from "@/lib/fs";
import { isTauri } from "@/lib/tauri";

/** Browser file input / drag-and-drop: path is display-only (same as file picker). */
export function filesToChatAttachments(files: Iterable<File>): ChatAttachment[] {
  return Array.from(files).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    path: file.name,
    size: file.size,
  }));
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
