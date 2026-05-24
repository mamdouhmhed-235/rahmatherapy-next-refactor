"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChartEmpty, ChartError } from "./chart-states";
import { defaultChartTheme } from "./theme";
import { useReducedMotion } from "../use-reduced-motion";

export interface DonutSlice {
  name: string;
  value: number;
  fill?: string;
}

export interface DonutChartProps {
  data?: DonutSlice[] | null;
  height?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  ariaLabel?: string;
  centerLabel?: React.ReactNode;
}

export function DonutChart({
  data,
  height = 220,
  innerRadius = "55%",
  outerRadius = "80%",
  ariaLabel,
  centerLabel,
}: DonutChartProps) {
  const reduce = useReducedMotion();
  if (data === undefined) return <ChartError height={height} />;
  const total = (data ?? []).reduce((sum, slice) => sum + slice.value, 0);
  if (!data || data.length === 0 || total === 0)
    return <ChartEmpty height={height} message="Nothing to break down yet." />;
  return (
    <div className="relative w-full" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height} minHeight={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={1}
            isAnimationActive={!reduce}
          >
            {data.map((slice, index) => (
              <Cell
                key={`${slice.name}-${index}`}
                fill={slice.fill ?? defaultChartTheme.primaryStroke}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: defaultChartTheme.tooltipBg,
              border: `1px solid ${defaultChartTheme.tooltipBorder}`,
              borderRadius: defaultChartTheme.tooltipRadius,
              fontSize: defaultChartTheme.fontSize + 1,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          {centerLabel}
        </div>
      ) : null}
    </div>
  );
}
