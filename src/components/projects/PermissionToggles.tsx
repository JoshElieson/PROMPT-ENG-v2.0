import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessCheckboxProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function AccessCheckbox({ enabled, onChange }: AccessCheckboxProps) {
  return (
    <label
      title="Give AI full access — context, read & write"
      className={cn(
        "relative flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center",
        "opacity-0 transition-all group-hover:opacity-100",
        enabled && "opacity-100",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center border transition-all",
          "border-border bg-panel-elevated",
          "peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-0 peer-focus-visible:outline-foreground",
          "peer-hover:border-muted-foreground/50",
          "peer-checked:border-foreground peer-checked:bg-foreground",
        )}
      >
        <Check
          className={cn(
            "h-2.5 w-2.5 text-black transition-all duration-150",
            enabled ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
          strokeWidth={3}
        />
      </span>
    </label>
  );
}
