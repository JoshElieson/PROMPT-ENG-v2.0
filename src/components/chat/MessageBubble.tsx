import type { ChatMessage } from "@/types/chat";
import { getModelById } from "@/data/ai-models";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { formatChatTime } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(@[a-z0-9][a-z0-9_-]*)/gi);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const model = getModelById(part.slice(1));
          return (
            <span
              key={`${part}-${i}`}
              className="bg-accent/15 px-1 py-0.5 font-medium text-accent"
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

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isSent = message.role === "user";
  const targets =
    message.targetModelIds
      ?.map((id) => getModelById(id))
      .filter((m) => m != null) ?? [];

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-2",
        isSent ? "items-end" : "items-start",
      )}
    >
      <p
        className={cn(
          "text-xs text-muted",
          isSent ? "text-right" : "text-left",
        )}
      >
        {isSent ? "You" : "Assistant"}{" "}
        <span className="text-muted-foreground">
          {formatChatTime(message.createdAt)}
        </span>
      </p>

      {targets.length > 0 && isSent && (
        <p className="flex max-w-[85%] flex-wrap justify-end gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted">
            To:
          </span>
          {targets.map((model) => (
            <span
              key={model.id}
              className="inline-flex items-center gap-1 border border-border-subtle px-2 py-0.5 text-[11px]"
            >
              <span
                className="h-1.5 w-1.5"
                style={{ backgroundColor: model.color }}
              />
              {model.name}
            </span>
          ))}
        </p>
      )}

      <section
        className={cn(
          "max-w-[85%] border px-4 py-3",
          isSent
            ? "border-accent/30 bg-accent/10"
            : "border-border bg-panel",
        )}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className="-mx-1 mb-2">
            <AttachmentChips attachments={message.attachments} readonly />
          </div>
        )}
        <MessageContent content={message.content} />
      </section>
    </article>
  );
}
