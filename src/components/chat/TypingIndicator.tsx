import { cn } from "@/lib/utils";

export function TypingIndicator({
  className,
  dotClassName,
}: {
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label="Loading"
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1 w-1 rounded-full bg-muted-foreground",
            "animate-bounce",
            dotClassName,
          )}
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

export function ThreadTabUnreadDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full bg-accent",
        className,
      )}
      aria-hidden
    />
  );
}
