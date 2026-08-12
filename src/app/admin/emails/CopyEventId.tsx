"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyEventId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Copied event ID");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API failed (typically iframe / older browser) — fall back to
      // selection so the operator can copy manually.
      const range = document.createRange();
      const node = document.createElement("span");
      node.textContent = id;
      document.body.appendChild(node);
      range.selectNode(node);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      toast.message("Copy not available — text is selected");
      window.setTimeout(() => {
        node.remove();
        window.getSelection()?.removeAllRanges();
      }, 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to copy provider ID"
      className={cn(
        "group inline-flex max-w-full items-center gap-1 rounded-[var(--admin-radius-control)] px-1.5 py-0.5",
        "text-[0.75rem] leading-5 text-[var(--admin-text-muted)]",
        "transition-colors duration-150 outline-none hover:bg-[var(--admin-panel-muted)] hover:text-[var(--admin-heading)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
      )}
      style={{ fontFamily: "var(--font-admin-mono), 'IBM Plex Mono', Menlo, monospace" }}
    >
      <span className="min-w-0 truncate">{id}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-[var(--admin-status-confirmed-text)]" aria-hidden="true" />
      ) : (
        <Copy
          className="size-3 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      )}
      <span className="sr-only">Copy event ID</span>
    </button>
  );
}
