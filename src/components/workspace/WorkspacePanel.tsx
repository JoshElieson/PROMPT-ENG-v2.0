import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { workspacePanelClass } from "@/lib/workspace-panel";
import { cn } from "@/lib/utils";

export type WorkspacePanelProps = ComponentPropsWithoutRef<"section"> & {
  focused?: boolean;
  children: ReactNode;
};

/** Unified surface for chat, terminal, browser, and preview cells in the workspace grid. */
export function WorkspacePanel({
  focused = false,
  children,
  className,
  ...rest
}: WorkspacePanelProps) {
  return (
    <section className={cn(workspacePanelClass({ focused }), className)} {...rest}>
      {children}
    </section>
  );
}
