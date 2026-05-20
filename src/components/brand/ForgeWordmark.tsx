import { cn } from "@/lib/utils";

/** Aspect ratio of `public/forge-wordmark-mask.png` (FORGE text only, no logo). */
const WORDMARK_ASPECT = 374 / 88;

type ForgeWordmarkProps = {
  className?: string;
  /** Rendered height in CSS pixels. Width scales from the mask aspect ratio. */
  height?: number;
};

export function ForgeWordmark({ className, height = 14 }: ForgeWordmarkProps) {
  return (
    <span
      role="img"
      aria-label="FORGE"
      className={cn("inline-block shrink-0 bg-accent", className)}
      style={{
        height,
        width: height * WORDMARK_ASPECT,
        WebkitMaskImage: "url(/forge-wordmark-mask.png)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: "url(/forge-wordmark-mask.png)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
    />
  );
}
