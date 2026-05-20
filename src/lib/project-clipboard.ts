export type ProjectClipboardOp = "cut" | "copy";

export interface ProjectClipboardEntry {
  op: ProjectClipboardOp;
  path: string;
  isDirectory: boolean;
}

let clipboard: ProjectClipboardEntry | null = null;

export function getProjectClipboard(): ProjectClipboardEntry | null {
  return clipboard;
}

export function setProjectClipboard(entry: ProjectClipboardEntry): void {
  clipboard = entry;
}

export function clearProjectClipboard(): void {
  clipboard = null;
}
