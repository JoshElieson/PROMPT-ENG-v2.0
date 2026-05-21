import { Plus } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useLayout } from "@/contexts/LayoutContext";
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px]",
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

function OverlayModelBadge({
  model,
  highlighted = false,
  active = false,
  onClick,
}: {
  model: AiModel;
  highlighted?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border bg-panel/90 shadow-[0_6px_16px_rgba(2,6,23,0.28)] backdrop-blur-sm transition-colors",
        active && "bg-[#6366f1]/16",
        highlighted
          ? "border-[#6366f1]/70 shadow-[0_0_0_1px_rgba(99,102,241,0.45),0_6px_16px_rgba(2,6,23,0.28)]"
          : "border-border/75 hover:border-[#6366f1]/45",
      )}
      title={model.name}
      aria-label={model.name}
      aria-pressed={active}
      onClick={onClick}
    >
      <ModelLogo orgId={model.orgId} size="sm" muted={!active} />
    </button>
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
  const { selectedIds, activeIds, toggleActive, activateOnlyModel } =
    useChatRoundTable();
  const { setLeftSidebarViewVisible } = useLayout();

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

  if (models.length === 0 && !trailing && !showLayoutMenu) {
    return null;
  }

  const visibleModels = models.slice(0, MAX_VISIBLE_MODELS);
  const hiddenCount = Math.max(0, models.length - MAX_VISIBLE_MODELS);

  if (overlay) {
    if (models.length === 0) return null;
    const activeSet = new Set(activeIds);

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
      <section className="pointer-events-none absolute bottom-[calc(var(--spacing-workspace-dock)+0.5rem)] left-0 z-10 p-2">
        <div className="pointer-events-auto relative pt-7">
          <button
            type="button"
            title="Open Model Cart"
            aria-label="Open Model Cart"
            onClick={() => setLeftSidebarViewVisible("agents", true)}
            className="border-border/70 bg-panel-elevated/95 text-foreground/90 hover:border-border hover:bg-panel hover:text-foreground absolute top-0 left-1/2 inline-flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border shadow-[0_6px_14px_rgba(2,6,23,0.3)] transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>

          <div className="flex flex-col-reverse gap-1.5">
            {models.map((model) => (
              <OverlayModelBadge
                key={model.id}
                model={model}
                highlighted={highlightedIds.has(model.id)}
                active={!autoEnabled && activeSet.has(model.id)}
                onClick={() => handleOverlayModelClick(model.id)}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
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
