import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-[9999px] border-2 border-transparent p-0.5 transition-colors",
      "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-foreground",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:bg-border",
      "data-[state=checked]:bg-accent-hover",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-[9999px] ring-0 transition-transform",
        "bg-foreground shadow-sm",
        "data-[state=checked]:translate-x-4 data-[state=checked]:bg-panel",
        "data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
