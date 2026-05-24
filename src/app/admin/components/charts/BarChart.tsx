"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty, ChartError } from "./chart-states";
import { defaultChartTheme } from "./theme";
import { useReducedMotion } from "../use-reduced-motion";

export interface BarSeries {
  dataKey: string;
  label?: string;
  fill?: string;
}

export interface BarChartProps<T extends Record<string, unknown>> {
  data?: T[] | null;
  series: BarSeries[];
  categoryKey: string;
  height?: number;
  ariaLabel?: string;
}

export function BarChart<T extends Record<string, unknown>>({
  data,
  series,
  categoryKey,
  height = 240,
  ariaLabel,
}: BarChartProps<T>) {
  const reduce = useReducedMotion();
  if (data === undefined) return <ChartError height={height} />;
  if (data.length === 0)
    return <ChartEmpty height={height} message="No data in this window." />;
  return (
    <div className="w-full" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height} minHeight={height}>
        <RechartsBarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray={defaultChartTheme.gridStrokeDasharray}
            stroke={defaultChartTheme.gridStroke}
            vertical={false}
          />
          <XAxis
            dataKey={categoryKey}
            tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
            stroke={defaultChartTheme.axisStroke}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
            stroke={defaultChartTheme.axisStroke}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: defaultChartTheme.tooltipBg,
              border: `1px solid ${defaultChartTheme.tooltipBorder}`,
              borderRadius: defaultChartTheme.tooltipRadius,
              fontSize: defaultChartTheme.fontSize + 1,
            }}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label ?? s.dataKey}
              fill={s.fill ?? defaultChartTheme.primaryStroke}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduce}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
