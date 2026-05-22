import { Loader2 } from "lucide-react";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Variant = "statusbar" | "menu";

interface GitHubAuthStatusProps {
  variant?: Variant;
  className?: string;
}

function providerLabel(provider: "github" | "google"): string {
  return provider === "google" ? "Google" : "GitHub";
}

export function GitHubAuthStatus({
  variant = "statusbar",
  className,
}: GitHubAuthStatusProps) {
  const {
    session,
    isLoggingIn,
    deviceFlow,
    isHydrated,
    isGitHubConfigured,
    isGoogleConfigured,
    loginProvider,
  } = useAuth();

  const isMenu = variant === "menu";
  const activeProvider = session?.provider ?? loginProvider ?? "github";
  const ProviderIcon = activeProvider === "google" ? GoogleIcon : GitHubIcon;
  const anyConfigured = isGitHubConfigured || isGoogleConfigured;

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
        <span className={isMenu ? "text-xs" : "text-[11px]"}>Account: Loading…</span>
      </span>
    );
  }

  if (isLoggingIn || deviceFlow) {
    const finishingLabel =
      loginProvider === "google"
        ? "Finishing Google sign-in…"
        : "Finishing GitHub sign-in…";

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-amber-400/90",
          isMenu && "w-full rounded border border-amber-400/25 bg-amber-400/5 px-2.5 py-2",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        <ProviderIcon className="h-3.5 w-3.5 shrink-0" />
        <span className={cn("min-w-0", isMenu ? "text-xs font-medium" : "text-[11px]")}>
          {isMenu ? finishingLabel : `Account: ${finishingLabel}`}
        </span>
      </span>
    );
  }

  if (session) {
    const signedInProvider = providerLabel(session.provider);
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 text-foreground",
          isMenu &&
            "w-full rounded border border-success/30 bg-success/5 px-2.5 py-2",
          className,
        )}
        title={`Signed in with ${signedInProvider} as ${session.user.login}`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" />
          <span className="bg-success relative inline-flex h-2 w-2 rounded-full" />
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
        ) : session.provider === "google" ? (
          <GoogleIcon className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <GitHubIcon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className={cn("min-w-0 truncate", isMenu ? "text-xs" : "text-[11px]")}>
          {isMenu ? (
            <>
              <span className="text-success font-medium">Signed in</span>
              <span className="text-muted">
                {" "}
                · {signedInProvider} · @{session.user.login}
              </span>
            </>
          ) : (
            <>
              <span className="text-success">Signed in</span>
              <span className="text-muted-foreground">
                {" "}
                · {signedInProvider} · @{session.user.login}
              </span>
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
        anyConfigured
          ? "Not signed in"
          : "Sign-in is not configured"
      }
    >
      <span className="bg-muted/80 h-2 w-2 shrink-0 rounded-full" />
      <GitHubIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className={isMenu ? "text-xs" : "text-[11px]"}>
        {isMenu ? (
          <span className="text-muted-foreground font-medium">Not signed in</span>
        ) : (
          <>Account: Not signed in</>
        )}
      </span>
    </span>
  );
}
