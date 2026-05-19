import { open } from "@tauri-apps/plugin-dialog";
import type { ChatAttachment } from "@/types/chat";
import { basename } from "@/lib/fs";
import { isTauri } from "@/lib/tauri";

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
      resolve(
        Array.from(files).map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          path: file.name,
          size: file.size,
        })),
      );
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
