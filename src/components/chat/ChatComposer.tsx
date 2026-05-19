import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
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
import { buildModelContributions } from "@/lib/round-table-weights";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSent?: () => void;
}

function readSelection(el: HTMLTextAreaElement | null, fallback: number) {
  if (!el) return { start: fallback, end: fallback };
  return { start: el.selectionStart, end: el.selectionEnd };
}

export function ChatComposer({ onSent }: ChatComposerProps) {
  const { sendMessage, isResponding } = useChats();
  const { selectedIds, activeIds, roundTableModels } = useRoundTable();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cartModels = useMemo(
    () =>
      selectedIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [selectedIds],
  );

  const mentionState = getMentionQuery(input, selection.start);
  const filteredModels = mentionState
    ? filterCartModels(mentionState.query, selectedIds)
    : [];
  const showMentionMenu =
    !mentionDismissed && mentionState != null && filteredModels.length > 0;

  const canSend =
    !isResponding && (input.trim().length > 0 || attachments.length > 0);

  const syncSelection = useCallback((el: HTMLTextAreaElement | null) => {
    setSelection(readSelection(el, input.length));
  }, [input.length]);

  const applySelectionToTextarea = useCallback((start: number, end: number) => {
    setSelection({ start, end });
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  }, []);

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
    setMentionDismissed(true);
    const el = textareaRef.current;
    const { start, end } = readSelection(el, input.length);
    const mentionText = buildMentionTextForModels(cartModels);
    const { value, cursor: nextCursor } = insertTextAtCursor(
      input,
      mentionText,
      start,
      end,
    );
    setInput(value);
    applySelectionToTextarea(nextCursor, nextCursor);
  }, [cartModels, input, applySelectionToTextarea]);

  const selectMention = useCallback(
    (model: AiModel) => {
      const el = textareaRef.current;
      const { start, end } = readSelection(el, selection.start);
      const activeMention = getMentionQuery(input, start);
      if (!activeMention) return;

      const { value, cursor: nextCursor } = applyMentionSelection(
        input,
        activeMention.start,
        end,
        model.id,
      );

      setInput(value);
      setMentionIndex(0);
      setMentionDismissed(true);
      setSelection({ start: nextCursor, end: nextCursor });

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [input, selection.start],
  );

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

    const weights = Object.fromEntries(
      roundTableModels.map((model) => [model.id, model.weight]),
    );
    const modelContributions = buildModelContributions(targets, weights);

    sendMessage({
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      targetModelIds: targets,
      modelContributions,
    });
    setInput("");
    setAttachments([]);
    setMentionDismissed(false);
    setSelection({ start: 0, end: 0 });
    onSent?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu) {
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
        setMentionDismissed(true);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (
    e: SyntheticEvent<HTMLTextAreaElement> & { currentTarget: HTMLTextAreaElement },
  ) => {
    const value = e.currentTarget.value;
    const { selectionStart, selectionEnd } = e.currentTarget;

    setInput(value);
    setSelection({ start: selectionStart, end: selectionEnd });
    setMentionIndex(0);
    setError(null);

    if (getMentionQuery(value, selectionStart)) {
      setMentionDismissed(false);
    }
  };

  return (
    <footer className="shrink-0 border-t border-border-subtle p-3">
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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => syncSelection(e.currentTarget)}
            onSelect={(e) => syncSelection(e.currentTarget)}
            onClick={(e) => syncSelection(e.currentTarget)}
            rows={2}
            placeholder="Ask anything… Type @ to mention models from your cart"
            className="w-full resize-none bg-transparent px-3 pt-2 pb-1.5 text-sm text-foreground placeholder:text-muted outline-none"
          />

          {error && (
            <p className="px-4 pb-2 text-xs text-red-400">{error}</p>
          )}

          <section className="flex items-center justify-between px-2.5 pb-2">
            <section className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Attach files"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => void handleAttach()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Mention all models in cart"
                className="h-7 w-7 text-muted-foreground"
                onClick={insertAllCartMentions}
              >
                <AtSign className="h-4 w-4" />
              </Button>
            </section>
            <Button
              type="button"
              size="icon"
              className="h-7 w-7"
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
