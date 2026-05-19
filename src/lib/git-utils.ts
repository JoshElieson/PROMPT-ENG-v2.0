import type { GitStatusResult } from "@/types/git";

/** Working-tree change count for the SCM activity bar badge. */
export function getGitChangeCount(status: GitStatusResult | null): number {
  if (!status?.isRepo) return 0;
  return status.changes.length;
}

export function formatChangeBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}
