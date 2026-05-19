import { ModelContributionRing } from "@/components/chat/ModelContributionRing";
import { ModelLogo } from "@/components/models/ModelLogo";
import { getModelById } from "@/data/ai-models";
import type { ModelContribution } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ModelContributionHoverProps {
  contributions: ModelContribution[];
  className?: string;
}

export function ModelContributionHover({
  contributions,
  className,
}: ModelContributionHoverProps) {
  if (contributions.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-full left-0 z-20 mb-2",
        "opacity-0 transition-opacity duration-150",
        "group-hover/message:opacity-100",
        className,
      )}
      role="tooltip"
      aria-label="Model blend for this response"
    >
      <div className="flex flex-wrap items-center gap-3 border border-border bg-panel-elevated px-3 py-2.5 shadow-lg">
        {contributions.map((entry) => {
          const model = getModelById(entry.modelId);
          if (!model) return null;

          return (
            <div key={entry.modelId} className="flex items-center gap-2">
              <ModelLogo orgId={model.orgId} size="sm" />
              <ModelContributionRing
                percentage={entry.percentage}
                color={model.color}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
