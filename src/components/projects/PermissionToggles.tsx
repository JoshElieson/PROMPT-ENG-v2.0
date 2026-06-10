import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessIndicatorProps {
  enabled: boolean;
  toggling?: boolean;
}

export function AccessIndicator({ enabled, toggling = false }: AccessIndicatorProps) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center",
        "opacity-0 transition-opacity duration-200 group-hover:opacity-100",
        enabled && "opacity-100",
        toggling && "opacity-50",
      )}
      aria-hidden
    >
      <Check
        className={cn(
          "size-3.5 text-emerald-500 transition-all duration-200 ease-out dark:text-emerald-400",
          enabled ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </span>
  );
}