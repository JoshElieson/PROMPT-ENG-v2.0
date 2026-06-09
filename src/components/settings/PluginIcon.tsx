import type { LucideIcon } from "lucide-react";
import { getPluginLogo } from "@/data/plugin-logos";
import { cn } from "@/lib/utils";

interface PluginIconProps {
  pluginId: string;
  fallback: LucideIcon;
  className?: string;
}

export function PluginIcon({ pluginId, fallback: Fallback, className }: PluginIconProps) {
  const logo = getPluginLogo(pluginId);

  if (!logo) {
    return <Fallback className={cn("text-muted-foreground h-4 w-4", className)} />;
  }

  return (
    <img
      src={logo.src}
      alt=""
      draggable={false}
      className={cn("h-4 w-4 object-contain", className)}
    />
  );
}
