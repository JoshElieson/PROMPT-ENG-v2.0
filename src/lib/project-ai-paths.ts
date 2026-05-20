import { basename } from "@/lib/fs";
import type { NodePermissions, Project } from "@/types/project";
import { DEFAULT_ROOT_PERMISSIONS } from "@/types/project";

function normalizePath(path: string): string {
  return path.replace(/[/\\]+$/, "");
}

function isStrictAncestor(ancestor: string, descendant: string): boolean {
  const a = normalizePath(ancestor);
  const d = normalizePath(descendant);
  if (a === d) return false;
  return d.startsWith(`${a}/`) || d.startsWith(`${a}\\`);
}

export function defaultPermissionsForProjects(
  projects: Project[],
): Record<string, NodePermissions> {
  const result: Record<string, NodePermissions> = {};
  for (const project of projects) {
    result[project.rootPath] = { ...DEFAULT_ROOT_PERMISSIONS };
  }
  return result;
}

/** Highest-level enabled paths (no other enabled path is an ancestor). */
export function getOutermostEnabledContextRoots(
  permissions: Record<string, NodePermissions> | undefined,
): { path: string; label: string }[] {
  if (!permissions) return [];

  const enabled = Object.entries(permissions)
    .filter(([, value]) => value.enabled)
    .map(([path]) => path);

  const outermost = enabled.filter(
    (path) => !enabled.some((other) => isStrictAncestor(other, path)),
  );

  return outermost.map((path) => ({ path, label: basename(path) }));
}
