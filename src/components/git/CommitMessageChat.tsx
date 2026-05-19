import { useCallback, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  GENERATE_COMMIT_AI_TOOLTIP,
  generateCommitMessageWithAi,
  replyToCommitChat,
  type CommitChatMessage,
} from "@/lib/commit-message";
import type { GitFileChange } from "@/types/git";
import { cn } from "@/lib/utils";

interface CommitMessageChatProps {
  changes: GitFileChange[];
  draft: string;
  onApply: (message: string) => void;
  disabled?: boolean;
}

export function CommitMessageChat({
  changes,
  draft,
  onApply,
  disabled,
}: CommitMessageChatProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CommitChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pushAssistant = useCallback((msg: CommitChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: CommitChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      pushAssistant(replyToCommitChat(trimmed, changes, draft));
    },
    [changes, draft, pushAssistant],
  );

  const generate = useCallback(() => {
    setOpen(true);
    const suggested = generateCommitMessageWithAi(changes);
    setMessages((prev) => {
      if (prev.some((m) => m.role === "assistant" && m.suggestedCommit === suggested)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: "Generate a commit message from my changes",
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            changes.length === 0
              ? "No pending changes yet. Edit files in your project first."
              : "Suggested commit message from your changes:",
          suggestedCommit: changes.length > 0 ? suggested : undefined,
        },
      ];
    });
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [changes]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border-subtle">
      <div className="flex items-center justify-between px-2 py-1">
        <CollapsibleTrigger className="flex flex-1 items-center gap-1 px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Commit assistant
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-accent"
          title={GENERATE_COMMIT_AI_TOOLTIP}
          disabled={disabled}
          onClick={generate}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="mx-2 mb-2 max-h-36 space-y-2 overflow-y-auto rounded border border-border-subtle bg-surface p-2"
        >
          {messages.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-muted">
              Ask for a message, or click{" "}
              <Sparkles className="inline h-3 w-3 text-accent" /> Generate using AI.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "text-[11px] leading-relaxed",
                  msg.role === "user" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="font-medium text-muted">
                  {msg.role === "user" ? "You" : "Assistant"}:{" "}
                </span>
                {msg.content}
                {msg.suggestedCommit && (
                  <div className="mt-1.5 rounded border border-border-subtle bg-panel p-2">
                    <pre className="whitespace-pre-wrap font-sans text-[11px] text-foreground">
                      {msg.suggestedCommit}
                    </pre>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-1.5 h-6 text-[10px]"
                      onClick={() => onApply(msg.suggestedCommit!)}
                    >
                      Use message
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-1 px-2 pb-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about your commit…"
            disabled={disabled}
            className="min-w-0 flex-1 rounded border border-border-subtle bg-panel px-2 py-1 text-[11px] text-foreground outline-none focus:border-accent"
          />
          <Button
            type="button"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={disabled || !input.trim()}
            onClick={() => send(input)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
