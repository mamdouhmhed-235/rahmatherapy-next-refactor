import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  rows = 5,
  ...props
}: React.ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        "flex min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors duration-[var(--motion-duration-fast)] ease-gentle placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
