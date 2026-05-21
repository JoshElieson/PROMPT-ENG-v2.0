import { useEffect, useState } from "react";
import type { ChatMessage } from "@/types/chat";
import { getModelById } from "@/data/ai-models";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { CodeSnippetBlock } from "@/components/chat/CodeSnippetBlock";
import { parseMessageContent } from "@/lib/parse-message-content";
import {
  isPathWithinPrefix,
  isStrictAncestorPath,
  normalizeFsPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";

type ForgeActivityAction = "read" | "write";

interface ForgeActivity {
  action: ForgeActivityAction;
  path: string;
  added?: number;
  removed?: number;
}

interface EditSummary {
  rootPath: string;
  added: number;
  removed: number;
}

interface ActivityDisplayRow {
  action: ForgeActivityAction;
  path: string;
  added?: number;
  removed?: number;
}

const FORGE_ACTIVITY_RE = /^\s*\[\[FORGE_ACTIVITY\s+(\{.+\})\]\]\s*$/;

function extractForgeActivities(content: string): {
  body: string;
  activities: ForgeActivity[];
} {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const activities: ForgeActivity[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(FORGE_ACTIVITY_RE);
    if (!match) {
      bodyLines.push(line);
      continue;
    }
    try {
      const parsed = JSON.parse(match[1]) as Partial<ForgeActivity>;
      if (
        (parsed.action === "read" || parsed.action === "write") &&
        typeof parsed.path === "string" &&
        parsed.path.trim().length > 0
      ) {
        activities.push({
          action: parsed.action,
          path: parsed.path,
          added:
            typeof parsed.added === "number" && Number.isFinite(parsed.added)
              ? Math.max(0, Math.round(parsed.added))
              : undefined,
          removed:
            typeof parsed.removed === "number" && Number.isFinite(parsed.removed)
              ? Math.max(0, Math.round(parsed.removed))
              : undefined,
        });
        continue;
      }
    } catch {
      // Ignore malformed activity lines and show raw text.
    }
    bodyLines.push(line);
  }

  return {
    body: bodyLines.join("\n").trim(),
    activities,
  };
}

function getUppermostRoots(paths: string[]): string[] {
  const cleaned = paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
  return cleaned.filter(
    (path) => !cleaned.some((other) => isStrictAncestorPath(other, path)),
  );
}

function buildEditSummaries(
  activities: ForgeActivity[],
  contextRoots: string[] | undefined,
): EditSummary[] {
  const writes = activities.filter((activity) => activity.action === "write");
  if (writes.length === 0) return [];

  const roots = getUppermostRoots(contextRoots ?? []);
  if (roots.length > 0) {
    return roots
      .map((rootPath) => {
        let added = 0;
        let removed = 0;
        for (const write of writes) {
          if (!isPathWithinPrefix(rootPath, write.path)) continue;
          added += write.added ?? 0;
          removed += write.removed ?? 0;
        }
        return {
          rootPath,
          added,
          removed,
        };
      })
      .filter((summary) => summary.added > 0 || summary.removed > 0);
  }

  const grouped = new Map<string, EditSummary>();
  for (const write of writes) {
    const key = write.path;
    const existing = grouped.get(key);
    if (existing) {
      existing.added += write.added ?? 0;
      existing.removed += write.removed ?? 0;
      continue;
    }
    grouped.set(key, {
      rootPath: key,
      added: write.added ?? 0,
      removed: write.removed ?? 0,
    });
  }
  return [...grouped.values()];
}

function getParentPath(path: string): string {
  const trimmed = normalizeFsPath(path);
  const normalized = trimmed.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return trimmed;
  return normalized.slice(0, idx);
}

function buildExpandedActivityRows(activities: ForgeActivity[]): ActivityDisplayRow[] {
  const readRows: ActivityDisplayRow[] = activities
    .filter((activity) => activity.action === "read")
    .map((activity) => ({
      action: "read",
      path: activity.path,
    }));

  const writesByFolder = new Map<string, ActivityDisplayRow>();
  for (const activity of activities) {
    if (activity.action !== "write") continue;
    const folderPath = getParentPath(activity.path);
    const existing = writesByFolder.get(folderPath);
    if (existing) {
      existing.added = (existing.added ?? 0) + (activity.added ?? 0);
      existing.removed = (existing.removed ?? 0) + (activity.removed ?? 0);
      continue;
    }
    writesByFolder.set(folderPath, {
      action: "write",
      path: folderPath,
      added: activity.added ?? 0,
      removed: activity.removed ?? 0,
    });
  }

  return [...readRows, ...writesByFolder.values()];
}

function PlainTextWithMentions({
  content,
  isSent,
}: {
  content: string;
  isSent?: boolean;
}) {
  const parts = content.split(/(@[a-z0-9][a-z0-9_-]*)/gi);

  return (
    <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const model = getModelById(part.slice(1));
          return (
            <span
              key={`${part}-${i}`}
              className={cn(
                "rounded-md px-1 py-0.5 font-medium",
                isSent
                  ? "bg-muted-foreground/15 text-muted-foreground"
                  : "bg-accent/15 text-accent",
              )}
            >
              {model ? `@${model.name}` : part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

const INLINE_TOKEN_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|@[a-z0-9][a-z0-9_-]*)/gi;

function renderInlineRichText(content: string, isSent?: boolean): React.ReactNode[] {
  const chunks = content.split(INLINE_TOKEN_RE);
  return chunks
    .filter((chunk) => chunk.length > 0)
    .map((chunk, idx) => {
      if (chunk.startsWith("`") && chunk.endsWith("`") && chunk.length >= 2) {
        return (
          <code
            key={`inline-code-${idx}`}
            className="border-border/50 bg-muted/35 text-foreground/95 rounded-md border px-1.5 py-0.5 font-mono text-[0.82rem]"
          >
            {chunk.slice(1, -1)}
          </code>
        );
      }

      if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length >= 4) {
        return (
          <strong key={`inline-strong-${idx}`} className="text-foreground font-semibold">
            {chunk.slice(2, -2)}
          </strong>
        );
      }

      if (chunk.startsWith("@")) {
        const model = getModelById(chunk.slice(1));
        return (
          <span
            key={`inline-mention-${idx}`}
            className={cn(
              "rounded-md px-1 py-0.5 font-medium",
              isSent
                ? "bg-muted-foreground/15 text-muted-foreground"
                : "bg-accent/15 text-accent",
            )}
          >
            {model ? `@${model.name}` : chunk}
          </span>
        );
      }

      return <span key={`inline-text-${idx}`}>{chunk}</span>;
    });
}

function RichTextBlock({
  content,
  isSent,
}: {
  content: string;
  isSent?: boolean;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingSize =
        level === 1
          ? "text-xl"
          : level === 2
            ? "text-lg"
            : level === 3
              ? "text-base"
              : "text-sm";

      blocks.push(
        <h3
          key={`heading-${i}`}
          className={cn(
            "mb-2 mt-1 font-semibold tracking-tight text-foreground",
            headingSize,
            !isSent && "text-accent/95",
          )}
        >
          {renderInlineRichText(headingText, isSent)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(
        <div
          key={`rule-${i}`}
          className="via-border/80 my-3 h-px w-full rounded-full bg-gradient-to-r from-transparent to-transparent"
        />,
      );
      i += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = (lines[i] ?? "").trim();
        const match = itemLine.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          className="text-foreground/90 marker:text-accent/80 mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={`ul-item-${idx}`}>{renderInlineRichText(item, isSent)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = (lines[i] ?? "").trim();
        const match = itemLine.match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="text-foreground/90 marker:text-accent/80 mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={`ol-item-${idx}`}>{renderInlineRichText(item, isSent)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const paragraphLine = lines[i] ?? "";
      const paragraphTrimmed = paragraphLine.trim();
      if (
        !paragraphTrimmed ||
        /^(#{1,4})\s+/.test(paragraphTrimmed) ||
        /^---+$/.test(paragraphTrimmed) ||
        /^[-*]\s+/.test(paragraphTrimmed) ||
        /^\d+\.\s+/.test(paragraphTrimmed)
      ) {
        break;
      }
      paragraphLines.push(paragraphTrimmed);
      i += 1;
    }

    const paragraph = paragraphLines.join(" ");
    if (paragraph) {
      blocks.push(
        <p
          key={`paragraph-${i}`}
          className="text-foreground/90 mb-3 text-sm leading-relaxed"
        >
          {renderInlineRichText(paragraph, isSent)}
        </p>,
      );
    }
  }

  return <div className="space-y-0.5">{blocks}</div>;
}

function MessageContent({
  content,
  isSent,
  createdAt,
  toolContextRoots,
}: {
  content: string;
  isSent?: boolean;
  createdAt: number;
  toolContextRoots?: string[];
}) {
  const { body, activities } = extractForgeActivities(content);
  const textBody = body;
  const segments = parseMessageContent(textBody);
  const hasCode = segments.some((s) => s.type === "code");
  const writeActivities = activities.filter(
    (activity) => activity.action === "write",
  );
  const editSummaries = buildEditSummaries(activities, toolContextRoots);
  const expandedActivityRows = buildExpandedActivityRows(activities);
  const canAutoCollapse =
    !isSent && writeActivities.length > 0 && editSummaries.length > 0;
  const [collapseEdits, setCollapseEdits] = useState(() => {
    if (!canAutoCollapse) return false;
    return Date.now() - createdAt >= 1000;
  });

  useEffect(() => {
    if (!canAutoCollapse) {
      queueMicrotask(() => setCollapseEdits(false));
      return;
    }
    const remainingMs = 1000 - (Date.now() - createdAt);
    if (remainingMs <= 0) {
      queueMicrotask(() => setCollapseEdits(true));
      return;
    }
    queueMicrotask(() => setCollapseEdits(false));
    const timer = window.setTimeout(() => setCollapseEdits(true), remainingMs);
    return () => window.clearTimeout(timer);
  }, [canAutoCollapse, createdAt]);

  const activityView =
    !isSent && activities.length > 0 ? (
      <div className="mb-3 space-y-1">
        {collapseEdits && editSummaries.length > 0
          ? editSummaries.map((summary) => (
              <button
                type="button"
                key={`summary-${summary.rootPath}`}
                onClick={() => setCollapseEdits(false)}
                className="text-muted-foreground/85 hover:bg-muted/30 hover:text-foreground focus-visible:ring-accent/70 flex w-full items-center justify-between rounded-sm text-left font-mono text-xs leading-relaxed transition-colors focus-visible:ring-1 focus-visible:outline-none"
                title='Show full file-by-file edit stream'
              >
                <span>{`Edits to "${summary.rootPath}"`}</span>
                <span className="ml-2 inline-flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-400/90">+{summary.added}</span>
                  <span className="text-rose-400/90">-{summary.removed}</span>
                </span>
              </button>
            ))
          : expandedActivityRows.map((activity, index) => (
              <div
                key={`${activity.action}-${activity.path}-${index}`}
                className="text-muted-foreground/85 font-mono text-xs leading-relaxed"
              >
                {activity.action === "read"
                  ? `Reading "${activity.path}"`
                  : `Editing "${activity.path}"`}
                {activity.action === "write" &&
                  typeof activity.added === "number" &&
                  typeof activity.removed === "number" && (
                    <span className="ml-2 inline-flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400/90">+{activity.added}</span>
                      <span className="text-rose-400/90">-{activity.removed}</span>
                    </span>
                  )}
              </div>
            ))}
      </div>
    ) : null;
  const hasTextBody = textBody.trim().length > 0;

  if (!hasCode) {
    if (!hasTextBody) {
      return activityView ? <div>{activityView}</div> : null;
    }
    return (
      <div>
        {activityView}
        {isSent ? (
          <PlainTextWithMentions content={textBody} isSent={isSent} />
        ) : (
          <RichTextBlock content={textBody} isSent={isSent} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activityView}
      {segments.map((segment, index) => {
        if (segment.type === "code") {
          return (
            <CodeSnippetBlock
              key={`code-${index}`}
              language={segment.language}
              code={segment.content}
            />
          );
        }
        const text = segment.content.trim();
        if (!text) return null;
        return (
          <RichTextBlock
            key={`text-${index}`}
            content={segment.content}
            isSent={isSent}
          />
        );
      })}
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isSent = message.role === "user";

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-0",
        isSent ? "items-end" : "items-start",
      )}
    >
      <section
        className={cn(
          "relative",
          isSent
            ? "max-w-[85%] rounded-2xl border border-[#6366f1]/26 bg-[#2b3150]/55 px-4 py-3 shadow-[0_10px_20px_rgba(2,6,23,0.3)]"
            : "w-full max-w-2xl",
        )}
      >
        <div className="min-w-0">
          {message.attachments && message.attachments.length > 0 && (
            <div className="-mx-1 mb-2">
              <AttachmentChips attachments={message.attachments} readonly />
            </div>
          )}
          <MessageContent
            content={message.content}
            isSent={isSent}
            createdAt={message.createdAt}
            toolContextRoots={message.toolContextRoots}
          />
        </div>
      </section>
    </article>
  );
}
