"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "../use-reduced-motion";

export interface ScorecardRingProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const RING_COLOR = {
  ontrack: "var(--admin-status-confirmed-text)",
  approaching: "var(--admin-status-pending-text)",
  behind: "var(--admin-status-attention-text)",
} as const;

function familyFor(percent: number): keyof typeof RING_COLOR {
  if (percent >= 1) return "ontrack";
  if (percent >= 0.75) return "approaching";
  return "behind";
}

/**
 * SVG progress ring scoped to a target. Brief §5.2 colour rules:
 *   ≥ target  → Confirmed family
 *   75–99%    → Pending family
 *   < 75%     → Attention family
 *
 * Clamps the dasharray at min 0.5% so a 1% reading still renders a visible
 * arc. Honours `prefers-reduced-motion` by skipping the dashoffset transition.
 */
export function ScorecardRing({
  label,
  value,
  target,
  unit = "%",
  size = 96,
  strokeWidth = 8,
  className,
}: ScorecardRingProps) {
  const reduce = useReducedMotion();
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const family = familyFor(pct);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const minVisibleOffset = circumference * 0.995;
  const computedOffset = circumference * (1 - pct);
  const dashOffset = Math.min(computedOffset, minVisibleOffset);
  const titleText = `${value}${unit} of ${target}${unit} target (${Math.round(pct * 100)}%)`;
  return (
    <div
      role="group"
      aria-label={label}
      title={titleText}
      className={cn("inline-flex flex-col items-center", className)}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--admin-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_COLOR[family]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={reduce ? undefined : { transition: "stroke-dashoffset 600ms ease-out" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: size / 4, fill: "var(--admin-heading)", fontWeight: 500 }}
        >
          {`${value}${unit}`}
        </text>
      </svg>
      <span className="mt-2 text-xs text-[var(--admin-text-muted)]">{label}</span>
      <span className="sr-only">{titleText}</span>
    </div>
  );
}
