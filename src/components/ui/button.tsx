import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 active:neu-pressed",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[6px_6px_14px_#c4d0df,-6px_-6px_14px_#ffffff] hover:brightness-110",
        accent:
          "text-white bg-gradient-to-br from-[#ff7b7b] to-[#ff5a5a] shadow-[6px_6px_16px_rgba(255,107,107,0.4),-6px_-6px_16px_#ffffff] hover:brightness-105",
        secondary:
          "bg-[var(--background)] text-[var(--foreground)] shadow-[6px_6px_14px_#c4d0df,-6px_-6px_14px_#ffffff] border border-white/50 hover:brightness-[0.98]",
        outline:
          "bg-[var(--background)] text-[var(--foreground)] shadow-[6px_6px_14px_#c4d0df,-6px_-6px_14px_#ffffff] border border-white/40",
        ghost: "shadow-none hover:bg-white/30",
        destructive:
          "bg-[var(--destructive)] text-white shadow-[6px_6px_14px_#c4d0df,-6px_-6px_14px_#ffffff]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";
