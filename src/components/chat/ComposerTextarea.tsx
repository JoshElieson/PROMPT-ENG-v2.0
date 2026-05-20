import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
  type DragEvent,
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
  readOnly?: boolean;
  /** Minimum visible lines (empty composer). */
  minRows?: number;
  /** Lines before the textarea scrolls instead of growing. */
  maxRows?: number;
  onChange: (
    e: SyntheticEvent<HTMLTextAreaElement> & {
      currentTarget: HTMLTextAreaElement;
    },
  ) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onSelect?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onClick?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onFocus?: (e: SyntheticEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDragEnter?: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDragOver?: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: DragEvent<HTMLTextAreaElement>) => void;
}

export const ComposerTextarea = forwardRef<
  ComposerTextareaHandle,
  ComposerTextareaProps
>(function ComposerTextarea(
  {
    value,
    cartIds,
    placeholder,
    readOnly = false,
    minRows = 1,
    maxRows = 12,
    onChange,
    onKeyDown,
    onKeyUp,
    onSelect,
    onClick,
    onFocus,
    onPaste,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
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

  const resizeToContent = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const style = getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

    const paddingY =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const minHeight = lineHeight * minRows + paddingY;
    const maxHeight = lineHeight * maxRows + paddingY;
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight,
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";

    if (highlight) {
      highlight.style.height = `${nextHeight}px`;
      highlight.style.overflowY = textarea.style.overflowY;
    }
  }, [minRows, maxRows]);

  useLayoutEffect(() => {
    resizeToContent();
  }, [value, resizeToContent]);

  const handleChange = useCallback(
    (
      e: SyntheticEvent<HTMLTextAreaElement> & {
        currentTarget: HTMLTextAreaElement;
      },
    ) => {
      onChange(e);
      requestAnimationFrame(resizeToContent);
    },
    [onChange, resizeToContent],
  );

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
                    ? "rounded-sm bg-[#6366f1]/14 font-medium text-[#c7d2fe]"
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
        rows={minRows}
        spellCheck
        placeholder={placeholder}
        readOnly={readOnly}
        aria-busy={readOnly}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          syncScroll();
          onKeyUp?.(e);
        }}
        onScroll={syncScroll}
        onSelect={onSelect}
        onClick={onClick}
        onFocus={onFocus}
        onPaste={onPaste}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          composerTextClass,
          "text-transparent caret-foreground selection:bg-[#6366f1]/22 selection:text-transparent",
          readOnly && "cursor-not-allowed opacity-70",
        )}
      />
    </div>
  );
});
