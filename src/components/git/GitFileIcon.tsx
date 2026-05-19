import { FileCode2, FileJson, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function GitFileIcon({ path, className }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const iconClass = cn("h-4 w-4 shrink-0", className);

  if (ext === "tsx" || ext === "jsx") {
    return <FileCode2 className={cn(iconClass, "text-sky-400")} />;
  }
  if (ext === "ts" || ext === "js") {
    return <FileCode2 className={cn(iconClass, "text-sky-300")} />;
  }
  if (ext === "rs") {
    return <Settings className={cn(iconClass, "text-orange-400")} />;
  }
  if (ext === "json") {
    return <FileJson className={cn(iconClass, "text-amber-400")} />;
  }
  return <FileText className={cn(iconClass, "text-muted-foreground")} />;
}
