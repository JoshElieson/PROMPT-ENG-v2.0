import { Info } from "lucide-react";
import { ModelContributionRing } from "@/components/chat/ModelContributionRing";
import { ModelLogo } from "@/components/models/ModelLogo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            "text-muted-foreground/60 transition-colors",
            "hover:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          aria-label="Models used for this message"
        >
          <Info className="h-3 w-3" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="border-border bg-panel-elevated max-w-none p-0 shadow-lg"
      >
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
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
      </TooltipContent>
    </Tooltip>
  );
}
