import googleSignInLogo from "@/assets/logos/google-sign-in.svg";
import { cn } from "@/lib/utils";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-white p-0.5",
        className,
      )}
      aria-hidden
    >
      <img
        src={googleSignInLogo}
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
