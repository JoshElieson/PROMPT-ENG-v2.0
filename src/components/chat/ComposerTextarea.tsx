import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { splitComposerMentionSegments } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const composerTextClass =
  "w-full resize-none bg-transparent px-3 pt-2 pb-1.5 text-sm leading-relaxed outline-none";

export interface ComposerTextareaHandle {
  focus: () => void;
  setSelectionRange: (start: number, end: number) => void;
  getElement: () => HTMLTextAreaElement | null;
}

interface ComposerTextareaProps {
  value: string;
  cartIds: string[];
  placeholder?: string;
  rows?: number;
  onChange: (
    e: SyntheticEvent<HTMLTextAreaElement> & {
      currentTarget: HTMLTextAreaElement;
    },
  ) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onSelect?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onClick?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
}

export const ComposerTextarea = forwardRef<
  ComposerTextareaHandle,
  ComposerTextareaProps
>(function ComposerTextarea(
  {
    value,
    cartIds,
    placeholder,
    rows = 2,
    onChange,
    onKeyDown,
    onKeyUp,
    onSelect,
    onClick,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const segments = useMemo(
    () => splitComposerMentionSegments(value, cartIds),
    [value, cartIds],
  );

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setSelectionRange: (start, end) =>
      textareaRef.current?.setSelectionRange(start, end),
    getElement: () => textareaRef.current,
  }));

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea || !highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }, []);

  return (
    <div className="relative grid [&>*]:col-start-1 [&>*]:row-start-1">
      <div
        ref={highlightRef}
        aria-hidden
        className={cn(
          composerTextClass,
          "pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-foreground/90",
        )}
      >
        {segments.map((segment, index) => {
            if (segment.kind === "text") {
              return <span key={index}>{segment.value}</span>;
            }
            return (
              <span
                key={index}
                className={cn(
                  segment.model
                    ? "rounded-sm bg-sky-500/15 font-medium text-sky-400"
                    : "text-foreground/90",
                )}
              >
                {segment.raw}
              </span>
            );
          })}
      </div>

      <textarea
        ref={textareaRef}
        data-composer-textarea
        value={value}
        rows={rows}
        spellCheck
        placeholder={placeholder}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          syncScroll();
          onKeyUp?.(e);
        }}
        onScroll={syncScroll}
        onSelect={onSelect}
        onClick={onClick}
        className={cn(
          composerTextClass,
          "text-transparent caret-foreground selection:bg-sky-500/25 selection:text-transparent",
        )}
      />
    </div>
  );
});
