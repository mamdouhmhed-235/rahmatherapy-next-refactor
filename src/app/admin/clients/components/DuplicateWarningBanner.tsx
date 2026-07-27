"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ATTENTION_TEXT = "text-[oklch(26%_0.130_55)]";
const ATTENTION_BORDER = "border-[oklch(80%_0.07_75)]";
const ATTENTION_BG_SOFT = "bg-[oklch(95.0%_0.050_65)]";

export function DuplicateWarningBanner({
  message,
  checked,
  onCheckedChange,
}: {
  message: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "rahma-pop-in rounded-[var(--admin-radius-card)] border px-4 py-3 text-sm",
        ATTENTION_BORDER,
        ATTENTION_BG_SOFT,
        ATTENTION_TEXT
      )}
    >
      <div className="flex gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">Possible duplicate client</p>
          <p className="mt-1 leading-6">{message}</p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              name="confirm_duplicate"
              type="checkbox"
              required
              checked={checked}
              onChange={(event) => onCheckedChange(event.currentTarget.checked)}
              className="mt-0.5 size-4 rounded border-[var(--admin-border-form)] text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
            />
            <span className="font-medium">
              Create a separate client profile anyway.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
