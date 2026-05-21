/** Path segments we ignore for filesystem-driven UI refresh (build/cache dirs). */
const IGNORED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".svn",
  "target",
  "dist",
  "build",
  ".next",
  "__pycache__",
  "incremental",
  ".cursor",
  ".tauri",
  "coverage",
  ".vite",
  "out",
]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

/** True when the path is inside `.git` metadata (not normal working-tree files). */
export function isGitMetadataPath(path: string): boolean {
  return normalizePath(path).includes("/.git/");
}

/** True when the path is under a build/cache directory that should not drive git refresh. */
export function pathHasIgnoredSegment(path: string): boolean {
  const segments = normalizePath(path).split("/");
  return segments.some((segment) => {
    if (!segment) return false;
    if (IGNORED_SEGMENTS.has(segment)) return true;
    return (
      segment.startsWith(".") && segment !== ".env" && segment !== ".cursor"
    );
  });
}

/** Whether a debounced filesystem batch should trigger a git status refresh. */
export function shouldRefreshGitFromFsPaths(paths: string[]): boolean {
  if (paths.length === 0) return false;
  return paths.some(
    (path) => !isGitMetadataPath(path) && !pathHasIgnoredSegment(path),
  );
}
