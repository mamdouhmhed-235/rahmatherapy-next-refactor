"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmpty, ChartError } from "./chart-states";
import { defaultChartTheme } from "./theme";
import { useReducedMotion } from "../use-reduced-motion";

export interface LineSeries {
  dataKey: string;
  label?: string;
  stroke?: string;
}

export interface LineChartProps<T extends Record<string, unknown>> {
  data?: T[] | null;
  series: LineSeries[];
  categoryKey: string;
  height?: number;
  ariaLabel?: string;
}

export function LineChart<T extends Record<string, unknown>>({
  data,
  series,
  categoryKey,
  height = 240,
  ariaLabel,
}: LineChartProps<T>) {
  const reduce = useReducedMotion();
  if (data === undefined) return <ChartError height={height} />;
  if (data.length === 0)
    return <ChartEmpty height={height} message="No data in this window." />;
  return (
    <div className="w-full" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height} minHeight={height}>
        <RechartsLineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray={defaultChartTheme.gridStrokeDasharray}
            stroke={defaultChartTheme.gridStroke}
          />
          <XAxis
            dataKey={categoryKey}
            tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
            stroke={defaultChartTheme.axisStroke}
          />
          <YAxis
            tick={{ fontSize: defaultChartTheme.fontSize, fill: defaultChartTheme.axisTickFill }}
            stroke={defaultChartTheme.axisStroke}
            width={48}
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
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label ?? s.dataKey}
              stroke={s.stroke ?? defaultChartTheme.primaryStroke}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!reduce}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
