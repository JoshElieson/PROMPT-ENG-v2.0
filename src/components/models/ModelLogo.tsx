import { getOrgLogo } from "@/data/model-logos";
import { modelOrgs } from "@/data/ai-models";
import { cn } from "@/lib/utils";

interface ModelLogoProps {
  orgId: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  muted?: boolean;
}

const sizeClasses = {
  xs: "h-4 w-4 rounded p-0.5",
  sm: "h-6 w-6 rounded-md p-1",
  md: "h-8 w-8 rounded-lg p-1.5",
};

export function ModelLogo({ orgId, size = "md", className, muted }: ModelLogoProps) {
  const src = getOrgLogo(orgId);
  const org = modelOrgs.find((o) => o.id === orgId);
  const label = org?.name ?? orgId;

  if (!src) {
    return (
      <span
        className={cn(
          "flex shrink-0 select-none items-center justify-center bg-panel-elevated text-[10px] font-bold text-muted",
          sizeClasses[size],
          className,
        )}
        aria-hidden
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 select-none items-center justify-center bg-terminal ring-1 ring-border-subtle",
        sizeClasses[size],
        muted && "opacity-50 grayscale",
        className,
      )}
      title={label}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full select-none object-contain"
        draggable={false}
      />
    </span>
  );
}
