import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PanelTitleInfoProps = {
  description: string;
  label: string;
  className?: string;
};

export function PanelTitleInfo({
  description,
  label,
  className,
}: PanelTitleInfoProps) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/80",
            "hover:bg-panel-elevated hover:text-muted-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-foreground",
            className,
          )}
          aria-label={`About ${label}`}
        >
          <Info className="h-3 w-3" strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
