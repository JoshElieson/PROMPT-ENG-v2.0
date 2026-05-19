import { Loader2 } from "lucide-react";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Variant = "statusbar" | "menu";

interface GitHubAuthStatusProps {
  variant?: Variant;
  className?: string;
}

export function GitHubAuthStatus({
  variant = "statusbar",
  className,
}: GitHubAuthStatusProps) {
  const { session, isLoggingIn, deviceFlow, isHydrated, isConfigured } = useAuth();

  const isMenu = variant === "menu";

  if (!isHydrated) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-muted",
          isMenu && "w-full rounded border border-border-subtle bg-surface px-2.5 py-2",
          className,
        )}
      >
        <GitHubIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className={isMenu ? "text-xs" : "text-[11px]"}>GitHub: Loading…</span>
      </span>
    );
  }

  if (isLoggingIn || deviceFlow) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-amber-400/90",
          isMenu && "w-full rounded border border-amber-400/25 bg-amber-400/5 px-2.5 py-2",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        <GitHubIcon className="h-3.5 w-3.5 shrink-0" />
        <span className={cn("min-w-0", isMenu ? "text-xs font-medium" : "text-[11px]")}>
          {isMenu
            ? "Finishing GitHub sign-in…"
            : "GitHub: Finishing sign-in…"}
        </span>
      </span>
    );
  }

  if (session) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-foreground",
          isMenu &&
            "w-full rounded border border-success/30 bg-success/5 px-2.5 py-2",
          className,
        )}
        title={`Signed in to GitHub as ${session.user.login}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        {session.user.avatar_url ? (
          <img
            src={session.user.avatar_url}
            alt=""
            className={cn(
              "shrink-0 rounded-full object-cover",
              isMenu ? "h-5 w-5" : "h-3.5 w-3.5",
            )}
          />
        ) : (
          <GitHubIcon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className={cn("min-w-0 truncate", isMenu ? "text-xs" : "text-[11px]")}>
          {isMenu ? (
            <>
              <span className="font-medium text-success">Signed in</span>
              <span className="text-muted"> · @{session.user.login}</span>
            </>
          ) : (
            <>
              <span className="text-success">Signed in</span>
              <span className="text-muted-foreground"> · @{session.user.login}</span>
            </>
          )}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        isMenu && "w-full rounded border border-border-subtle bg-surface px-2.5 py-2",
        className,
      )}
      title={
        isConfigured
          ? "Not signed in to GitHub"
          : "GitHub sign-in is not configured"
      }
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-muted/80" />
      <GitHubIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className={isMenu ? "text-xs" : "text-[11px]"}>
        {isMenu ? (
          <>
            <span className="font-medium text-muted-foreground">Not signed in</span>
            <span className="text-muted"> · GitHub</span>
          </>
        ) : (
          <>GitHub: Not signed in</>
        )}
      </span>
    </span>
  );
}
