import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUp, AtSign, Paperclip } from "lucide-react";
import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { MentionAutocomplete } from "@/components/chat/MentionAutocomplete";
import { Button } from "@/components/ui/button";
import { useRoundTable } from "@/context/RoundTableContext";
import { useChats } from "@/contexts/ChatsContext";
import { pickAttachmentsFromDialog } from "@/lib/attachments";
import {
  applyMentionSelection,
  buildMentionTextForModels,
  filterCartModels,
  getMentionQuery,
  hasModelMentions,
  insertTextAtCursor,
  resolveTargetModelIds,
} from "@/lib/mentions";
import { getModelById, type AiModel } from "@/data/ai-models";
import type { ChatAttachment } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSent?: () => void;
}

export function ChatComposer({ onSent }: ChatComposerProps) {
  const { sendMessage } = useChats();
  const { selectedIds, activeIds } = useRoundTable();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cartModels = useMemo(
    () =>
      selectedIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [selectedIds],
  );

  const cursor = textareaRef.current?.selectionStart ?? input.length;
  const mentionState = getMentionQuery(input, cursor);
  const filteredModels = mentionState
    ? filterCartModels(mentionState.query, selectedIds)
    : [];
  const showMentionMenu = mentionState != null;

  const canSend =
    input.trim().length > 0 || attachments.length > 0;

  const handleAttach = async () => {
    setError(null);
    try {
      const picked = await pickAttachmentsFromDialog();
      if (picked.length > 0) {
        setAttachments((prev) => [...prev, ...picked]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach files");
    }
  };

  const insertAllCartMentions = useCallback(() => {
    if (cartModels.length === 0) {
      setError("Add models to your Model Cart first");
      return;
    }
    setError(null);
    const el = textareaRef.current;
    const start = el?.selectionStart ?? input.length;
    const end = el?.selectionEnd ?? input.length;
    const mentionText = buildMentionTextForModels(cartModels);
    const { value, cursor: nextCursor } = insertTextAtCursor(
      input,
      mentionText,
      start,
      end,
    );
    setInput(value);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursor;
        textareaRef.current.selectionEnd = nextCursor;
      }
    });
  }, [cartModels, input]);

  const selectMention = (model: AiModel) => {
    if (!mentionState) return;
    const { value, cursor: nextCursor } = applyMentionSelection(
      input,
      mentionState.start,
      cursor,
      model.id,
    );
    setInput(value);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursor;
        textareaRef.current.selectionEnd = nextCursor;
      }
    });
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    const targets = resolveTargetModelIds(trimmed, selectedIds, activeIds);

    if (hasModelMentions(trimmed) && targets.length === 0) {
      setError("Mentioned models must be checked out in your Model Cart");
      return;
    }

    if (targets.length === 0) {
      setError("Select at least one model in the Model Cart or Round Table");
      return;
    }

    setError(null);
    sendMessage({
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      targetModelIds: targets,
    });
    setInput("");
    setAttachments([]);
    onSent?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredModels.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredModels.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + filteredModels.length) % filteredModels.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredModels[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setMentionIndex(0);
    setError(null);
  };

  return (
    <footer className="shrink-0 border-t border-border-subtle p-4">
      <section className="relative mx-auto max-w-2xl">
        {showMentionMenu && (
          <section className="absolute bottom-full left-0 right-0 z-20 mb-2 px-1">
            <MentionAutocomplete
              models={filteredModels}
              activeIndex={mentionIndex}
              onSelect={selectMention}
            />
          </section>
        )}

        <section
          className={cn(
            "border border-border bg-panel",
            "focus-within:border-foreground focus-within:outline focus-within:outline-1 focus-within:outline-offset-0 focus-within:outline-foreground",
          )}
        >
          <AttachmentChips
            attachments={attachments}
            onRemove={(id) =>
              setAttachments((prev) => prev.filter((f) => f.id !== id))
            }
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onSelect={() => setMentionIndex(0)}
            onClick={() => setMentionIndex(0)}
            rows={3}
            placeholder="Ask anything… Type @ to mention models from your cart"
            className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-foreground placeholder:text-muted outline-none"
          />

          {error && (
            <p className="px-4 pb-2 text-xs text-red-400">{error}</p>
          )}

          <section className="flex items-center justify-between px-3 pb-3">
            <section className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Attach files"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => void handleAttach()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Mention all models in cart"
                className="h-8 w-8 text-muted-foreground"
                onClick={insertAllCartMentions}
              >
                <AtSign className="h-4 w-4" />
              </Button>
            </section>
            <Button
              type="button"
              size="icon"
              className="h-8 w-8"
              disabled={!canSend}
              onClick={handleSend}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </section>
        </section>
      </section>
    </footer>
  );
}
