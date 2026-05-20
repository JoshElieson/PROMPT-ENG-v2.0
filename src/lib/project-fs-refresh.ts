import { normalizeFsPath, isPathUnderRoot, pathsEqual } from "@/lib/project-paths";

export function parentDirectory(path: string): string | null {
  const normalized = normalizeFsPath(path);
  const sep = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\"),
  );
  if (sep <= 0) return null;
  return normalized.slice(0, sep);
}

/** Directories whose cached listings should reload after external changes. */
export function directoriesToReloadAfterChange(
  changedPaths: string[],
  loadedDirs: string[],
): string[] {
  const toReload = new Set<string>();

  for (const changed of changedPaths) {
    const parent = parentDirectory(changed);
    if (parent) toReload.add(parent);

    for (const dir of loadedDirs) {
      if (
        isPathUnderRoot(dir, changed) ||
        isPathUnderRoot(changed, dir) ||
        pathsEqual(dir, changed)
      ) {
        toReload.add(dir);
      }
    }
  }

  return [...toReload];
}

/** Expanded folders that no longer exist (or are under a removed path). */
export function expandedPathsToPrune(
  changedPaths: string[],
  expandedPaths: ReadonlySet<string>,
): string[] {
  const toRemove: string[] = [];
  for (const expanded of expandedPaths) {
    for (const changed of changedPaths) {
      if (
        pathsEqual(expanded, changed) ||
        isPathUnderRoot(changed, expanded)
      ) {
        toRemove.push(expanded);
        break;
      }
    }
  }
  return toRemove;
}
