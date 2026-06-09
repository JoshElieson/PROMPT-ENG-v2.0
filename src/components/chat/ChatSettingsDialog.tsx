import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChatSettingsPanel } from "@/components/chat/ChatSettingsPanel";
import { cn } from "@/lib/utils";

type ChatSettingsDialogProps = {
  chatId: string;
  threadId: string;
  onClose: () => void;
  /** When set, the dialog is positioned within this element instead of the viewport. */
  portalTarget?: HTMLElement | null;
};

export function ChatSettingsDialog({
  chatId,
  threadId,
  onClose,
  portalTarget,
}: ChatSettingsDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const positionedInPortal = portalTarget != null;

  const dialog = (
    <div
      className={cn(
        "z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200",
        positionedInPortal ? "absolute inset-0" : "fixed inset-0",
      )}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/45 backdrop-blur-[1px]"
        aria-label="Close chat settings"
        onClick={onClose}
      />
      <section
        className={cn(
          "relative z-10 flex max-h-[min(32rem,calc(100%-2rem))] w-[min(26rem,calc(100%-2rem))] flex-col rounded-xl",
          "border border-border/60 bg-panel/92 shadow-[0_18px_40px_rgba(2,6,23,0.46)] backdrop-blur-lg",
          "animate-in zoom-in-95 duration-200 ease-out",
        )}
        role="dialog"
        aria-label="Chat settings"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/45 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">Chat settings</p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-panel-elevated/85 hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
            aria-label="Close chat settings"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </header>
        <ChatSettingsPanel key={`${chatId}:${threadId}`} chatId={chatId} threadId={threadId} />
      </section>
    </div>
  );

  if (portalTarget) {
    return createPortal(dialog, portalTarget);
  }

  return createPortal(dialog, document.body);
}
