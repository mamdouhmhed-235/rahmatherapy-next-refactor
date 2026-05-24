"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import { useReducedMotion } from "../use-reduced-motion";

export interface SparklinePoint {
  value: number;
}

export interface SparklineChartProps {
  data?: SparklinePoint[] | null;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Minimal trend-in-cell line: no axes, no tooltip, no grid. Renders nothing
 * when data is empty or undefined (per B-1 brief §8 — sparklines never print
 * "No data" copy at 32px).
 */
export function SparklineChart({
  data,
  height = 32,
  stroke = "currentColor",
  strokeWidth = 1.5,
  className,
}: SparklineChartProps) {
  const reduce = useReducedMotion();
  if (!data || data.length === 0) return null;
  return (
    <div className={className} aria-hidden="true">
      <ResponsiveContainer width="100%" height={height} minHeight={height}>
        <LineChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={!reduce}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
