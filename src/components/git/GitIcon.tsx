import { cn } from "@/lib/utils";

/** Official-style Git mark (orange) used in VS Code Source Control */
export function GitIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M11.93 8.5 6.75 3.32a1.96 1.96 0 0 0-2.78 2.78l5.18 5.18a1.96 1.96 0 0 0 2.78-2.78Z"
        fill="#F05032"
      />
      <path
        d="M8.5 4.07 3.32 9.25a1.96 1.96 0 0 0 2.78 2.78l5.18-5.18a1.96 1.96 0 0 0-2.78-2.78Z"
        fill="#F05032"
        opacity={0.85}
      />
      <circle cx="5.1" cy="5.1" r="1.35" fill="#F05032" />
      <circle cx="10.9" cy="10.9" r="1.35" fill="#F05032" />
    </svg>
  );
}
