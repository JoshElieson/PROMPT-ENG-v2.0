import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderDown,
  GitBranch,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { GitIcon } from "@/components/git/GitIcon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { useGit } from "@/contexts/GitContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { pickProjectDirectory } from "@/lib/fs";
import type { GitFileChange, GitFileStatus } from "@/types/git";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<GitFileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "U",
  conflicted: "!",
};

function StatusBadge({ status }: { status: GitFileStatus }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold",
        status === "untracked" && "text-muted",
        status === "added" && "text-success",
        status === "deleted" && "text-red-400",
        status === "modified" && "text-amber-400",
        status === "conflicted" && "text-red-500",
        status === "renamed" && "text-sky-400",
      )}
      title={status}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function ChangeRow({ change }: { change: GitFileChange }) {
  return (
    <motionless
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-panel-elevated"
      title={change.path}
    >
      <StatusBadge status={change.status} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {change.path}
      </span>
    </motionless>
  );
}
