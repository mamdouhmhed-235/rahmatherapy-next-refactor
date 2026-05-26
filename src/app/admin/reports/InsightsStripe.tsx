// B-4 — Insights stripe.
//
// Slim row of 0–3 plain-English observations produced by `getReportInsights`
// (B-2) for the current period vs prior. Severity-banded (critical → warning
// → info) with optional drill-link and dismissible × button per row.
//
// Renders nothing when the input list is empty — no placeholder, per brief
// §6 "Insights stripe empty → hidden entirely".
//
// Per SHARED-NOTES §3 a11y: the stripe container is a `role="status"` live
// region so screen readers announce new observations after re-render.
//
// Plan: redesign/plans/B-phase/B4-reports-rebuild-plan.md (step 3).

import type { ReportInsight } from "./report-insights";
import { InsightRow } from "./InsightRow";

interface InsightsStripeProps {
  insights: ReportInsight[];
}

export function InsightsStripe({ insights }: InsightsStripeProps) {
  if (insights.length === 0) return null;
  return (
    <section
      aria-label="Insights"
      role="status"
      aria-live="polite"
      className="grid gap-2"
    >
      {insights.map((insight) => (
        <InsightRow
          key={insight.id}
          insightId={insight.id}
          severity={insight.severity}
          message={insight.message}
          drillHref={insight.drillUrl}
        />
      ))}
    </section>
  );
}
