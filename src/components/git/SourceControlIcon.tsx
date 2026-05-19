import sourceControlIcon from "@/assets/source-control-icon.png";
import { formatChangeBadge } from "@/lib/git-utils";
import { cn } from "@/lib/utils";

interface SourceControlIconProps {
  className?: string;
  /** Uncommitted / working-tree changes on the current branch */
  changeCount?: number;
}

/**
 * Source control branch icon (user asset) with optional change-count badge.
 */
export function SourceControlIcon({
  className,
  changeCount = 0,
}: SourceControlIconProps) {
  const badge = formatChangeBadge(changeCount);
  const showBadge = badge.length > 0;

  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0", className)}>
      <span
        aria-hidden
        className="h-full w-full bg-current"
        style={{
          maskImage: `url(${sourceControlIcon})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskImage: `url(${sourceControlIcon})`,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
        }}
      />

      {showBadge && (
        <span
          className={cn(
            "absolute -bottom-1 -right-2.5 flex h-[13px] min-w-[13px] items-center justify-center",
            "bg-[#1d7bf5] px-0.5 text-[9px] font-semibold leading-none text-white",
          )}
          aria-hidden
        >
          {badge}
        </span>
      )}
    </span>
  );
}
