import { FileText, X } from "lucide-react";
import type { ChatAttachment } from "@/types/chat";
import { formatFileSize } from "@/lib/attachments";

interface AttachmentChipsProps {
  attachments: ChatAttachment[];
  onRemove?: (id: string) => void;
  readonly?: boolean;
}

export function AttachmentChips({
  attachments,
  onRemove,
  readonly = false,
}: AttachmentChipsProps) {
  if (attachments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
      {attachments.map((file) => (
        <li
          key={file.id}
          className="flex max-w-[200px] items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate text-foreground" title={file.path}>
            {file.name}
          </span>
          {file.size != null && (
            <span className="shrink-0 text-muted">
              {formatFileSize(file.size)}
            </span>
          )}
          {!readonly && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(file.id)}
              className="shrink-0 rounded p-0.5 text-muted hover:bg-panel-elevated hover:text-foreground"
              aria-label={`Remove ${file.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
