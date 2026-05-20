import { useMemo, type ReactNode } from "react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { getModelById, type AiModel } from "@/data/ai-models";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_MODELS = 3;

function ModelChip({ model }: { model: AiModel }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border/75 bg-panel-elevated/62 px-2 py-1 text-[11px] text-foreground/85">
      <ModelLogo orgId={model.orgId} size="xs" />
      {model.name}
    </span>
  );
}

function OverlayModelBadge({ model }: { model: AiModel }) {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/75 bg-panel/90 shadow-[0_6px_16px_rgba(2,6,23,0.28)] backdrop-blur-sm"
      title={model.name}
      aria-label={model.name}
    >
      <ModelLogo orgId={model.orgId} size="sm" />
    </span>
  );
}

export function ActiveModelsBar({
  trailing,
  showLayoutMenu = true,
  overlay = false,
}: {
  trailing?: ReactNode;
  /** When false, hides the layouts menu (used inside chat thread tabs). */
  showLayoutMenu?: boolean;
  /** When true, floats over chat content without a header background. */
  overlay?: boolean;
}) {
  const { activeIds } = useChatRoundTable();

  const models = useMemo(
    () =>
      activeIds
        .map((id) => getModelById(id))
        .filter((m): m is AiModel => m != null),
    [activeIds],
  );

  if (models.length === 0 && !trailing && !showLayoutMenu) {
    return null;
  }

  const visibleModels = models.slice(0, MAX_VISIBLE_MODELS);
  const hiddenCount = Math.max(0, models.length - MAX_VISIBLE_MODELS);

  if (overlay) {
    return (
      <section className="pointer-events-none absolute bottom-[calc(var(--spacing-workspace-dock)+0.5rem)] left-0 z-10 p-2">
        <div className="pointer-events-auto flex flex-col-reverse gap-1.5">
          {models.map((model) => (
            <OverlayModelBadge key={model.id} model={model} />
          ))}
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
          <ModelChip key={model.id} model={model} />
        ))}
        {hiddenCount > 0 && (
          <span
            className="shrink-0 text-[11px] font-medium text-muted-foreground"
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
