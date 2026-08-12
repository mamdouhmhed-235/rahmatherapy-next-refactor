"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ATTENTION_TEXT = "text-[var(--admin-status-attention-text)]";
const ATTENTION_BORDER = "border-[oklch(80%_0.07_75)]";
const ATTENTION_BG_SOFT = "bg-[var(--admin-status-attention-bg)]";

export function DuplicateWarningBanner({
  message,
  checked,
  onCheckedChange,
  acknowledgeLabel = "Create a separate client profile anyway.",
}: {
  message: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /**
   * What ticking the box actually does. The default suits the create-client
   * form, where a separate profile is a real outcome. Callers whose flow can
   * only link to the existing record pass their own honest wording.
   */
  acknowledgeLabel?: string;
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
            <span className="font-medium">{acknowledgeLabel}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
