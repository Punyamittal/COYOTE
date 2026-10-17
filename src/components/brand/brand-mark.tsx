import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Wordmark: Coy + ote (accent) */
export function BrandMark({
  className,
  accentClassName = "text-[#3B82F6]",
}: {
  className?: string;
  accentClassName?: string;
}) {
  const accent = APP_NAME.slice(3);
  const root = APP_NAME.slice(0, 3);
  return (
    <span className={cn("font-extrabold tracking-tight", className)}>
      {root}
      <span className={accentClassName}>{accent}</span>
    </span>
  );
}
