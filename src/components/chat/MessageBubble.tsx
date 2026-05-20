import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { getModelById } from "@/data/ai-models";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { ModelContributionHover } from "@/components/chat/ModelContributionHover";
import { Button } from "@/components/ui/button";
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
              className="rounded-md bg-accent/15 px-1 py-0.5 font-medium text-accent"
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

function CopyResponseButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [content]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={copied ? "Copied" : "Copy response"}
      aria-label={copied ? "Copied" : "Copy response"}
      className="absolute right-1 top-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </Button>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isSent = message.role === "user";
  const showModelBlend =
    !isSent &&
    message.modelContributions != null &&
    message.modelContributions.length > 0;

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-0",
        isSent ? "items-end" : "items-start",
      )}
    >
      <section
        className={cn(
          "relative max-w-[85%] rounded-2xl border px-4 py-3",
          isSent
            ? "border-accent/30 bg-accent/10"
            : "border-border bg-panel pr-10",
          showModelBlend && "group/message cursor-default",
        )}
      >
        {!isSent && <CopyResponseButton content={message.content} />}
        {showModelBlend && (
          <ModelContributionHover contributions={message.modelContributions!} />
        )}
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
