import { Settings2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AiProviderDock } from "@/components/chat/AiProviderDock";
import { ChatSettingsDialog } from "@/components/chat/ChatSettingsDialog";
import { useModelMode } from "@/contexts/ModelModeContext";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { getModelById, type AiModel } from "@/data/ai-models";
import { cn } from "@/lib/utils";

type ChatUtilityBarProps = {
  chatId: string;
  threadId: string;
  highlightIds?: string[];
  /** When false, only the chat settings control is shown (model dock lives on the chat pane overlay). */
  showModelDock?: boolean;
};

export function ChatUtilityBar({
  chatId,
  threadId,
  highlightIds = [],
  showModelDock = true,
}: ChatUtilityBarProps) {
  const { autoEnabled, setAutoEnabled } = useModelMode();
  const { selectedIds, activeIds, toggleActive, activateOnlyModel, reorderSelectedIds } =
    useChatRoundTable();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPortal, setSettingsPortal] = useState<HTMLElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const frame = requestAnimationFrame(() => {
      setSettingsPortal(
        barRef.current?.closest<HTMLElement>('[aria-label="Chat pane"]') ?? null,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [settingsOpen]);

  const highlightedSet = useMemo(() => new Set(highlightIds), [highlightIds]);
  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);
  const availableModels = useMemo(
    () =>
      selectedIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [selectedIds],
  );

  const primaryModel = useMemo(() => {
    const highlighted = availableModels.find((m) => highlightedSet.has(m.id));
    if (highlighted) return highlighted;
    if (!autoEnabled) {
      const active = availableModels.find((m) => activeSet.has(m.id));
      if (active) return active;
    }
    return availableModels[0] ?? null;
  }, [availableModels, highlightedSet, autoEnabled, activeSet]);

  const handleModelToggle = useCallback(
    (id: string) => {
      if (autoEnabled) {
        setAutoEnabled(false);
        activateOnlyModel(id);
        return;
      }

      if (activeSet.has(id)) {
        toggleActive(id);
        if (activeIds.length <= 1) {
          setAutoEnabled(true);
        }
        return;
      }

      toggleActive(id);
      setAutoEnabled(false);
    },
    [activateOnlyModel, activeIds.length, activeSet, autoEnabled, setAutoEnabled, toggleActive],
  );

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const showDock =
    showModelDock &&
    availableModels.length > 0 &&
    primaryModel != null;

  if (showModelDock && !showDock) return null;

  return (
    <div
      ref={barRef}
      className="relative z-[60] flex w-10 shrink-0 flex-col items-center justify-between self-stretch overflow-visible"
      aria-label="Chat utilities"
    >
      {settingsOpen && settingsPortal ? (
        <ChatSettingsDialog
          chatId={chatId}
          threadId={threadId}
          onClose={closeSettings}
          portalTarget={settingsPortal}
        />
      ) : null}
      {showDock ? (
        <AiProviderDock
          inline
          models={availableModels}
          primaryModel={primaryModel}
          highlightedIds={highlightedSet}
          autoEnabled={autoEnabled}
          activeIds={activeIds}
          onModelClick={handleModelToggle}
          onReorderModels={reorderSelectedIds}
        />
      ) : null}

      <div className="relative w-full shrink-0">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          data-ai-target="chat.settings.button"
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-xl border border-border/35",
            "bg-panel/72 text-muted-foreground shadow-[0_10px_28px_rgba(2,6,23,0.38)] backdrop-blur-md",
            "transition-all duration-150 hover:border-border-subtle hover:bg-white/[0.06] hover:text-foreground",
            "hover:shadow-[0_12px_32px_rgba(2,6,23,0.42),0_0_0_1px_rgba(99,102,241,0.14)]",
            settingsOpen &&
              "border-border-subtle text-foreground shadow-[0_14px_36px_rgba(2,6,23,0.45)]",
          )}
          aria-expanded={settingsOpen}
          aria-label="Chat settings"
          title="Chat settings"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
