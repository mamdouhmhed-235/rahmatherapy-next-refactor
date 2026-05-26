"use client";

import { useState } from "react";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_LINE_CAP = 4;

export function PrivacyRequestNote({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false);

  const lineCount = note.split(/\r?\n/).length;
  const isLikelyTruncated = lineCount > COLLAPSED_LINE_CAP || note.length > 360;

  return (
    <figure
      className={cn(
        "mt-3 rounded-[var(--admin-radius-control)] bg-[var(--admin-panel-muted)]",
        "px-3.5 py-3 sm:px-4 sm:py-3.5"
      )}
    >
      <Quote
        className="float-left mr-2 size-4 shrink-0 text-[var(--admin-text-muted)]/70"
        aria-hidden="true"
      />
      <blockquote
        className={cn(
          "whitespace-pre-wrap text-sm leading-6 text-[var(--admin-body)]",
          expanded ? "" : "line-clamp-4"
        )}
      >
        {note}
      </blockquote>
      {isLikelyTruncated ? (
        <figcaption className="mt-2 clear-both">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            title={expanded ? "Hide the full note" : "Expand to read the full note"}
            className="inline-flex min-h-11 sm:min-h-8 items-center rounded-[var(--admin-radius-control)] px-3 sm:px-2 text-xs font-semibold text-[var(--admin-primary)] outline-none transition-colors hover:bg-[var(--admin-panel)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/55"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </figcaption>
      ) : null}
    </figure>
  );
}
