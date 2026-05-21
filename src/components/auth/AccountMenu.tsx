import { useState } from "react";
import { Loader2, LogOut, User } from "lucide-react";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GitHubAuthStatus } from "@/components/auth/GitHubAuthStatus";
import { UserXpBar } from "@/components/auth/UserXpBar";
import { useAuth } from "@/contexts/AuthContext";
import { openExternal } from "@/lib/open-external";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const {
    session,
    isConfigured,
    isLoggingIn,
    deviceFlow,
    pollAttempt,
    error,
    startGitHubLogin,
    cancelLogin,
    logout,
    resumePendingLogin,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const isLoggedIn = session != null;
  const menuOpenEffective = menuOpen && !isLoggedIn;

  return (
    <DropdownMenu
      open={menuOpenEffective}
      onOpenChange={(open) => {
        if (!open && isLoggingIn) return;
        setMenuOpen(open);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={
            isLoggedIn
              ? (session.user.name ?? session.user.login)
              : isLoggingIn
                ? "Finishing GitHub sign-in…"
                : "Account"
          }
          className={cn(
            "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
            "hover:bg-panel-elevated hover:text-foreground",
            "data-[state=open]:bg-panel-elevated data-[state=open]:text-foreground",
          )}
        >
          {isLoggedIn ? (
            <img
              src={session.user.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : isLoggingIn ? (
            <Loader2 className="text-accent h-4 w-4 animate-spin" />
          ) : (
            <User className="h-4 w-4" />
          )}
          {isLoggedIn && (
            <span className="bg-success ring-surface absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full ring-2" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-64">
        <div className="px-2 pt-2">
          <GitHubAuthStatus variant="menu" />
        </div>
        <DropdownMenuSeparator className="my-2" />

        {isLoggedIn ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <p className="text-foreground text-sm font-medium">
                {session.user.name ?? session.user.login}
              </p>
              <p className="text-muted text-xs font-normal">
                @{session.user.login}
              </p>
              <UserXpBar className="mt-3" />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="gap-2 text-red-400">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {deviceFlow && (
              <section className="space-y-2 px-2 py-2">
                <p className="text-muted text-[11px] leading-snug">
                  Enter this code on GitHub to finish signing in:
                </p>
                <p className="text-foreground text-center font-mono text-lg font-semibold tracking-widest">
                  {deviceFlow.userCode}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => void openExternal(deviceFlow.verificationUri)}
                >
                  <GitHubIcon className="h-3.5 w-3.5" />
                  Open GitHub
                </Button>
                <p className="text-muted flex items-center justify-center gap-1.5 text-[11px]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {pollAttempt > 0
                    ? `Checking with GitHub… (${pollAttempt})`
                    : "Waiting for authorization…"}
                </p>
                <p className="text-muted text-center text-[10px] leading-snug">
                  Approve on GitHub, then return here. Sign-in completes
                  automatically.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={isLoggingIn}
                  onClick={() => void resumePendingLogin()}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    "Complete sign-in"
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={cancelLogin}
                >
                  Cancel
                </Button>
              </section>
            )}

            {!deviceFlow && !isLoggingIn && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(true);
                  void startGitHubLogin();
                }}
                className="gap-2"
              >
                <GitHubIcon className="h-3.5 w-3.5" />
                Sign in with GitHub
              </DropdownMenuItem>
            )}

            {isLoggingIn && !deviceFlow && (
              <p className="text-muted flex items-center justify-center gap-1.5 px-2 py-3 text-[11px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Starting sign-in…
              </p>
            )}

            {!isConfigured && (
              <p className="text-muted px-2 py-2 text-[10px] leading-snug">
                Create a GitHub OAuth app with Device Flow enabled, set{" "}
                <code className="text-foreground">VITE_GITHUB_CLIENT_ID</code> in
                .env, then restart the app. See GITHUB_SETUP.md.
              </p>
            )}

            {error && (
              <section className="mx-2 mb-2 rounded border border-red-400/40 bg-red-400/10 px-2 py-2">
                <p className="text-[11px] leading-snug font-medium text-red-400">
                  Sign-in failed
                </p>
                <p className="mt-1 text-[11px] leading-snug text-red-300/90">
                  {error}
                </p>
              </section>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
