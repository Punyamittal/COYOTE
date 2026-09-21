import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl bg-[#e4eaf2] px-4 py-2 text-sm font-medium shadow-[inset_5px_5px_10px_#c4d0df,inset_-5px_-5px_10px_#ffffff] transition-shadow placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 disabled:cursor-not-allowed disabled:opacity-50 border border-white/30",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
