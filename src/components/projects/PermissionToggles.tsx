import type { NodePermissions } from "@/types/project";
import { cn } from "@/lib/utils";

interface PermissionTogglesProps {
  permissions: NodePermissions;
  onChange: (patch: Partial<NodePermissions>) => void;
  compact?: boolean;
}

export function PermissionToggles({
  permissions,
  onChange,
  compact = true,
}: PermissionTogglesProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        (permissions.inContext || permissions.canRead || permissions.canWrite) &&
          "opacity-100",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <label
        title="Include in AI context"
        className={cn(
          "flex cursor-pointer items-center rounded px-0.5",
          compact && "text-[9px] font-semibold",
        )}
      >
        <input
          type="checkbox"
          checked={permissions.inContext}
          onChange={(e) => onChange({ inContext: e.target.checked })}
          className="h-3 w-3 rounded border-border bg-panel accent-accent"
        />
        {!compact && <span className="ml-1 text-muted">Ctx</span>}
      </label>
      <label
        title="Allow read access"
        className={cn(
          "flex cursor-pointer items-center rounded px-0.5 text-[9px] font-semibold text-muted-foreground",
        )}
      >
        <input
          type="checkbox"
          checked={permissions.canRead}
          onChange={(e) => onChange({ canRead: e.target.checked })}
          className="h-3 w-3 rounded border-border bg-panel accent-accent"
        />
        <span className="ml-0.5">R</span>
      </label>
      <label
        title="Allow write access"
        className={cn(
          "flex cursor-pointer items-center rounded px-0.5 text-[9px] font-semibold text-muted-foreground",
        )}
      >
        <input
          type="checkbox"
          checked={permissions.canWrite}
          onChange={(e) => onChange({ canWrite: e.target.checked })}
          className="h-3 w-3 rounded border-border bg-panel accent-accent"
        />
        <span className="ml-0.5">W</span>
      </label>
    </span>
  );
}
