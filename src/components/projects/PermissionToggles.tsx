import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessCheckboxProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}

export function AccessCheckbox({
  enabled,
  disabled = false,
  onChange,
}: AccessCheckboxProps) {
  return (
    <label
      title="Give AI full access — context, read & write"
      className={cn(
        "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center",
        "opacity-0 transition-opacity duration-200 group-hover:opacity-100",
        enabled && "opacity-100",
        disabled ? "cursor-wait opacity-50" : "cursor-pointer",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={enabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-lg border transition-all duration-200 ease-out",
          "border-white/[0.12] bg-black/35 shadow-inner shadow-black/20",
          "peer-hover:border-white/25 peer-hover:bg-white/[0.06]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/45 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-checked:border-accent/80 peer-checked:bg-accent peer-checked:shadow-md peer-checked:shadow-accent/25",
          "peer-disabled:pointer-events-none peer-disabled:opacity-40",
        )}
      >
        <Check
          className={cn(
            "size-3 text-white transition-all duration-200 ease-out",
            enabled ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </span>
    </label>
  );
}
