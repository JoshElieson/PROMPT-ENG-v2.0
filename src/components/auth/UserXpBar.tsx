import { useUserXp } from "@/contexts/UserXpContext";
import { cn } from "@/lib/utils";

export function UserXpBar({ className }: { className?: string }) {
  const { level, levelFillRatio, barColor, isMaxLevel } = useUserXp();

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-foreground font-medium">Level {level}</span>
        <span className="text-muted tabular-nums">
          {isMaxLevel ? "Max" : `${Math.round(levelFillRatio * 100)}%`}
        </span>
      </div>
      <div
        className="bg-panel-elevated/80 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={isMaxLevel ? 100 : Math.round(levelFillRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress`}
      >
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-out"
          style={{
            width: `${isMaxLevel ? 100 : levelFillRatio * 100}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
