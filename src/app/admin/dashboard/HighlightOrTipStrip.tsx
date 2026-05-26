// SERVER COMPONENT — Therapist Highlight or Tip strip (brief §5.6 block 4).
//
// Single-row block: lucide icon + factual message. Tone discipline per
// AUDIT Q1 — never "best month yet" or trophy/star icons. Icon switches
// between TrendingUp / Sparkles / Lightbulb per the helper's decision.

import { Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { TherapistHighlight } from "./therapist-fullness";

const ICON_MAP = {
  TrendingUp,
  Sparkles,
  Lightbulb,
} as const;

export function HighlightOrTipStrip({
  highlight,
}: {
  highlight: TherapistHighlight;
}) {
  const Icon = ICON_MAP[highlight.icon];
  return (
    <section
      aria-label={highlight.kind === "tip" ? "Tip" : "Highlight"}
      data-highlight-kind={highlight.kind}
      className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border border-[var(--admin-border)]/70 bg-[var(--admin-panel-muted)]/40 px-4 py-3"
    >
      <Icon
        className="size-4 shrink-0 text-[var(--admin-body)]"
        aria-hidden="true"
      />
      <p className="text-sm leading-5 text-[var(--admin-body)]">
        {highlight.message}
      </p>
    </section>
  );
}
