import { PlugZap } from "lucide-react";
import { PluginIcon } from "@/components/settings/PluginIcon";
import type { PluginPlaceholder } from "@/data/plugins";

interface PluginInstallHintProps {
  plugin: PluginPlaceholder;
}

export function PluginInstallHint({ plugin }: PluginInstallHintProps) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#6366f1]/25 bg-[#6366f1]/8 px-2 py-0.5 text-[11px] font-medium text-foreground/90 shadow-sm transition-colors hover:bg-[#6366f1]/12"
      role="status"
      aria-live="polite"
      aria-label={`Add ${plugin.name}`}
    >
      <PluginIcon
        pluginId={plugin.id}
        fallback={plugin.icon ?? PlugZap}
        className="h-3 w-3 shrink-0"
      />
      <span>Add {plugin.name}</span>
    </button>
  );
}
