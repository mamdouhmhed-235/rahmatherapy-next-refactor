"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyIdButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied.`, { duration: 2000 });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-[var(--admin-radius-control)] px-1.5 text-[0.6875rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55",
        copied
          ? "text-[oklch(22%_0.085_155)]"
          : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)]"
      )}
    >
      {copied ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <Copy className="size-3" aria-hidden="true" />
      )}
      <span className="font-mono">{value.slice(0, 8)}</span>
    </button>
  );
}
