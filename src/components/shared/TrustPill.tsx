import type { HTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustPillProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  children: ReactNode;
  inverse?: boolean;
}

export function TrustPill({
  icon,
  children,
  inverse = false,
  className,
  ...props
}: TrustPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
        inverse
          ? "border-white/20 bg-white/10 text-white"
          : "border-rahma-border bg-white text-rahma-green",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
          inverse ? "bg-white/15 text-rahma-gold" : "bg-rahma-ivory text-rahma-green"
        )}
        aria-hidden="true"
      >
        {icon ?? <Check size={14} strokeWidth={2.4} />}
      </span>
      <span>{children}</span>
    </div>
  );
}
