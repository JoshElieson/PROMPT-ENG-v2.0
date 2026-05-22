import { basename } from "@/lib/fs";
import { DEFAULT_PERMISSIONS, type NodePermissions } from "@/types/project";

function normalizePath(path: string): string {
  return path.replace(/[/\\]+$/, "");
}

function isStrictAncestor(ancestor: string, descendant: string): boolean {
  const a = normalizePath(ancestor);
  const d = normalizePath(descendant);
  if (a === d) return false;
  return d.startsWith(`${a}/`) || d.startsWith(`${a}\\`);
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

function pathsUnderRoot(
  permissions: Record<string, NodePermissions>,
  rootPath: string,
): string[] {
  return Object.keys(permissions).filter(
    (key) =>
      key === rootPath ||
      key.startsWith(`${rootPath}\\`) ||
      key.startsWith(`${rootPath}/`),
  );
}

/** Disable AI context for a root path and any tracked descendants. */
export function disableContextRoot(
  permissions: Record<string, NodePermissions>,
  rootPath: string,
): Record<string, NodePermissions> {
  const next = { ...permissions };
  for (const path of pathsUnderRoot(next, rootPath)) {
    next[path] = { ...(next[path] ?? DEFAULT_PERMISSIONS), enabled: false };
  }
  return next;
}
