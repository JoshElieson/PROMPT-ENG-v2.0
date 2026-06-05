import { useCallback, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGit } from "@/contexts/GitContext";
import { replyToCommitChat, type CommitChatMessage } from "@/lib/commit-message";
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
  const { projectId } = useGit();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CommitChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pushAssistant = useCallback((msg: CommitChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: CommitChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsGenerating(true);
      try {
        pushAssistant(
          await replyToCommitChat(trimmed, changes, draft, projectId),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [changes, draft, projectId, pushAssistant],
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-border-subtle shrink-0 border-t">
      <div className="px-2 py-1">
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1 py-0.5 text-[11px] font-medium">
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Commit assistant
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="border-border-subtle bg-surface mx-2 mb-2 max-h-36 space-y-2 overflow-y-auto rounded border p-2"
        >
          {messages.length === 0 ? (
            <p className="text-muted text-[11px] leading-relaxed">
              Ask for a commit message based on your changes.
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
                <span className="text-muted font-medium">
                  {msg.role === "user" ? "You" : "Assistant"}:{" "}
                </span>
                {msg.content}
                {msg.suggestedCommit && (
                  <div className="border-border-subtle bg-panel mt-1.5 rounded border p-2">
                    <pre className="text-foreground font-sans text-[11px] whitespace-pre-wrap">
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
                void send(input);
              }
            }}
            placeholder="Generate a message or run git status, pull, push…"
            disabled={disabled || isGenerating}
            className="border-border-subtle bg-panel text-foreground focus:border-accent min-w-0 flex-1 rounded border px-2 py-1 text-[11px] outline-none"
          />
          <Button
            type="button"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={disabled || isGenerating || !input.trim()}
            onClick={() => void send(input)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
