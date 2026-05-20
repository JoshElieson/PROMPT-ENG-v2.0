import { useMemo, type ReactNode } from "react";
import { LayoutMenu } from "@/components/layout/LayoutMenu";
import { ModelLogo } from "@/components/models/ModelLogo";
import { useChatRoundTable } from "@/hooks/use-chat-round-table";
import { getModelById, type AiModel } from "@/data/ai-models";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_MODELS = 3;

function ModelChip({ model }: { model: AiModel }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-foreground/90">
      <ModelLogo orgId={model.orgId} size="xs" />
      {model.name}
    </span>
  );
}

export function ActiveModelsBar({
  trailing,
  showLayoutMenu = true,
  overlay = false,
}: {
  trailing?: ReactNode;
  /** When false, hides the layouts menu (used inside split panes). */
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

  return (
    <section
      className={cn(
        "flex w-full items-center gap-2",
        overlay
          ? "pointer-events-none absolute inset-x-0 top-0 z-10 px-2 pt-2"
          : "h-9 shrink-0 px-2",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden",
          overlay && "pointer-events-none",
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
