import { GitHubAuthStatus } from "@/components/auth/GitHubAuthStatus";

export function StatusBar() {
  return (
    <footer className="border-border-subtle bg-surface text-muted flex h-7 shrink-0 items-center justify-between gap-3 border-t px-3 text-[11px]">
      <span className="min-w-0 shrink truncate">
        <kbd className="text-muted-foreground">/</kbd> for commands
        <span className="text-border mx-2">·</span>
        <kbd className="text-muted-foreground">@</kbd> to add context
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-3">
        <GitHubAuthStatus />
        <span className="text-muted-foreground hidden items-center gap-1.5 sm:flex">
          <span className="bg-success h-1.5 w-1.5 rounded-full" />
          All systems operational
        </span>
      </span>
    </footer>
  );
}
