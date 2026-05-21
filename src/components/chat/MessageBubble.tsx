import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { getModelById } from "@/data/ai-models";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { CodeSnippetBlock } from "@/components/chat/CodeSnippetBlock";
import { ModelContributionHover } from "@/components/chat/ModelContributionHover";
import { Button } from "@/components/ui/button";
import { parseMessageContent } from "@/lib/parse-message-content";
import { cn } from "@/lib/utils";

function TextWithMentions({
  content,
  isSent,
}: {
  content: string;
  isSent?: boolean;
}) {
  const parts = content.split(/(@[a-z0-9][a-z0-9_-]*)/gi);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
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

function MessageContent({
  content,
  isSent,
}: {
  content: string;
  isSent?: boolean;
}) {
  const segments = parseMessageContent(content);
  const hasCode = segments.some((s) => s.type === "code");

  if (!hasCode) {
    return <TextWithMentions content={content} isSent={isSent} />;
  }

  return (
    <div className="space-y-3">
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
          <TextWithMentions
            key={`text-${index}`}
            content={segment.content}
            isSent={isSent}
          />
        );
      })}
    </div>
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
          "relative",
          isSent
            ? "max-w-[85%] rounded-2xl border border-[#6366f1]/26 bg-[#2b3150]/55 px-4 py-3 shadow-[0_10px_20px_rgba(2,6,23,0.3)]"
            : "w-full max-w-2xl rounded-xl border border-border/70 bg-panel/35 pr-10 pl-3 pt-2 pb-3",
        )}
      >
        {!isSent && <CopyResponseButton content={message.content} />}
        <div className="flex items-start gap-1.5">
          {showModelBlend && (
            <ModelContributionHover
              contributions={message.modelContributions!}
              className="mt-0.5"
            />
          )}
          <div className="min-w-0 flex-1">
            {message.attachments && message.attachments.length > 0 && (
              <div className="-mx-1 mb-2">
                <AttachmentChips attachments={message.attachments} readonly />
              </div>
            )}
            <MessageContent content={message.content} isSent={isSent} />
          </div>
        </div>
      </section>
    </article>
  );
}
