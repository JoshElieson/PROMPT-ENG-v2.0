import { GitHubAuthStatus } from "@/components/auth/GitHubAuthStatus";

export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-border-subtle bg-surface px-3 text-[11px] text-muted">
      <span className="min-w-0 shrink truncate">
        <kbd className="text-muted-foreground">/</kbd> for commands
        <span className="mx-2 text-border">·</span>
        <kbd className="text-muted-foreground">@</kbd> to add context
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-3">
        <GitHubAuthStatus />
        <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          All systems operational
        </span>
      </span>
    </footer>
  );
}
