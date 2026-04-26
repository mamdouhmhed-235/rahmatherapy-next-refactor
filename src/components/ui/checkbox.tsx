import * as React from "react";
import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      data-slot="checkbox"
      type="checkbox"
      className={cn(
        "size-4 rounded-sm border border-input bg-background text-primary shadow-xs accent-primary outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
