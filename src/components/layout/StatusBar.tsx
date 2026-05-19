export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border-subtle bg-surface px-3 text-[11px] text-muted">
      <span>
        <kbd className="text-muted-foreground">/</kbd> for commands
        <span className="mx-2 text-border">·</span>
        <kbd className="text-muted-foreground">@</kbd> to add context
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        All systems operational
      </span>
    </footer>
  );
}
