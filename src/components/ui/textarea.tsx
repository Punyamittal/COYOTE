import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[88px] w-full rounded-2xl bg-[#e4eaf2] px-4 py-3 text-sm font-medium shadow-[inset_5px_5px_10px_#c4d0df,inset_-5px_-5px_10px_#ffffff] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 disabled:cursor-not-allowed disabled:opacity-50 border border-white/30",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
