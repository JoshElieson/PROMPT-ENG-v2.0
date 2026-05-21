import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-visible:outline-foreground/60 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[#6366f1]/35 bg-[#4f46e5] text-white shadow-[0_8px_18px_rgba(15,23,42,0.28)] hover:bg-[#4338ca]",
        ghost:
          "text-foreground hover:text-foreground hover:bg-[rgb(148_163_184_/_0.12)]",
        outline:
          "border-border hover:bg-panel-elevated/80 border bg-transparent",
        secondary: "bg-panel-elevated text-foreground hover:bg-panel-elevated/80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
