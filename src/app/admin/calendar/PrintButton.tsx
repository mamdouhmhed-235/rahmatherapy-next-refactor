"use client";

import { Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      // ⛔ admin-secondary, not outline: `outline` is a PUBLIC-site variant
      // (bg-background / text-foreground), which paints a cream button with
      // dark text on the near-black admin canvas. Same box, admin tokens.
      className={cn(
        buttonVariants({ variant: "admin-secondary", size: "sm" }),
        "min-h-10 print:hidden"
      )}
    >
      <Printer className="size-4" />
      Print current view
    </button>
  );
}
