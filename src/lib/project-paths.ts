import type { Project } from "@/types/project";

function normalizeKey(path: string): string {
  return normalizeFsPath(path).toLowerCase();
}

export function normalizeFsPath(path: string): string {
  return path.replace(/[/\\]+$/, "");
}

export function pathsEqual(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}

/** True when `path` is the root or a descendant of `rootPath`. */
export function isPathUnderRoot(rootPath: string, path: string): boolean {
  const root = normalizeKey(rootPath);
  const target = normalizeKey(path);
  if (target === root) return true;
  return target.startsWith(`${root}/`) || target.startsWith(`${root}\\`);
}

/** Project whose root contains `path` (prefers the longest matching root). */
export function findOwningProject(
  projects: Project[],
  path: string,
): Project | null {
  const matches = projects.filter((p) => isPathUnderRoot(p.rootPath, path));
  if (matches.length === 0) return null;
  return matches.reduce((best, p) =>
    p.rootPath.length > best.rootPath.length ? p : best,
  );
}

/** Directory paths to expand so `targetPath` is visible under `projectRoot`. */
export function pathsToExpandToReveal(
  projectRoot: string,
  targetPath: string,
): string[] {
  if (!isPathUnderRoot(projectRoot, targetPath)) return [];
  if (pathsEqual(projectRoot, targetPath)) return [];

  const root = normalizeFsPath(projectRoot);
  const target = normalizeFsPath(targetPath);
  const expand: string[] = [root];
  let current = root;
  while (!pathsEqual(current, target)) {
    const rest = target.slice(current.length).replace(/^[/\\]+/, "");
    const sepIdx = rest.search(/[/\\]/);
    const segment = sepIdx === -1 ? rest : rest.slice(0, sepIdx);
    if (!segment) break;
    const sep = current.includes("\\") ? "\\" : "/";
    const next = `${current}${sep}${segment}`;
    if (!pathsEqual(next, target)) {
      expand.push(next);
    }
    current = next;
  }
  return expand;
}

/** Relative path from project root (sync; used for drag-and-drop). */
export function relativePathFromRootSync(
  rootPath: string,
  path: string,
): string {
  if (!isPathUnderRoot(rootPath, path)) {
    return normalizeFsPath(path);
  }
  const root = normalizeFsPath(rootPath);
  const target = normalizeFsPath(path);
  if (pathsEqual(root, target)) return ".";
  const rest = target.slice(root.length).replace(/^[/\\]+/, "");
  return rest.replace(/\\/g, "/");
}
