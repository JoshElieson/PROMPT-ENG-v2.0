import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { completeGoogleOAuthBrowser } from "@/lib/google-auth";
import { saveAuthSession } from "@/lib/auth-storage";

export function GoogleOAuthCallback() {
  const [message, setMessage] = useState("Finishing Google sign-in…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      if (error) {
        setMessage(
          params.get("error_description") ??
            "Google sign-in was cancelled or denied.",
        );
        return;
      }

      const code = params.get("code");
      const state = params.get("state");
      if (!code || !state) {
        setMessage("Missing authorization code. Start sign-in again from Forge.");
        return;
      }

      try {
        const session = await completeGoogleOAuthBrowser(code, state);
        if (cancelled) return;
        await saveAuthSession(session);
        window.location.replace("/");
      } catch (e) {
        if (cancelled) return;
        setMessage(e instanceof Error ? e.message : "Google sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <GoogleIcon className="h-6 w-6 rounded-md p-1" />
          <Loader2 className="text-accent h-5 w-5 animate-spin" />
        </div>
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}
