import { Database } from "lucide-react";
import { PluginIcon } from "@/components/settings/PluginIcon";
import { SUPABASE_PLUGIN_ID } from "@/lib/installed-plugins";

interface SupabaseConfigureHintProps {
  onClick: () => void;
}

export function SupabaseConfigureHint({ onClick }: SupabaseConfigureHintProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#6366f1]/25 bg-[#6366f1]/8 px-2 py-0.5 text-[11px] font-medium text-foreground/90 shadow-sm transition-colors hover:bg-[#6366f1]/12"
      aria-label="Configure Supabase"
    >
      <PluginIcon
        pluginId={SUPABASE_PLUGIN_ID}
        fallback={Database}
        className="h-3 w-3 shrink-0"
      />
      <span>Configure Supabase</span>
    </button>
  );
}
