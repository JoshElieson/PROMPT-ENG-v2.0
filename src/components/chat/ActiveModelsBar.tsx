import { useMemo, type ReactNode } from "react";
import { AiProviderDock } from "@/components/chat/AiProviderDock";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useModelMode } from "@/contexts/ModelModeContext";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { getModelById, type AiModel } from "@/data/ai-models";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_MODELS = 3;

function ModelChip({
  model,
  highlighted = false,
}: {
  model: AiModel;
  highlighted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px]",
        highlighted
          ? "border-[#6366f1]/55 bg-[#6366f1]/14 text-foreground shadow-[inset_0_0_0_1px_rgba(99,102,241,0.24)]"
          : "border-border/75 bg-panel-elevated/62 text-foreground/85",
      )}
    >
      <ModelLogo orgId={model.orgId} size="xs" />
      {model.name}
    </span>
  );
}

export function ActiveModelsBar({
  trailing,
  showLayoutMenu = true,
  overlay = false,
  highlightIdsOverride,
}: {
  trailing?: ReactNode;
  /** When false, hides the layouts menu (used inside chat thread tabs). */
  showLayoutMenu?: boolean;
  /** When true, floats over chat content without a header background. */
  overlay?: boolean;
  /** Optional in-flight model ids to highlight (e.g. current speaker). */
  highlightIdsOverride?: string[];
}) {
  const { autoEnabled, setAutoEnabled, lastAutoPickedIds } = useModelMode();
  const { selectedIds, activeIds, toggleActive, activateOnlyModel, reorderSelectedIds } =
    useChatRoundTable();
  const displayIds = useMemo(() => {
    if (overlay) {
      return selectedIds;
    }
    if (autoEnabled) return selectedIds;
    return activeIds;
  }, [overlay, autoEnabled, selectedIds, activeIds]);

  const highlightedIds = useMemo(
    () =>
      highlightIdsOverride && highlightIdsOverride.length > 0
        ? new Set(highlightIdsOverride)
        : autoEnabled
          ? new Set(lastAutoPickedIds)
          : new Set<string>(),
    [highlightIdsOverride, autoEnabled, lastAutoPickedIds],
  );

  const models = useMemo(
    () =>
      displayIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [displayIds],
  );
  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);
  const primaryModel = useMemo(() => {
    const highlighted = models.find((m) => highlightedIds.has(m.id));
    if (highlighted) return highlighted;
    if (!autoEnabled) {
      const active = models.find((m) => activeSet.has(m.id));
      if (active) return active;
    }
    return models[0] ?? null;
  }, [models, highlightedIds, autoEnabled, activeSet]);

  if (models.length === 0 && !trailing && !showLayoutMenu) {
    return null;
  }

  const visibleModels = models.slice(0, MAX_VISIBLE_MODELS);
  const hiddenCount = Math.max(0, models.length - MAX_VISIBLE_MODELS);

  if (overlay) {
    if (models.length === 0 || primaryModel == null) return null;

    const handleOverlayModelClick = (id: string) => {
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
    };

    return (
      <AiProviderDock
        models={models}
        primaryModel={primaryModel}
        highlightedIds={highlightedIds}
        autoEnabled={autoEnabled}
        activeIds={activeIds}
        onModelClick={handleOverlayModelClick}
        onReorderModels={reorderSelectedIds}
      />
    );
  }

  return (
    <section
      data-ai-target="chat.model-selector"
      className={cn(
        "flex w-full items-center gap-2",
        "h-10 shrink-0 border-b border-border-subtle bg-panel/80 px-2 backdrop-blur-sm",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden",
        )}
      >
        {visibleModels.map((model) => (
          <ModelChip
            key={model.id}
            model={model}
            highlighted={highlightedIds.has(model.id)}
          />
        ))}
        {hiddenCount > 0 && (
          <span
            className="text-muted-foreground shrink-0 text-[11px] font-medium"
            title={`${hiddenCount} more model${hiddenCount === 1 ? "" : "s"} active`}
          >
            …
          </span>
        )}
      </span>

      {trailing ? (
        <div className={cn("shrink-0", overlay && "pointer-events-auto")}>
          {trailing}
        </div>
      ) : null}

      {showLayoutMenu ? (
        <div className={cn("shrink-0", overlay && "pointer-events-auto")}>
          <LayoutMenu />
        </div>
      ) : null}
    </section>
  );
}
