"use client";

// B-4 — Insight row (client component for dismiss + optional drill-link).
//
// Optimistic dismiss flow per plan step 3:
//   1. Click × → local state flips to dismissed=true → row fades + slides out.
//   2. dismissInsight server action runs in background; on success calls
//      updateTag('report-data') so the page re-renders without this insight.
//   3. On server error: roll back local state, show sonner toast, keep the
//      row visible so the user can retry.
//
// Severity → token mapping (B-1 tokens; B-0 WCAG-paired text-strong on
// danger/warning per the Option C resolution):
//   critical → --admin-danger-bg-strong  + --admin-danger-text-strong
//   warning  → --admin-warning-bg-strong + --admin-warning-text-strong
//   info     → --admin-info-bg           + --admin-info (regular)
//
// Icons: AlertTriangle (critical), AlertCircle (warning), Sparkles (info)
// at 16px per brief §8.

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dismissInsight } from "./insight-actions";
import type { InsightSeverity } from "./report-insights";

interface InsightRowProps {
  insightId: string;
  severity: InsightSeverity;
  message: string;
  drillHref?: string;
}

function SeverityIcon({ severity }: { severity: InsightSeverity }) {
  if (severity === "critical") {
    return <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />;
  }
  if (severity === "warning") {
    return <AlertCircle className="size-4 shrink-0" aria-hidden="true" />;
  }
  return <Sparkles className="size-4 shrink-0" aria-hidden="true" />;
}

function severityClasses(severity: InsightSeverity): string {
  if (severity === "critical") {
    return "bg-[var(--admin-danger-bg-strong)] text-[var(--admin-danger-text-strong)] border-[var(--admin-danger-text-strong)]/30";
  }
  if (severity === "warning") {
    return "bg-[var(--admin-warning-bg-strong)] text-[var(--admin-warning-text-strong)] border-[var(--admin-warning-text-strong)]/30";
  }
  return "bg-[var(--admin-info-bg)] text-[var(--admin-info)] border-[var(--admin-info)]/25";
}

export function InsightRow({ insightId, severity, message, drillHref }: InsightRowProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDismiss = () => {
    // Optimistic: flip locally first so the row fades immediately.
    setDismissed(true);
    startTransition(async () => {
      const result = await dismissInsight(insightId);
      if (result.error) {
        // Roll back — row reappears; user can retry.
        setDismissed(false);
        toast.error("Couldn't dismiss this insight.", {
          description: result.error,
        });
      }
    });
  };

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-4 py-3 transition-opacity",
        severityClasses(severity),
        isPending && "opacity-60"
      )}
      data-insight-id={insightId}
    >
      <SeverityIcon severity={severity} />
      <p className="min-w-0 flex-1 text-sm leading-5">{message}</p>
      {drillHref ? (
        <Link
          href={drillHref}
          className="inline-flex h-7 items-center rounded-[var(--admin-radius-control)] px-2 text-xs font-medium underline-offset-2 outline-none transition-colors hover:bg-black/5 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45"
        >
          View →
        </Link>
      ) : null}
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        aria-label={`Dismiss insight: ${message}`}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]/45 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
